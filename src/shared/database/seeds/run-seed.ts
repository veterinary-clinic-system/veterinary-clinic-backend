import 'reflect-metadata';
import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';
import dataSource from '../data-source';
import {
  Appointment,
  Branch,
  Breed,
  Diagnosis,
  Disease,
  Doctor,
  DoctorShift,
  Examination,
  InventoryBatch,
  InventoryItem,
  Invoice,
  InvoiceItem,
  Item,
  MedicalRecord,
  Medication,
  OperatingHour,
  Pet,
  PreScreeningResult,
  Prescription,
  PrescriptionItem,
  Service,
  Species,
  Treatment,
  User,
  Vaccine,
} from '../entity-registry';
import { Role } from '@/shared/common/enums/role.enum';
import { Specialization } from '@/shared/common/enums/specialization.enum';
import { Gender } from '@/shared/common/enums/gender.enum';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { CommonSymptom } from '@/shared/common/enums/common-symptom.enum';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { AppointmentStatus } from '@/shared/common/enums/appointment-status.enum';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import {
  DiagnosisSeverity,
  MedicalRecordStatus,
} from '@/shared/common/enums/medical-record-status.enum';

config();

const BCRYPT_ROUNDS = 12;
const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri (JS Date#getDay()) - Section 5.1: closed Sat/Sun.

/**
 * Idempotent-ish demo seed for `docker compose up` + `npm run migration:run` +
 * `npm run seed` (Section 4.2: "populate a reasonable amount of realistic seed data...
 * so the system is demoable immediately"). Not fully idempotent (re-running inserts
 * duplicate rows for anything without a unique constraint) - intended to run once
 * against a freshly-migrated, empty database.
 */
async function seed() {
  await dataSource.initialize();
  console.log('Connected. Seeding...');

  // ---------------------------------------------------------------- Species / Breeds
  const dog = await dataSource.getRepository(Species).save({ speciesName: 'Chó' });
  const cat = await dataSource.getRepository(Species).save({ speciesName: 'Mèo' });
  const breedRepo = dataSource.getRepository(Breed);
  const [poodle, corgi, golden, britishShorthair, persian] = await breedRepo.save([
    { breedName: 'Poodle', speciesId: dog.id },
    { breedName: 'Corgi', speciesId: dog.id },
    { breedName: 'Golden Retriever', speciesId: dog.id },
    { breedName: 'British Shorthair', speciesId: cat.id },
    { breedName: 'Mèo Ba Tư (Persian)', speciesId: cat.id },
  ]);

  // ---------------------------------------------------------------------- Branches
  const branchRepo = dataSource.getRepository(Branch);
  const [branch1, branch2] = await branchRepo.save([
    {
      branchName: 'Phòng khám thú y Quận 1',
      phone: '028 3822 1111',
      description: 'Chi nhánh trung tâm, chuyên khám tổng quát và ngoại khoa.',
      address: '12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    },
    {
      branchName: 'Phòng khám thú y Quận 7',
      phone: '028 3822 2222',
      description: 'Chi nhánh khu Nam Sài Gòn, chuyên da liễu và dinh dưỡng thú cưng.',
      address: '456 Nguyễn Thị Thập, Quận 7, TP. Hồ Chí Minh',
    },
  ]);

  const operatingHourRepo = dataSource.getRepository(OperatingHour);
  for (const branch of [branch1, branch2]) {
    const rows: Partial<OperatingHour>[] = [];
    for (const dayOfWeek of WEEKDAYS) {
      rows.push({ branchId: branch.id, dayOfWeek, openTime: '07:00', closeTime: '11:00' });
      rows.push({ branchId: branch.id, dayOfWeek, openTime: '13:30', closeTime: '17:30' });
    }
    await operatingHourRepo.save(rows);
  }

  // -------------------------------------------------------------- Admin / Receptionist
  const userRepo = dataSource.getRepository(User);
  const adminPasswordHash = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
    BCRYPT_ROUNDS,
  );
  await userRepo.save({
    phone: '0900000001',
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@vetclinic.local',
    fullName: 'Quản trị viên hệ thống',
    passwordHash: adminPasswordHash,
    role: Role.ADMIN,
    branchId: null,
  });

  const staffPasswordHash = await bcrypt.hash('Staff@12345', BCRYPT_ROUNDS);
  await userRepo.save([
    {
      phone: '0900000002',
      email: 'letan.q1@vetclinic.local',
      fullName: 'Nguyễn Thị Lễ Tân',
      passwordHash: staffPasswordHash,
      role: Role.RECEPTIONIST,
      branchId: branch1.id,
    },
    {
      phone: '0900000003',
      email: 'letan.q7@vetclinic.local',
      fullName: 'Trần Thị Hồng',
      passwordHash: staffPasswordHash,
      role: Role.RECEPTIONIST,
      branchId: branch2.id,
    },
    // Duoc si - them o P7. Quay thuoc la vai tro DUY NHAT duoc cap phat thuoc
    // (`PRESCRIPTION_DISPENSE`), nen khong co tai khoan nay thi khong ai thu duoc man
    // hinh quay thuoc ngoai ADMIN - ma ADMIN co toan quyen nen khong the tay the
    // kiem tra cheo giua nguoi ke va nguoi cap.
    {
      phone: '0900000004',
      email: 'duocsi.q1@vetclinic.local',
      fullName: 'Đỗ Thị Dược',
      passwordHash: staffPasswordHash,
      role: Role.PHARMACIST,
      branchId: branch1.id,
    },
  ]);

  // -------------------------------------------------------------------------- Doctors
  const doctorRepo = dataSource.getRepository(Doctor);
  const shiftRepo = dataSource.getRepository(DoctorShift);

  const doctorSeeds = [
    {
      phone: '0900000010',
      fullName: 'BS. Lê Văn An',
      branch: branch1,
      yearOfStart: 2015,
      specialization: [Specialization.GENERAL_PRACTICE, Specialization.SURGERY],
    },
    {
      phone: '0900000011',
      fullName: 'BS. Phạm Thị Bích',
      branch: branch1,
      yearOfStart: 2018,
      specialization: [Specialization.DERMATOLOGY, Specialization.NUTRITION],
    },
    {
      phone: '0900000012',
      fullName: 'BS. Trần Minh Cường',
      branch: branch2,
      yearOfStart: 2012,
      specialization: [Specialization.INTERNAL_MEDICINE, Specialization.DIAGNOSTIC_IMAGING],
    },
    {
      phone: '0900000013',
      fullName: 'BS. Võ Thị Diễm',
      branch: branch2,
      yearOfStart: 2020,
      specialization: [Specialization.THERIOGENOLOGY, Specialization.DENTISTRY],
    },
  ];

  const doctors: Doctor[] = [];
  for (const seedDoctor of doctorSeeds) {
    const user = await userRepo.save({
      phone: seedDoctor.phone,
      email: `${seedDoctor.phone}@vetclinic.local`,
      fullName: seedDoctor.fullName,
      passwordHash: staffPasswordHash,
      role: Role.DOCTOR,
      branchId: seedDoctor.branch.id,
    });
    const doctor = await doctorRepo.save({
      userId: user.id,
      branchId: seedDoctor.branch.id,
      fullName: seedDoctor.fullName,
      yearOfStart: seedDoctor.yearOfStart,
      specialization: seedDoctor.specialization,
      avatarUrl: null,
    });
    doctors.push(doctor);

    const shiftRows: Partial<DoctorShift>[] = WEEKDAYS.map((dayOfWeek) => ({
      doctorId: doctor.id,
      dayOfWeek,
      startTime: '07:00',
      endTime: '17:30',
    }));
    await shiftRepo.save(shiftRows);
  }

  // ------------------------------------------------------------------------ Catalog
  const itemRepo = dataSource.getRepository(Item);
  const serviceRepo = dataSource.getRepository(Service);
  const medicationRepo = dataSource.getRepository(Medication);

  const serviceSeeds = [
    {
      name: 'Khám tổng quát',
      describe: 'Khám sức khỏe định kỳ, tư vấn chung',
      price: 150_000,
      minutes: 30,
    },
    {
      name: 'Khám da liễu',
      describe: 'Khám và tư vấn các bệnh về da, dị ứng',
      price: 200_000,
      minutes: 30,
    },
    {
      name: 'Tiêm phòng dại',
      describe: 'Tiêm vắc-xin phòng bệnh dại',
      price: 120_000,
      minutes: 30,
    },
    {
      name: 'Phẫu thuật nhỏ',
      describe: 'Tiểu phẫu, khâu vết thương, triệt sản nhỏ',
      price: 800_000,
      minutes: 60,
    },
    {
      name: 'Siêu âm chẩn đoán hình ảnh',
      describe: 'Siêu âm ổ bụng, chẩn đoán hình ảnh',
      price: 300_000,
      minutes: 30,
    },
  ];

  const services: Service[] = [];
  for (const s of serviceSeeds) {
    const item = await itemRepo.save({
      itemName: s.name,
      describe: s.describe,
      itemType: ItemType.SERVICE,
      unitPrice: s.price,
    });
    services.push(
      await serviceRepo.save({
        itemId: item.id,
        item,
        durationMinutes: s.minutes,
        requiresSpecialization: null,
      }),
    );
  }

  const medicationSeeds = [
    { name: 'Amoxicillin 250mg', unit: 'viên', price: 3_000 },
    { name: 'Meloxicam (kháng viêm)', unit: 'ml', price: 15_000 },
    { name: 'Vitamin tổng hợp cho thú cưng', unit: 'viên', price: 2_000 },
    { name: 'Thuốc nhỏ tai trị viêm', unit: 'lọ', price: 45_000 },
    { name: 'Men tiêu hóa (Probiotics)', unit: 'gói', price: 5_000 },
  ];

  const medications: Medication[] = [];
  for (const m of medicationSeeds) {
    const item = await itemRepo.save({
      itemName: m.name,
      itemType: ItemType.MEDICATION,
      unitPrice: m.price,
    });
    medications.push(
      await medicationRepo.save({ itemId: item.id, item, unit: m.unit, activeIngredient: null }),
    );
  }

  // Vaccine (P9-T1) - danh muc tiem chung. `speciesApplicable` rong o vaccine dai vi no
  // dung cho moi loai; hai cai con lai gan dich danh cho va meo.
  const vaccineRepo = dataSource.getRepository(Vaccine);
  const vaccineSeeds = [
    {
      name: 'Vaccine dại (Rabisin)',
      disease: 'Bệnh dại',
      price: 120_000,
      doseCount: 1,
      intervalDays: null,
      boosterIntervalDays: 365,
      species: [] as Species[],
    },
    {
      name: 'Vaccine 5 bệnh cho chó (DHPPi-L)',
      disease: 'Care, Parvo, Viêm gan, Ho cũi, Lepto',
      price: 250_000,
      doseCount: 3,
      intervalDays: 21,
      boosterIntervalDays: 365,
      species: [dog],
    },
    {
      name: 'Vaccine 4 bệnh cho mèo (FVRCP)',
      disease: 'Giảm bạch cầu, Viêm mũi khí quản, Calici, Chlamydia',
      price: 230_000,
      doseCount: 2,
      intervalDays: 28,
      boosterIntervalDays: 365,
      species: [cat],
    },
  ];
  for (const v of vaccineSeeds) {
    const item = await itemRepo.save({
      itemName: v.name,
      itemType: ItemType.VACCINE,
      unitPrice: v.price,
    });
    await vaccineRepo.save({
      itemId: item.id,
      item,
      diseasePrevented: v.disease,
      doseCount: v.doseCount,
      intervalDays: v.intervalDays,
      boosterIntervalDays: v.boosterIntervalDays,
      speciesApplicable: v.species,
      minimumStock: 5,
    });
  }

  const inventoryRepo = dataSource.getRepository(InventoryItem);
  const batchRepo = dataSource.getRepository(InventoryBatch);
  const allItems = await itemRepo.find();
  for (const branch of [branch1, branch2]) {
    const inventoryItems = await inventoryRepo.save(
      allItems.map((item) => ({ itemId: item.id, branchId: branch.id, inventoryQuantity: 50 })),
    );
    // MOT LO CHO MOI DONG TON. Truoc P9 seed chi ghi `inventory_quantity` va bo trong
    // `inventory_batches`, tuc la vi pham quyet dinh (B) cua P6: so tong la ban cache cua
    // SUM(batches.quantity). Hau qua khong lo ra ngay - man hinh kho van hien 50 - nhung
    // FEFO khong tim thay lo nao de xuat, nen cap phat thuoc, ban POS va tiem vaccine tren
    // du lieu seed deu bao "khong du ton kho" du so tren man hinh la 50.
    await batchRepo.save(
      inventoryItems.map((inventoryItem) => ({
        inventoryItemId: inventoryItem.id,
        batchNo: 'SEED-001',
        // Han dung con xa: lo seed khong duoc phep het han giua ky demo, va cung khong
        // duoc "khong han" - de con cho ma kiem thu BR-11 nhin thay mot ngay that.
        expiryDate: '2028-12-31',
        quantity: 50,
        costPrice: 0,
      })),
    );
  }

  // ------------------------------------------------------------------------ Diseases
  const diseaseRepo = dataSource.getRepository(Disease);
  const diseases = await diseaseRepo.save([
    { diseaseName: 'Dị ứng da', commonSymptoms: [CommonSymptom.SKIN_ALLERGY] },
    { diseaseName: 'Viêm tai', commonSymptoms: [CommonSymptom.EAR_INFECTION] },
    {
      diseaseName: 'Viêm dạ dày ruột',
      commonSymptoms: [CommonSymptom.VOMITING, CommonSymptom.DIARRHEA],
    },
    { diseaseName: 'Nhiễm trùng đường tiết niệu', commonSymptoms: [CommonSymptom.HEMATURIA] },
    { diseaseName: 'Khám định kỳ', commonSymptoms: [] },
  ]);

  // ------------------------------------------------------------------- Pet owners + pets
  const ownerPasswordHash = await bcrypt.hash('Owner@12345', BCRYPT_ROUNDS);
  const ownerSeeds = [
    { phone: '0911111111', fullName: 'Nguyễn Văn Bình', email: 'binh.nguyen@example.com' },
    { phone: '0911111112', fullName: 'Trần Thị Cẩm', email: 'cam.tran@example.com' },
    { phone: '0911111113', fullName: 'Lê Hoàng Dũng', email: null },
  ];
  const owners: User[] = [];
  for (const o of ownerSeeds) {
    owners.push(
      await userRepo.save({
        phone: o.phone,
        email: o.email,
        fullName: o.fullName,
        passwordHash: ownerPasswordHash,
        role: Role.PET_OWNER,
      }),
    );
  }

  const petRepo = dataSource.getRepository(Pet);
  const pets = await petRepo.save([
    {
      name: 'Milo',
      breedId: poodle.id,
      gender: Gender.MALE,
      weight: 6.2,
      ownerId: owners[0].id,
      allergies: ['Phấn hoa'],
      chronicConditions: [],
    },
    {
      name: 'Luna',
      breedId: britishShorthair.id,
      gender: Gender.FEMALE,
      weight: 3.8,
      ownerId: owners[0].id,
      allergies: [],
      chronicConditions: [],
    },
    {
      name: 'Kobi',
      breedId: corgi.id,
      gender: Gender.MALE,
      weight: 9.5,
      ownerId: owners[1].id,
      allergies: [],
      chronicConditions: ['Viêm khớp nhẹ'],
    },
    {
      name: 'Mimi',
      breedId: persian.id,
      gender: Gender.FEMALE,
      weight: 4.1,
      ownerId: owners[2].id,
      allergies: [],
      chronicConditions: [],
    },
    {
      name: 'Rex',
      breedId: golden.id,
      gender: Gender.MALE,
      weight: 28,
      ownerId: owners[1].id,
      allergies: [],
      chronicConditions: [],
    },
  ]);

  // ------------------------------------------------------------------- Appointments
  const appointmentRepo = dataSource.getRepository(Appointment);
  const preScreeningRepo = dataSource.getRepository(PreScreeningResult);
  const medicalRecordRepo = dataSource.getRepository(MedicalRecord);
  const examinationRepo = dataSource.getRepository(Examination);
  const diagnosisRepo = dataSource.getRepository(Diagnosis);
  const treatmentRepo = dataSource.getRepository(Treatment);
  const prescriptionRepo = dataSource.getRepository(Prescription);
  const prescriptionItemRepo = dataSource.getRepository(PrescriptionItem);
  const invoiceRepo = dataSource.getRepository(Invoice);

  function atTime(daysFromNow: number, hhmm: string): Date {
    const [h, m] = hhmm.split(':').map(Number);
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(h, m, 0, 0);
    return date;
  }

  /** Cot `date` cua Postgres (vi du `treatments.start_date`) nhan chuoi `YYYY-MM-DD`. */
  function toDateOnly(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  // A completed visit from a few days ago, with a full exam + prescription + paid invoice.
  const pastAppointment = await appointmentRepo.save({
    doctorId: doctors[0].id,
    branchId: branch1.id,
    petId: pets[0].id,
    serviceId: services[1].id, // Khám da liễu
    startAt: atTime(-3, '09:00'),
    endAt: atTime(-3, '09:30'),
    status: AppointmentStatus.COMPLETED,
    priorityColor: PriorityColor.GREEN,
    commonSymptoms: [CommonSymptom.SKIN_ALLERGY],
    otherSymptoms: 'Ngứa da, rụng lông vùng lưng',
    photoUrls: [],
  });
  await preScreeningRepo.save({
    appointmentId: pastAppointment.id,
    symptomText: 'Ngứa da, rụng lông vùng lưng',
    aiSuspectedDiseaseGroups: [diseases[0]],
    aiPriorityColor: PriorityColor.GREEN,
    extractedSymptomKeywords: ['ngứa da', 'rụng lông'],
    nlpConfidence: 0.72,
    cvConfidence: null,
    overallConfidence: 0.72,
    rawAiResponse: null,
  });
  // Ho so benh an (P4) la lop boc ngoai: phieu kham la phan sinh hieu, con chan doan /
  // dieu tri / don thuoc / xet nghiem deu treo duoi ho so.
  const pastRecord = await medicalRecordRepo.save({
    appointmentId: pastAppointment.id,
    petId: pets[0].id,
    doctorId: doctors[0].id,
    visitReason: 'Ngứa da, rụng lông vùng lưng',
    generalCondition: 'Tỉnh táo, ăn uống bình thường',
    notes: 'Theo dõi thêm 1 tuần, tái khám nếu không cải thiện.',
    status: MedicalRecordStatus.COMPLETED,
    completedAt: atTime(-3, '09:30'),
  });
  await examinationRepo.save({
    appointmentId: pastAppointment.id,
    medicalRecordId: pastRecord.id,
    doctorId: doctors[0].id,
    diseaseGroups: ['Dị ứng da'],
    diagnosisText: 'Viêm da dị ứng nhẹ, nghi do phấn hoa.',
    notes: 'Theo dõi thêm 1 tuần, tái khám nếu không cải thiện.',
    temperatureCelsius: 38.5,
    weightKg: 6.2,
    heartRateBpm: 110,
    respiratoryRateBpm: 24,
    attachmentUrls: [],
  });
  await diagnosisRepo.save({
    medicalRecordId: pastRecord.id,
    diseaseId: diseases[0].id,
    diagnosisText: 'Viêm da dị ứng nhẹ, nghi do phấn hoa.',
    severity: DiagnosisSeverity.MILD,
    isPrimary: true,
  });
  await treatmentRepo.save({
    medicalRecordId: pastRecord.id,
    method: 'Bôi thuốc ngoài da',
    description: 'Vệ sinh vùng da tổn thương, bôi kem kháng viêm 2 lần/ngày.',
    startDate: toDateOnly(atTime(-3, '09:00')),
    endDate: toDateOnly(atTime(4, '09:00')),
    instruction: 'Không để thú cưng liếm vùng bôi thuốc trong 30 phút sau khi bôi.',
  });
  const pastPrescription = await prescriptionRepo.save({
    medicalRecordId: pastRecord.id,
    notes: 'Uống sau ăn',
  });
  await prescriptionItemRepo.save({
    prescriptionId: pastPrescription.id,
    medicationId: medications[1].id,
    dosage: '1 lần/ngày',
    durationDays: 5,
    instructions: 'Uống buổi sáng sau ăn',
  });
  const pastInvoice = await invoiceRepo.save({
    appointmentId: pastAppointment.id,
    paymentMethod: PaymentMethod.CASH,
    paid: true,
    paidAt: atTime(-3, '09:35'),
  });
  await dataSource.getRepository(InvoiceItem).save([
    { invoiceId: pastInvoice.id, itemId: services[1].item.id, price: 200_000, quantity: 1 },
    { invoiceId: pastInvoice.id, itemId: medications[1].item.id, price: 15_000, quantity: 5 },
  ]);

  // An urgent (RED) walk-in from yesterday, completed, to show the triage queue in action.
  const urgentAppointment = await appointmentRepo.save({
    doctorId: doctors[2].id,
    branchId: branch2.id,
    petId: pets[4].id,
    serviceId: services[3].id, // Phẫu thuật nhỏ
    startAt: atTime(-1, '08:00'),
    endAt: atTime(-1, '09:00'),
    status: AppointmentStatus.COMPLETED,
    priorityColor: PriorityColor.RED,
    commonSymptoms: [],
    otherSymptoms: 'Chấn thương nặng ở chân sau do tai nạn xe',
    photoUrls: [],
  });
  await preScreeningRepo.save({
    appointmentId: urgentAppointment.id,
    symptomText: 'Chấn thương nặng ở chân sau do tai nạn xe, chảy máu nhiều',
    aiSuspectedDiseaseGroups: [],
    aiPriorityColor: PriorityColor.RED,
    extractedSymptomKeywords: ['chấn thương nặng', 'chảy máu nhiều'],
    nlpConfidence: 0.91,
    cvConfidence: null,
    overallConfidence: 0.91,
    rawAiResponse: null,
  });

  // Upcoming appointments (PENDING/CONFIRMED) across different triage colors, for the calendar demo.
  await appointmentRepo.save([
    {
      doctorId: doctors[0].id,
      branchId: branch1.id,
      petId: pets[1].id,
      serviceId: services[0].id,
      startAt: atTime(1, '07:30'),
      endAt: atTime(1, '08:00'),
      status: AppointmentStatus.CONFIRMED,
      priorityColor: PriorityColor.BLUE,
      commonSymptoms: [],
      otherSymptoms: 'Khám sức khỏe định kỳ',
      photoUrls: [],
    },
    {
      doctorId: doctors[1].id,
      branchId: branch1.id,
      petId: pets[2].id,
      serviceId: services[1].id,
      startAt: atTime(2, '14:00'),
      endAt: atTime(2, '14:30'),
      status: AppointmentStatus.PENDING,
      priorityColor: PriorityColor.YELLOW,
      commonSymptoms: [CommonSymptom.VOMITING, CommonSymptom.LOSS_OF_APPETITE],
      otherSymptoms: null,
      photoUrls: [],
    },
    {
      doctorId: doctors[3].id,
      branchId: branch2.id,
      petId: pets[3].id,
      serviceId: services[2].id,
      startAt: atTime(3, '10:00'),
      endAt: atTime(3, '10:30'),
      status: AppointmentStatus.CONFIRMED,
      priorityColor: PriorityColor.GREEN,
      commonSymptoms: [CommonSymptom.EAR_INFECTION],
      otherSymptoms: null,
      photoUrls: [],
    },
  ]);

  console.log('Seed complete:');
  console.log(`  Branches: ${branch1.branchName}, ${branch2.branchName}`);
  console.log(
    `  Admin login: phone 0900000001 / password ${process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345'}`,
  );
  console.log('  Receptionist login: phone 0900000002 / password Staff@12345');
  console.log('  Doctor login: phone 0900000010 / password Staff@12345');
  console.log('  Pharmacist login: phone 0900000004 / password Staff@12345');
  console.log('  Pet owner login: phone 0911111111 / password Owner@12345');

  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
