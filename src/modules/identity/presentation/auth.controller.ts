import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from '@/modules/identity/application/auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterPetOwnerDto } from './dto/register-pet-owner.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { PasswordResetService } from '@/modules/identity/application/password-reset.service';
import { Public } from '@/shared/common/decorators/public.decorator';
import { ClientIp } from '@/shared/common/audit/client-ip';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Public()
  @Post('register')
  registerPetOwner(@Body() dto: RegisterPetOwnerDto) {
    return this.authService.registerPetOwner(dto);
  }

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

  /** Gửi mã khôi phục qua Zalo/Gmail. Luôn trả cùng một kết quả dù SĐT có tài khoản hay không. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordReset.requestCode(dto.phone);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordReset.resetPassword(dto.phone, dto.code, dto.newPassword);
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
