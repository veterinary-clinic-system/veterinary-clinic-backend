import { ForbiddenException } from '@nestjs/common';
import { Role } from '@/shared/common/enums/role.enum';
import { PetsController } from './pets.controller';

describe('PetsController owner health record', () => {
  const actor = {
    userId: 'owner-id',
    phone: '0900000000',
    role: Role.PET_OWNER,
    branchId: null,
  };

  function createController() {
    const petsService = {
      findOneForActor: jest.fn().mockResolvedValue({ id: 'pet-id', ownerId: actor.userId }),
    };
    const petProfileService = {
      findMedicalHistory: jest.fn().mockResolvedValue(['history']),
      findPrescriptions: jest.fn().mockResolvedValue(['prescription']),
      findLabTests: jest.fn().mockResolvedValue(['lab']),
      findInvoices: jest.fn().mockResolvedValue(['invoice']),
      findVaccinations: jest.fn().mockResolvedValue(['vaccination']),
    };
    const controller = new PetsController(petsService as never, petProfileService as never);
    return { controller, petsService, petProfileService };
  }

  it('verifies ownership before returning all owner-visible health data', async () => {
    const { controller, petsService, petProfileService } = createController();

    await expect(controller.findMyPetHealthRecord('pet-id', actor)).resolves.toEqual({
      medicalHistory: ['history'],
      prescriptions: ['prescription'],
      labTests: ['lab'],
      invoices: ['invoice'],
      vaccinations: ['vaccination'],
    });
    expect(petsService.findOneForActor).toHaveBeenCalledWith('pet-id', actor);
    expect(petProfileService.findMedicalHistory).toHaveBeenCalledWith('pet-id', {
      completedOnly: true,
    });
    expect(petProfileService.findPrescriptions).toHaveBeenCalledWith('pet-id', {
      completedOnly: true,
    });
    expect(petProfileService.findLabTests).toHaveBeenCalledWith('pet-id', {
      completedOnly: true,
    });
    expect(petProfileService.findVaccinations).toHaveBeenCalledWith('pet-id');
  });

  it('does not query health data when the pet belongs to another owner', async () => {
    const { controller, petsService, petProfileService } = createController();
    petsService.findOneForActor.mockRejectedValueOnce(new ForbiddenException());

    await expect(controller.findMyPetHealthRecord('other-pet-id', actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(petProfileService.findMedicalHistory).not.toHaveBeenCalled();
    expect(petProfileService.findPrescriptions).not.toHaveBeenCalled();
    expect(petProfileService.findLabTests).not.toHaveBeenCalled();
    expect(petProfileService.findInvoices).not.toHaveBeenCalled();
    expect(petProfileService.findVaccinations).not.toHaveBeenCalled();
  });
});
