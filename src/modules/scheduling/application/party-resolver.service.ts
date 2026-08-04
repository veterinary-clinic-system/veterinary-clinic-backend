import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { assertCustomerCanOwnPets } from '@/modules/identity/domain/entities/customer-status';
import { Breed } from '@/modules/pets/domain/entities/breed.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Role } from '@/shared/common/enums/role.enum';
import { CreatePetInlineDto } from '@/modules/scheduling/presentation/dto/create-pet-inline.dto';

/** Phan "ai va con nao" dung chung giua form dat lich va form khach vang lai. */
export interface ResolvePetInput {
  petId?: string;
  newPet?: CreatePetInlineDto;
}

/**
 * Giai quyet cap (chu nuoi, thu cung) tu du lieu mot bieu mau tiep nhan.
 *
 * Tach rieng vi CA HAI cua vao phong kham deu can dung mot luat: dat lich online
 * (`AppointmentsService.createBooking`) va tiep nhan khach vang lai tai quay
 * (`QueueService.createWalkIn`). Truoc khi co lop nay, luat "chua co tai khoan thi tu
 * tao mot PET_OWNER khong mat khau" chi ton tai trong mot ham private cua
 * AppointmentsService - nhan doi no sang QueueService se tao ra hai ban sao roi phan
 * hoa theo thoi gian.
 */
@Injectable()
export class PartyResolverService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Pet) private readonly petsRepository: Repository<Pet>,
    @InjectRepository(Breed) private readonly breedsRepository: Repository<Breed>,
  ) {}

  /**
   * Tim khach theo so dien thoai; chua co thi tu tao mot tai khoan PET_OWNER KHONG
   * mat khau (`passwordHash = null`) - khach van co the dat mat khau sau qua luong
   * dang ky binh thuong.
   */
  async resolveOwner(phone: string, fullName?: string, email?: string): Promise<User> {
    const existing = await this.usersRepository.findOne({ where: { phone } });
    if (existing) {
      // BR-02: khach da ngung hoat dong khong duoc gan them lich hen/luot kham moi.
      // Chan ngay tai day thay vi de di tiep roi hong o buoc sau - le tan can biet
      // phai kich hoat lai ho so khach truoc.
      return assertCustomerCanOwnPets(existing);
    }

    return this.usersRepository.save(
      this.usersRepository.create({
        phone,
        fullName: fullName ?? 'Khách hàng',
        email: email ?? null,
        role: Role.PET_OWNER,
        passwordHash: null,
      }),
    );
  }

  /**
   * Dung mot trong hai: `petId` (thu cung da co ho so) hoac `newPet` (lan dau den
   * kham). Ho so cu luon duoc kiem tra co thuc su thuoc ve chu nuoi vua giai quyet -
   * neu khong, mot nguoi doan duoc UUID co the gan lich hen len thu cung nguoi khac.
   */
  async resolvePet(input: ResolvePetInput, owner: User): Promise<Pet> {
    if (input.petId) {
      const pet = await this.petsRepository.findOne({ where: { id: input.petId } });
      if (!pet || pet.ownerId !== owner.id) {
        throw new BadRequestException('Thú cưng không thuộc về khách hàng này');
      }
      return pet;
    }

    if (!input.newPet) {
      throw new BadRequestException('Phải cung cấp petId hoặc newPet');
    }

    // BR-02 lan hai: `resolveOwner` da chan khach ngung hoat dong, nhung `resolvePet`
    // la ham cong khai - mot luong moi goi thang vao day van phai vap phai luat nay.
    assertCustomerCanOwnPets(owner);

    // Muc 16 SRS: giong phai ton tai va phai thuoc dung loai bieu mau da chon. Truoc
    // day `breedId` di thang xuong khoa ngoai - mot id sai se noi len thanh loi 500.
    const breed = await this.breedsRepository.findOne({ where: { id: input.newPet.breedId } });
    if (!breed) {
      throw new BadRequestException('Không tìm thấy giống thú cưng đã chọn');
    }
    if (input.newPet.speciesId && breed.speciesId !== input.newPet.speciesId) {
      throw new BadRequestException('Giống đã chọn không thuộc loài đã chọn');
    }

    return this.petsRepository.save(
      this.petsRepository.create({
        name: input.newPet.name,
        breedId: input.newPet.breedId,
        gender: input.newPet.gender,
        weight: input.newPet.weight ?? null,
        birthDate: input.newPet.birthDate ?? null,
        ownerId: owner.id,
      }),
    );
  }
}
