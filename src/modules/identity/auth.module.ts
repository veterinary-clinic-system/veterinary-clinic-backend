import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '@/modules/identity/domain/entities/refresh-token.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { AuthController } from '@/modules/identity/presentation/auth.controller';
import { AuthService } from '@/modules/identity/application/auth.service';
import { JwtStrategy } from '@/modules/identity/infrastructure/strategies/jwt.strategy';
import { AuditLogModule } from './audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: { expiresIn: config.get<string>('jwt.accessExpiresIn') },
      }),
    }),
    // P10-T2: `AuthService` tu ghi audit `LOGIN`/`LOGOUT` - xem ghi chu dau service do.
    AuditLogModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
