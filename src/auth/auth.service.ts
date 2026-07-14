import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { isValidInvitationCode } from '../common/constants/invitation-codes';
import { CompaniesService } from '../companies/companies.service';
import { OperationalCentersService } from '../operational-centers/operational-centers.service';
import { UsersService } from '../users/users.service';
import EnvConfig from '../types/env-config.type';
import { AppUser } from 'src/users/entities/app-user.entity';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { isAppUserLoginAllowed } from './auth-login.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly companiesService: CompaniesService,
    private readonly operationalCenters: OperationalCentersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig>,
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
    let payload: { sub: string | number };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
    const userId = Number(payload.sub);
    const user = await this.usersService.findOne({ id: userId });
    if (!user || !isAppUserLoginAllowed(user.status)) {
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
    return this.buildAuthResponse(user);
  }

  async signUp(dto: SignUpDto) {
    const invitationCode = dto.invitationCode?.trim() ?? '';
    if (!invitationCode) {
      throw new ForbiddenException('El código de invitación es obligatorio');
    }
    if (!isValidInvitationCode(invitationCode)) {
      throw new ForbiddenException('Código de invitación inválido');
    }

    const username = dto.username.trim();
    const email = dto.email.trim().toLowerCase();
    if (await this.usersService.isEmailTaken(email)) {
      throw new ConflictException(
        `El correo "${email}" ya está registrado. Inicia sesión o usa otro correo.`,
      );
    }

    const company = await this.companiesService.create({
      name: dto.companyName.trim(),
    });

    const displayName = `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();
    const user = await this.usersService.createForCompany(company.id, {
      username,
      password: dto.password,
      displayName,
      email,
      phone: dto.phone.trim(),
      role: 'superadmin',
      theme: 'light',
    });

    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: AppUser) {
    const fresh = await this.usersService.findOne({ id: user.id });
    const resolved = fresh ?? user;
    if (resolved.company) {
      resolved.company.primaryOperationalCenter ??=
        await this.operationalCenters.getDefaultEntity(resolved.companyId);
    }
    const authUser = this.usersService.generateAuthUser(resolved);
    const { photoDataUrl: _photo, ...jwtClaims } = authUser;
    return {
      access_token: this.jwtService.sign(jwtClaims, { expiresIn: '1h' }),
      refresh_token: this.jwtService.sign(
        { sub: user.id },
        {
          secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
          expiresIn: '7d',
        },
      ),
      user: authUser,
    };
  }
}
