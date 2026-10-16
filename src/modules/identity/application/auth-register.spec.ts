import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Role } from '@/shared/common/enums/role.enum';

describe('AuthService.registerPetOwner - khong cho dang ky de len tai khoan da co', () => {
  function makeService(existing: Record<string, unknown> | null) {
    const qb = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(existing),
    };
    const usersRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      create: jest.fn((data) => ({ id: 'user-new', ...data })),
      save: jest.fn(async (u) => u),
    };
    const service = new AuthService(
      usersRepository as never,
      null as never,
      null as never,
      null as never,
      null as never,
    );
    const issueTokenPair = jest
      .spyOn(service as never as { issueTokenPair: () => unknown }, 'issueTokenPair')
      .mockResolvedValue({ accessToken: 'a', refreshToken: 'r' } as never);
    return { service, usersRepository, qb, issueTokenPair };
  }

  const dto = { phone: '0911111111', password: 'Moi@12345', fullName: 'Ke la' };

  it('doc ca passwordHash (cot select:false) khi tim theo so dien thoai', async () => {
    const { service, qb } = makeService(null);
    await service.registerPetOwner(dto as never);
    expect(qb.addSelect).toHaveBeenCalledWith('user.passwordHash');
  });

  it('tu choi khi so dien thoai da co mat khau', async () => {
    const { service, usersRepository } = makeService({
      id: 'u1',
      phone: dto.phone,
      role: Role.PET_OWNER,
      passwordHash: '$2b$12$hash',
    });
    await expect(service.registerPetOwner(dto as never)).rejects.toBeInstanceOf(ConflictException);
    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('tu choi khi so dien thoai thuoc tai khoan nhan vien chua dat mat khau', async () => {
    const { service, usersRepository } = makeService({
      id: 'u2',
      phone: dto.phone,
      role: Role.DOCTOR,
      passwordHash: null,
    });
    await expect(service.registerPetOwner(dto as never)).rejects.toBeInstanceOf(ConflictException);
    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('cho chu nuoi vang lai (chua co mat khau) nhan lai ho so cua minh', async () => {
    const walkIn = { id: 'u3', phone: dto.phone, role: Role.PET_OWNER, passwordHash: null };
    const { service, usersRepository } = makeService(walkIn);
    await service.registerPetOwner(dto as never);
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u3', fullName: 'Ke la', passwordHash: expect.any(String) }),
    );
  });

  it('tao tai khoan moi khi so dien thoai chua ton tai', async () => {
    const { service, usersRepository } = makeService(null);
    await service.registerPetOwner(dto as never);
    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ phone: dto.phone, role: Role.PET_OWNER }),
    );
  });
});
