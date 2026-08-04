import { BadRequestException, ConflictException } from '@nestjs/common';
import { User } from './user.entity';

/**
 * BR-02 - "Mot pet phai thuoc it nhat mot customer dang hoat dong."
 *
 * Luat nay duoc kiem o BA cua vao he thong (them thu cung tai quay, dat lich online,
 * tiep nhan khach vang lai) nen phai co dung MOT ban - neu khong, thong bao se lech
 * nhau va som muon co cua bi bo sot.
 *
 * Dat trong `domain/entities/` co ly do ky thuat: ranh gioi module cua ESLint
 * (`import/no-restricted-paths`) chi cho module khac import `identity/domain/entities/*`
 * va barrel `identity/application`. Day la mot luat cua chinh thuc the `User` nen no
 * nam canh `user.entity.ts` thay vi bi day vao barrel application.
 *
 * Pham vi: chi chan viec TAO MOI / GAN MOI. Ho so thu cung da ton tai cua mot khach da
 * ngung hoat dong van phai tra cuu va xem duoc binh thuong - he thong khong khoa du
 * lieu cu (xem `CustomersService.deactivate`).
 */
export function assertCustomerCanOwnPets(owner: User | null): User {
  if (!owner) {
    throw new BadRequestException('Không tìm thấy khách hàng');
  }
  if (!owner.active) {
    throw new ConflictException(
      `Khách hàng "${owner.fullName}" đang ở trạng thái ngưng hoạt động - vui lòng kích hoạt lại hồ sơ khách trước khi thêm hoặc chuyển thú cưng.`,
    );
  }
  return owner;
}
