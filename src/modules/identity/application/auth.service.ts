import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { RefreshToken } from '@/modules/identity/domain/entities/refresh-token.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Role } from '@/shared/common/enums/role.enum';
import { RegisterPetOwnerDto } from '@/modules/identity/presentation/dto/register-pet-owner.dto';
import { LoginDto } from '@/modules/identity/presentation/dto/login.dto';
import { AUDIT_RECORDER, AuditRecorder } from '@/shared/common/audit/audit-recorder.port';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';
import {
  AccessTokenPayload,
  AuthRequestContext,
  RefreshTokenPayload,
  TokenPair,
} from './auth.types';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: AuditRecorder,
  ) {}

  async registerPetOwner(dto: RegisterPetOwnerDto): Promise<TokenPair> {
    let user = await this.usersRepository.findOne({ where: { phone: dto.phone } });

    if (user?.passwordHash) {
      throw new ConflictException('This phone number is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    if (user) {
      user.passwordHash = passwordHash;
      user.fullName = dto.fullName;
      user.email = dto.email ?? user.email;
    } else {
      user = this.usersRepository.create({
        phone: dto.phone,
        fullName: dto.fullName,
        email: dto.email ?? null,
        passwordHash,
        role: Role.PET_OWNER,
      });
    }

    await this.usersRepository.save(user);
    return this.issueTokenPair(user);
  }

  async login(dto: LoginDto, context: AuthRequestContext = {}): Promise<TokenPair> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.phone = :phone', { phone: dto.phone })
      .getOne();

    if (!user || !user.passwordHash || !user.active) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    this.auditRecorder.record({
      actorUserId: user.id,
      action: AuditAction.LOGIN,
      entityName: 'User',
      entityId: user.id,
      
      changes: { phone: user.phone, role: user.role },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    return this.issueTokenPair(user);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokensRepository.findOne({
      where: { id: payload.jti },
      relations: ['user'],
    });

    if (!stored || stored.revokedAt || stored.tokenHash !== tokenHash) {
      throw new UnauthorizedException('Refresh token has been revoked or reused');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.usersRepository.findOne({ where: { id: payload.sub } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Account is inactive or no longer exists');
    }

    stored.revokedAt = new Date();
    const newPair = await this.issueTokenPair(user);
    stored.replacedByTokenHash = this.hashToken(newPair.refreshToken);
    await this.refreshTokensRepository.save(stored);

    return newPair;
  }

  async logout(refreshToken: string, context: AuthRequestContext = {}): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
      await this.refreshTokensRepository.update({ id: payload.jti }, { revokedAt: new Date() });

      this.auditRecorder.record({
        actorUserId: payload.sub,
        action: AuditAction.LOGOUT,
        entityName: 'User',
        entityId: payload.sub,
        changes: null,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      });
    } catch {
      
    }
  }

  private async issueTokenPair(user: User): Promise<TokenPair> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      branchId: user.branchId,
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
    });

    const jti = randomUUID();
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '7d');
    const refreshPayload: RefreshTokenPayload = { sub: user.id, jti };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: refreshExpiresIn,
    });

    await this.refreshTokensRepository.save(
      this.refreshTokensRepository.create({
        id: jti,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.parseExpiryMs(refreshExpiresIn)),
      }),
    );

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseExpiryMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    const value = parseInt(match[1], 10);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]] ?? 1000;
    return value * unitMs;
  }
}
