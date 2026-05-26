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
import { UsersService } from '../users/users.service';
import EnvConfig from '../types/env-config.type';
import { AppUser } from 'src/users/entities/app-user.entity';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignUpDto } from './dto/sign-up.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly companiesService: CompaniesService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByLogin(dto.login);
    if (!user || user.status === 'disabled') {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    const valid = await compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    return this.buildAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
    const user = await this.usersService.findOne({ id: payload.sub });
    if (!user || user.status === 'disabled') {
      throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
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
    const conflict = await this.usersService.findSignUpConflict(username, email);
    if (conflict === 'username') {
      throw new ConflictException(
        `El usuario "${username}" ya está registrado. Inicia sesión o elige otro nombre de usuario.`,
      );
    }
    if (conflict === 'email') {
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
      role: 'admin',
      theme: 'light',
    });

    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: AppUser) {
    const fresh = await this.usersService.findOne({ id: user.id });
    const authUser = this.usersService.generateAuthUser(fresh ?? user);
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
