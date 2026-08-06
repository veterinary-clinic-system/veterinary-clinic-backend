import { Role } from '@/shared/common/enums/role.enum';

/**
 * Cac su kien sinh thong bao TRONG UNG DUNG cho nhan vien - SRS FR-23 muc 18 (P10-T5).
 *
 * TACH KHOI `NotificationType`. Cai kia la thong bao GUI CHO KHACH qua SMS/Zalo va moi
 * loai deu gan voi mot lich hen; cai nay la hop thu NOI BO cua nhan vien, phan lon
 * khong lien quan toi lich hen nao (ton kho thap, thuoc sap het han). Gop hai thu vao
 * mot enum se ep bang nay phai cho phep `appointment_id` rong - va roi khong ai con
 * doc duoc y nghia cua cot do nua.
 */
export enum StaffNotificationType {
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  EXPIRING_SOON = 'EXPIRING_SOON',
  EXPIRED = 'EXPIRED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  VACCINATION_DUE = 'VACCINATION_DUE',
}

/**
 * Bang anh xa SU KIEN -> NGUOI NHAN, theo muc 18 SRS.
 *
 * ADMIN co mat o moi dong: ho la nguoi chiu trach nhiem cuoi cung va khong co man hinh
 * nao trong he thong ma ho khong duoc vao.
 *
 * Chu y cai KHONG co trong bang: DOCTOR khong nhan canh bao ton kho, STAFF ban hang
 * khong nhan canh bao han dung thuoc. Mot hop thu day thu khong phai viec cua minh se
 * bi bo qua hoan toan chi sau vai ngay - va khi do no cung vo dung voi ca nhung thong
 * bao that su quan trong.
 */
export const STAFF_NOTIFICATION_RECIPIENTS: Record<StaffNotificationType, Role[]> = {
  [StaffNotificationType.LOW_STOCK]: [Role.ADMIN, Role.MANAGER, Role.PHARMACIST],
  [StaffNotificationType.OUT_OF_STOCK]: [Role.ADMIN, Role.MANAGER, Role.PHARMACIST],
  [StaffNotificationType.EXPIRING_SOON]: [Role.ADMIN, Role.MANAGER, Role.PHARMACIST],
  [StaffNotificationType.EXPIRED]: [Role.ADMIN, Role.MANAGER, Role.PHARMACIST],
  [StaffNotificationType.PAYMENT_FAILED]: [Role.ADMIN, Role.MANAGER, Role.RECEPTIONIST],
  // Le tan la nguoi goi lai cho khach khi mot lich bi huy; quan ly can biet de xep lai
  // lich cua bac si.
  [StaffNotificationType.APPOINTMENT_CANCELLED]: [Role.ADMIN, Role.MANAGER, Role.RECEPTIONIST],
  [StaffNotificationType.VACCINATION_DUE]: [Role.ADMIN, Role.MANAGER, Role.RECEPTIONIST],
};
