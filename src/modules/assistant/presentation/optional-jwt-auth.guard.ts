import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Cho một route `@Public()` biết người gọi là ai NẾU họ gửi kèm access token hợp lệ.
 *
 * `JwtAuthGuard` toàn cục bỏ qua hẳn passport ở route public, nên `request.user` luôn
 * rỗng ở đó. Guard này chạy passport lần nữa nhưng không bao giờ chặn: thiếu token, token
 * hết hạn hay sai đều chỉ cho ra khách vãng lai (`user = null`).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // Khách vãng lai - handleRequest bên dưới đã đặt user = null.
    }
    return true;
  }

  handleRequest<TUser>(_err: unknown, user: TUser | false): TUser | null {
    return user || null;
  }
}
