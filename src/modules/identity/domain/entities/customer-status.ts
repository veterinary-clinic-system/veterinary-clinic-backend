import { BadRequestException, ConflictException } from '@nestjs/common';
import { User } from './user.entity';

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
