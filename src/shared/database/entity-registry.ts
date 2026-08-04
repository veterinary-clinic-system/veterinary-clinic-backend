/**
 * Diem dang ky entity duy nhat cho TypeORM.
 *
 * File entity nam trong `modules/<bounded-context>/domain/entities/` theo Phan III tai lieu
 * kien truc, nhung TypeORM van can biet TAT CA entity tai mot cho de dung do thi quan he.
 * Day la cho do - va la ngoai le duy nhat duoc phep import xuyen module o tang shared.
 *
 * Luu y ranh gioi module (Phan III): module A DUOC import `domain/entities` cua module B
 * (chung tao nen mot lucc do quan he duy nhat, khoa ngoai bat buoc phai tham chieu duoc
 * lan nhau), nhung KHONG duoc import `application/`, `infrastructure/` hay `presentation/`
 * cua B - moi tuong tac hanh vi phai di qua barrel `application/index.ts` cong khai.
 * Quy tac nay duoc ESLint `import/no-restricted-paths` chan cung.
 */

export * from '@/shared/database/base.entity';

export * from '@/modules/identity/domain/entities/user.entity';
export * from '@/modules/identity/domain/entities/refresh-token.entity';
export * from '@/modules/identity/domain/entities/doctor.entity';
export * from '@/modules/identity/domain/entities/audit-log.entity';
export * from '@/modules/identity/domain/entities/role-permission.entity';
export * from '@/modules/identity/domain/entities/employee.entity';

export * from '@/modules/organization/domain/entities/branch.entity';
export * from '@/modules/organization/domain/entities/operating-hour.entity';

export * from '@/modules/pets/domain/entities/species.entity';
export * from '@/modules/pets/domain/entities/breed.entity';
export * from '@/modules/pets/domain/entities/pet.entity';

export * from '@/modules/catalog/domain/entities/item.entity';
export * from '@/modules/catalog/domain/entities/service.entity';
export * from '@/modules/catalog/domain/entities/medication.entity';
export * from '@/modules/catalog/domain/entities/inventory-item.entity';
export * from '@/modules/catalog/domain/entities/disease.entity';

export * from '@/modules/scheduling/domain/entities/doctor-shift.entity';
export * from '@/modules/scheduling/domain/entities/doctor-break.entity';
export * from '@/modules/scheduling/domain/entities/appointment.entity';
export * from '@/modules/scheduling/domain/entities/queue-entry.entity';

export * from '@/modules/triage/domain/entities/pre-screening-result.entity';

export * from '@/modules/clinical/domain/entities/medical-record.entity';
export * from '@/modules/clinical/domain/entities/examination.entity';
export * from '@/modules/clinical/domain/entities/prescription.entity';
export * from '@/modules/clinical/domain/entities/prescription-item.entity';
export * from '@/modules/clinical/domain/entities/lab-test-order.entity';

export * from '@/modules/billing/domain/entities/invoice.entity';
export * from '@/modules/billing/domain/entities/invoice-item.entity';

export * from '@/modules/notification/domain/entities/notification.entity';
export * from '@/modules/notification/domain/entities/outbox-event.entity';
