import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from '@/modules/identity/application/auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterPetOwnerDto } from './dto/register-pet-owner.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '@/shared/common/decorators/public.decorator';
import { ClientIp } from '@/shared/common/audit/client-ip';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  registerPetOwner(@Body() dto: RegisterPetOwnerDto) {
    return this.authService.registerPetOwner(dto);
  }

  /**
   * `LOGIN` duoc ghi audit ben trong `AuthService`, khong qua `@Audit(...)` - luc handler
   * nay chay thi request van chua co danh tinh nao. Xem ghi chu dau `AuthService`.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @ClientIp() ipAddress: string | null,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.login(dto, { ipAddress, userAgent });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() dto: RefreshTokenDto,
    @ClientIp() ipAddress: string | null,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.authService.logout(dto.refreshToken, { ipAddress, userAgent });
  }
}
