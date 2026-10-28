import { PickType } from '@nestjs/swagger';
import { CreatePetDto } from './create-pet.dto';
import { UpdatePetDto } from './update-pet.dto';

/**
 * Trường chủ nuôi tự khai được. Không có `ownerId` (luôn là người đang đăng nhập) và các
 * trường do phòng khám ghi nhận: microchip, ghi chú, bệnh mãn tính. `whitelist` của
 * ValidationPipe bỏ mọi trường khác mà client gửi kèm.
 */
const OWNER_EDITABLE_FIELDS = [
  'name',
  'speciesId',
  'breedId',
  'gender',
  'weight',
  'birthDate',
  'color',
  'avatarUrl',
  'allergies',
] as const;

export class CreateOwnerPetDto extends PickType(CreatePetDto, OWNER_EDITABLE_FIELDS) {}

export class UpdateOwnerPetDto extends PickType(UpdatePetDto, OWNER_EDITABLE_FIELDS) {}
