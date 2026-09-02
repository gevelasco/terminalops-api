import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { randomUUID } from 'crypto';
import { invitationLicenseEndsAt } from '../common/constants/invitation-codes';
import { CompaniesService } from '../companies/companies.service';
import { EmailService } from '../email/email.service';
import { InvitationCodesService } from '../invitation-codes/invitation-codes.service';
import { OperationalCentersService } from '../operational-centers/operational-centers.service';
import { UsersService } from '../users/users.service';
import EnvConfig from '../types/env-config.type';
import { AppUser } from 'src/users/entities/app-user.entity';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { isAppUserLoginAllowed } from './auth-login.util';
import {
  buildPasswordResetPayload,
  isPasswordResetPayload,
  type PasswordResetJwtPayload,
} from './password-reset-token.util';
import {
  hashRefreshToken,
  parseRefreshJwtPayload,
  REFRESH_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS,
} from './refresh-token.util';
import { RefreshTokensService } from './refresh-tokens.service';
import { ChecklistService } from '../checklist/checklist.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly companiesService: CompaniesService,
    private readonly invitationCodes: InvitationCodesService,
    private readonly operationalCenters: OperationalCentersService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig>,
    private readonly refreshTokens: RefreshTokensService,
    private readonly checklistService: ChecklistService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !isAppUserLoginAllowed(user.status)) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    const valid = await compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    return this.buildAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto) {
    const parsed = await this.verifyRefreshToken(dto.refreshToken);
    const user = await this.usersService.findOne({ id: parsed.userId });
    if (!user || !isAppUserLoginAllowed(user.status)) {
      await this.refreshTokens.revokeAllForUser(parsed.userId);
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
    const decision = await this.refreshTokens.inspect(
      parsed.jti,
      hashRefreshToken(dto.refreshToken),
    );
    if (decision === 'reuse') {
      await this.refreshTokens.revokeAllForUser(parsed.userId);
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
    if (decision === 'invalid') {
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
    const response = await this.buildAuthResponse(user);
    if (decision === 'active') {
      const nextJti = parseRefreshJwtPayload(
        this.jwtService.decode(response.refresh_token),
      )?.jti;
      await this.refreshTokens.markRotated(parsed.jti, nextJti);
    }
    return response;
  }

  async logout(dto: LogoutDto): Promise<{ ok: true }> {
    const token = dto.refreshToken?.trim();
    if (!token) {
      return { ok: true };
    }
    try {
      const parsed = await this.verifyRefreshToken(token);
      await this.refreshTokens.revokeByJti(parsed.jti);
    } catch {
      /* ya estaba inválido o expirado */
    }
    return { ok: true };
  }

  async signUp(dto: SignUpDto) {
    const invitationCode = dto.invitationCode?.trim() ?? '';
    if (!invitationCode) {
      throw new ForbiddenException('El código de invitación es obligatorio');
    }

    const username = dto.username.trim();
    const email = dto.email.trim().toLowerCase();
    const invite = await this.invitationCodes.consume(invitationCode, 'signup');

    try {
      const companyName = dto.companyName.trim();
      const company = await this.companiesService.create({
        name: companyName,
        subscriptionPlan: invite.grantedPlan,
        subscriptionEndsAt: invitationLicenseEndsAt(invite.licenseMonths),
      });

      const displayName =
        `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();
      const user = await this.usersService.createForCompany(company.id, {
        username,
        password: dto.password,
        displayName,
        email,
        phone: dto.phone.trim(),
        role: 'superadmin',
        theme: 'light',
      });

      await this.invitationCodes.attachRedemption(
        invite.id,
        company.id,
        user.id,
      );

      void this.emailService
        .sendWelcome({
          to: email,
          recipientName: displayName || username,
          companyName,
        })
        .catch((err) => {
          this.logger.warn(
            `Welcome email failed for ${email}`,
            err instanceof Error ? err.message : err,
          );
        });

      return this.buildAuthResponse(user);
    } catch (err) {
      await this.invitationCodes.release(invite.id);
      throw err;
    }
  }

  /**
   * Siempre responde OK para no filtrar si el correo existe.
   */
  async forgotPassword(emailRaw: string): Promise<{ ok: true }> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (user?.email && isAppUserLoginAllowed(user.status)) {
      const token = await this.signPasswordResetToken(user);
      void this.emailService
        .sendPasswordReset({
          to: user.email,
          recipientName: user.displayName?.trim() || user.username,
          resetToken: token,
        })
        .catch((err) => {
          this.logger.warn(
            `Password reset email failed for ${email}`,
            err instanceof Error ? err.message : err,
          );
        });
    }
    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
    let payload: PasswordResetJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<PasswordResetJwtPayload>(
        token,
        {
          secret: this.config.get('JWT_SECRET', { infer: true }),
        },
      );
    } catch {
      throw new HttpException(
        'El enlace no es válido o ya caducó. Solicita uno nuevo.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!isPasswordResetPayload(payload)) {
      throw new HttpException(
        'El enlace no es válido o ya caducó. Solicita uno nuevo.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.usersService.setPasswordById(payload.sub, newPassword);
    return { ok: true };
  }

  /** Token de restablecimiento / set password (invitación). */
  async signPasswordResetToken(
    user: Pick<AppUser, 'id' | 'email'>,
    /** Segundos (p. ej. 3600 = 1h, 86400 = 24h). */
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    const email = user.email?.trim().toLowerCase();
    if (!email) {
      throw new HttpException(
        'El usuario no tiene correo para restablecer contraseña',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.jwtService.signAsync(buildPasswordResetPayload(user.id, email), {
      secret: this.config.get('JWT_SECRET', { infer: true }),
      expiresIn: expiresInSeconds,
    });
  }

  private async buildAuthResponse(user: AppUser) {
    const resolved =
      user.company && user.preferences != null
        ? user
        : ((await this.usersService.findOne({ id: user.id })) ?? user);
    if (resolved.company) {
      resolved.company.primaryOperationalCenter ??=
        await this.operationalCenters.getPrimaryCenterForRead(
          resolved.companyId,
        );
    }
    const authUser = this.usersService.generateAuthUser(resolved);
    const openChecklistCount = await this.checklistService.countOpen(
      resolved.companyId,
      resolved.id,
    );
    const payloadUser = { ...authUser, openChecklistCount };
    const { photoDataUrl: _photo, openChecklistCount: _open, ...jwtClaims } =
      payloadUser;
    return {
      access_token: this.jwtService.sign(jwtClaims, { expiresIn: '1h' }),
      refresh_token: await this.issueRefreshToken(resolved.id),
      user: payloadUser,
    };
  }

  private async issueRefreshToken(userId: number): Promise<string> {
    const jti = randomUUID();
    const token = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.refreshSecret(),
        expiresIn: REFRESH_TOKEN_TTL,
        jwtid: jti,
      },
    );
    await this.refreshTokens.persist({
      userId,
      jti,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });
    return token;
  }

  private async verifyRefreshToken(token: string) {
    let payload: unknown;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
    const parsed = parseRefreshJwtPayload(payload);
    if (!parsed) {
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
    return parsed;
  }

  private refreshSecret(): string {
    return this.config.get('JWT_REFRESH_SECRET', { infer: true }) ?? '';
  }
}
