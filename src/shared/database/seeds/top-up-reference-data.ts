import 'reflect-metadata';
import { config } from 'dotenv';
import { IsNull } from 'typeorm';
import dataSource from '../data-source';
import { Breed, Doctor, Species } from '../entity-registry';
import { SPECIES_CATALOG, DOCTOR_AVATAR_FILES } from './reference-data';

config();

/**
 * Bo sung du lieu THAM CHIEU vao mot CSDL DA CO du lieu - khong xoa gi.
 *
 * Vi sao khong dung `npm run seed`: script do dung mot lan tren CSDL trong, chay lai la
 * nhan doi chi nhanh, nhan vien, lich hen... Nhung phan hoi nghiem thu ("du lieu ve cac
 * loai, giong hoi it", "may cai avatar do nhin ki qua") lai la thu phai vao duoc mot he
 * thong dang chay ma khong mat du lieu demo.
 *
 * Chay: npm run seed:top-up
 *
 * An toan khi chay nhieu lan:
 *   - Loai/giong doi chieu theo TEN, da co thi bo qua.
 *   - Anh bac si chi dien vao nguoi DANG de trong (`avatar_url IS NULL`), khong ghi de
 *     anh that ma phong kham da tai len.
 */
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

  // Anh minh hoa nam trong `veterinary-clinic-web/public/doctors/`. Chia deu theo thu
  // tu tao ho so de hai bac si canh nhau khong trung mot hinh.
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
