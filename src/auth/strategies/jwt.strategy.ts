import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/database/entities';
import { AuthenticatedUser } from '@/common/interfaces/authenticated-user.interface';
import { AccessTokenPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.usersRepository.findOne({ where: { id: payload.sub } });

    if (!user || !user.active) {
      throw new UnauthorizedException('Account is inactive or no longer exists');
    }

    return {
      userId: user.id,
      phone: user.phone,
      role: user.role,
      branchId: user.branchId,
    };
  }
}
