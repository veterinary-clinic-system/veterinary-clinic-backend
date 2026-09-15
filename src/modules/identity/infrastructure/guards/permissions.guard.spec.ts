import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from '@/shared/common/enums/permission.enum';
import { Role } from '@/shared/common/enums/role.enum';
import { IS_PUBLIC_KEY } from '@/shared/common/decorators/public.decorator';
import { PERMISSIONS_KEY } from '@/shared/common/decorators/require-permissions.decorator';
import type { PermissionsService } from '@/modules/identity/application/permissions.service';

describe('PermissionsGuard', () => {
  
  function makeContext(user?: { role: Role }): ExecutionContext {
    return {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  function makeReflector(metadata: {
    [IS_PUBLIC_KEY]?: boolean;
    [PERMISSIONS_KEY]?: Permission[];
  }): Reflector {
    return {
      getAllAndOverride: (key: string) => metadata[key as keyof typeof metadata],
    } as unknown as Reflector;
  }

  function makeService(granted: Permission[]): PermissionsService {
    return {
      getPermissionsForRole: jest.fn().mockResolvedValue(new Set(granted)),
    } as unknown as PermissionsService;
  }

  it('cho qua route @Public() ma khong tra quyen', async () => {
    const service = makeService([]);
    const guard = new PermissionsGuard(
      makeReflector({ [IS_PUBLIC_KEY]: true, [PERMISSIONS_KEY]: [Permission.CUSTOMER_CREATE] }),
      service,
    );

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    
    expect(service.getPermissionsForRole).not.toHaveBeenCalled();
  });

  it('cho qua route khong khai bao quyen nao', async () => {
    const guard = new PermissionsGuard(makeReflector({}), makeService([]));
    await expect(guard.canActivate(makeContext({ role: Role.STAFF }))).resolves.toBe(true);
  });

  it('cho qua khi co du moi quyen duoc yeu cau', async () => {
    const guard = new PermissionsGuard(
      makeReflector({ [PERMISSIONS_KEY]: [Permission.CUSTOMER_VIEW, Permission.PET_VIEW] }),
      makeService([Permission.CUSTOMER_VIEW, Permission.PET_VIEW, Permission.INVOICE_VIEW]),
    );

    await expect(guard.canActivate(makeContext({ role: Role.RECEPTIONIST }))).resolves.toBe(true);
  });

  it('tu choi khi thieu MOT trong nhieu quyen (khong phai "co mot la du")', async () => {
    const guard = new PermissionsGuard(
      makeReflector({ [PERMISSIONS_KEY]: [Permission.CUSTOMER_VIEW, Permission.INVOICE_VIEW] }),
      makeService([Permission.CUSTOMER_VIEW]),
    );

    await expect(guard.canActivate(makeContext({ role: Role.DOCTOR }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('tu choi khi chua co request.user, ke ca khi guard chay truoc JwtAuthGuard', async () => {
    const guard = new PermissionsGuard(
      makeReflector({ [PERMISSIONS_KEY]: [Permission.CUSTOMER_VIEW] }),
      makeService([Permission.CUSTOMER_VIEW]),
    );

    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(ForbiddenException);
  });

  it('khong tiet lo ten quyen con thieu trong thong bao loi', async () => {
    const guard = new PermissionsGuard(
      makeReflector({ [PERMISSIONS_KEY]: [Permission.ROLE_MANAGE] }),
      makeService([]),
    );

    await expect(guard.canActivate(makeContext({ role: Role.STAFF }))).rejects.toThrow(

      /Bạn không có quyền thực hiện thao tác này/,
    );
  });

  it('tu choi vai tro khong co dong nao trong ma tran (PET_OWNER)', async () => {
    const guard = new PermissionsGuard(
      makeReflector({ [PERMISSIONS_KEY]: [Permission.CUSTOMER_VIEW] }),
      makeService([]), 
    );

    await expect(guard.canActivate(makeContext({ role: Role.PET_OWNER }))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
