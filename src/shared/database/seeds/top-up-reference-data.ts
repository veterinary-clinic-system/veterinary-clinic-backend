import 'reflect-metadata';
import { config } from 'dotenv';
import { IsNull } from 'typeorm';
import dataSource from '../data-source';
import { Breed, Doctor, Species } from '../entity-registry';
import { SPECIES_CATALOG, DOCTOR_AVATAR_FILES } from './reference-data';

config();

async function topUp(): Promise<void> {
  await dataSource.initialize();
  console.log('Đã kết nối. Đang bổ sung dữ liệu tham chiếu...');

  const speciesRepo = dataSource.getRepository(Species);
  const breedRepo = dataSource.getRepository(Breed);
  const doctorRepo = dataSource.getRepository(Doctor);

  let newSpecies = 0;
  let newBreeds = 0;

  for (const entry of SPECIES_CATALOG) {
    let species = await speciesRepo.findOne({ where: { speciesName: entry.name } });
    if (!species) {
      species = await speciesRepo.save({ speciesName: entry.name });
      newSpecies += 1;
    }

    const existing = await breedRepo.find({ where: { speciesId: species.id } });
    const existingNames = new Set(existing.map((breed) => breed.breedName));

    const missing = entry.breeds
      .filter((breedName) => !existingNames.has(breedName))
      .map((breedName) => ({ breedName, speciesId: species!.id }));

    if (missing.length > 0) {
      await breedRepo.save(missing);
      newBreeds += missing.length;
    }
  }

  const doctorsWithoutAvatar = await doctorRepo.find({
    where: { avatarUrl: IsNull() },
    order: { createdAt: 'ASC' },
  });
  for (const [index, doctor] of doctorsWithoutAvatar.entries()) {
    await doctorRepo.update(doctor.id, {
      avatarUrl: DOCTOR_AVATAR_FILES[index % DOCTOR_AVATAR_FILES.length],
    });
  }

  console.log(
    `Xong: thêm ${newSpecies} loài, ${newBreeds} giống, ` +
      `gán ảnh minh hoạ cho ${doctorsWithoutAvatar.length} bác sĩ.`,
  );

  await dataSource.destroy();
}

topUp().catch((error) => {
  console.error('Bổ sung dữ liệu thất bại:', error);
  process.exit(1);
});
