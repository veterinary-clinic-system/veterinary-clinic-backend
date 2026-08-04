import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/shared/common/decorators/public.decorator';
import { PERMISSIONS_KEY } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { PermissionsService } from '@/modules/identity/application/permissions.service';

/**
 * Thuc thi `@RequirePermissions(...)` - SRS FR-02: "Backend phai kiem tra permission
 * truoc khi thuc hien thao tac."
 *
 * Dang ky lam APP_GUARD trong `PermissionsModule` (khong phai AppModule) de Nest tu
 * giai quyet `PermissionsService` trong dung ngu canh module co provider do.
 *
 * Guard nay KHONG gia dinh minh chay sau `JwtAuthGuard`. Thu tu thuc thi cua cac
 * APP_GUARD dang ky o nhieu module khac nhau phu thuoc vao thu tu khoi tao module -
 * mot chi tiet noi bo cua Nest, khong nen dua vao. Nen no tu kiem tra `@Public()` va tu
 * xu ly truong hop chua co `request.user`.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    const granted = await this.permissionsService.getPermissionsForRole(user.role);
    const missing = required.filter((permission) => !granted.has(permission));

    if (missing.length > 0) {
      // Neu ten quyen con thieu ra ngoai thi nguoi dung biet duoc he thong co nhung
      // quyen gi va endpoint nao doi quyen nao - do la thong tin do duong cho ke tan
      // cong. Ghi chi tiet vao log (LoggingInterceptor), khong tra ve client.
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    return true;
  }
}
