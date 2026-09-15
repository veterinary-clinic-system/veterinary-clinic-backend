import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { assertCustomerCanOwnPets } from '@/modules/identity/domain/entities/customer-status';
import { Breed } from '@/modules/pets/domain/entities/breed.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Role } from '@/shared/common/enums/role.enum';
import { CreatePetInlineDto } from '@/modules/scheduling/presentation/dto/create-pet-inline.dto';

export interface ResolvePetInput {
  petId?: string;
  newPet?: CreatePetInlineDto;
}

@Injectable()
export class PartyResolverService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Pet) private readonly petsRepository: Repository<Pet>,
    @InjectRepository(Breed) private readonly breedsRepository: Repository<Breed>,
  ) {}

  async resolveOwner(phone: string, fullName?: string, email?: string): Promise<User> {
    const existing = await this.usersRepository.findOne({ where: { phone } });
    if (existing) {

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

  async lookupOwnerForBooking(phone: string): Promise<{ found: boolean; fullName?: string }> {
    const existing = await this.usersRepository.findOne({
      where: { phone, role: Role.PET_OWNER },
      select: { id: true, fullName: true, active: true },
    });

    if (!existing || !existing.active) {
      return { found: false };
    }
    return { found: true, fullName: existing.fullName };
  }

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

    assertCustomerCanOwnPets(owner);

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
