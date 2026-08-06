import { Role } from './role.enum';

/**
 * Quyen theo cap (module, hanh dong) - SRS FR-02-02.
 *
 * Vi sao la enum trong ma nguon chu khong phai du lieu tu do trong CSDL: ma quyen
 * duoc GO TRUC TIEP vao `@RequirePermissions('CUSTOMER_CREATE')` tren tung handler.
 * Neu quan tri vien tu them duoc ma quyen moi qua giao dien thi ma do khong the gan
 * vao endpoint nao ca - no chi la mot dong chu vo nghia. Cai QUAN TRI VIEN duoc doi
 * la ma tran vai tro x quyen (bang `role_permissions`), chu khong phai tap quyen.
 */
export enum Permission {
  // Khach hang
  CUSTOMER_VIEW = 'CUSTOMER_VIEW',
  CUSTOMER_CREATE = 'CUSTOMER_CREATE',
  CUSTOMER_UPDATE = 'CUSTOMER_UPDATE',
  CUSTOMER_DELETE = 'CUSTOMER_DELETE',

  // Thu cung
  PET_VIEW = 'PET_VIEW',
  PET_CREATE = 'PET_CREATE',
  PET_UPDATE = 'PET_UPDATE',
  PET_DELETE = 'PET_DELETE',

  // Lich hen
  APPOINTMENT_VIEW = 'APPOINTMENT_VIEW',
  APPOINTMENT_CREATE = 'APPOINTMENT_CREATE',
  APPOINTMENT_UPDATE = 'APPOINTMENT_UPDATE',
  APPOINTMENT_CANCEL = 'APPOINTMENT_CANCEL',

  // Tiep nhan / hang cho
  QUEUE_VIEW = 'QUEUE_VIEW',
  QUEUE_MANAGE = 'QUEUE_MANAGE',

  // Ho so benh an
  MEDICAL_RECORD_VIEW = 'MEDICAL_RECORD_VIEW',
  MEDICAL_RECORD_CREATE = 'MEDICAL_RECORD_CREATE',
  MEDICAL_RECORD_UPDATE = 'MEDICAL_RECORD_UPDATE',

  // Don thuoc & cap phat (P7 - FR-11)
  PRESCRIPTION_VIEW = 'PRESCRIPTION_VIEW',
  PRESCRIPTION_CREATE = 'PRESCRIPTION_CREATE',
  /** Cap phat thuoc va tru kho - tach khoi CREATE vi day la hai vai tro khac nhau. */
  PRESCRIPTION_DISPENSE = 'PRESCRIPTION_DISPENSE',

  // Tiem chung (P9 - FR-12)
  VACCINATION_VIEW = 'VACCINATION_VIEW',
  /** Ghi nhan mot mui tiem - dong thoi tru kho vaccine, nen tach khoi quyen xem. */
  VACCINATION_CREATE = 'VACCINATION_CREATE',

  // Xet nghiem (P9 - FR-13)
  LABORATORY_VIEW = 'LABORATORY_VIEW',
  /**
   * Nhap ket qua xet nghiem. TACH KHOI `MEDICAL_RECORD_UPDATE` co chu dich: ky thuat
   * vien phong xet nghiem phai ghi duoc ket qua vao ho so, nhung khong duoc sua chan
   * doan hay dieu tri trong chinh ho so do. He thong chua co vai tro "ky thuat vien"
   * rieng (SRS chi liet ke sau vai tro); quan tri vien gan quyen nay cho vai tro nao
   * phu hop qua man hinh ma tran phan quyen - do dung la viec man hinh do sinh ra de lam.
   */
  LABORATORY_RESULT_ENTER = 'LABORATORY_RESULT_ENTER',

  // Danh muc (dich vu, thuoc, san pham)
  CATALOG_VIEW = 'CATALOG_VIEW',
  CATALOG_MANAGE = 'CATALOG_MANAGE',

  // Kho
  INVENTORY_VIEW = 'INVENTORY_VIEW',
  INVENTORY_IMPORT = 'INVENTORY_IMPORT',
  INVENTORY_EXPORT = 'INVENTORY_EXPORT',

  // Ban hang
  POS_SELL = 'POS_SELL',

  // Hoa don & thanh toan
  INVOICE_VIEW = 'INVOICE_VIEW',
  INVOICE_CREATE = 'INVOICE_CREATE',
  PAYMENT_CREATE = 'PAYMENT_CREATE',
  PAYMENT_REFUND = 'PAYMENT_REFUND',

  // Quan tri
  EMPLOYEE_MANAGE = 'EMPLOYEE_MANAGE',
  BRANCH_MANAGE = 'BRANCH_MANAGE',
  ROLE_MANAGE = 'ROLE_MANAGE',
  REPORT_VIEW = 'REPORT_VIEW',
  AUDIT_VIEW = 'AUDIT_VIEW',
}

/** Nhom quyen theo module - dung cho man hinh ma tran phan quyen. */
export const PERMISSION_GROUPS: Record<string, Permission[]> = {
  'Khách hàng': [
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,
    Permission.CUSTOMER_DELETE,
  ],
  'Thú cưng': [
    Permission.PET_VIEW,
    Permission.PET_CREATE,
    Permission.PET_UPDATE,
    Permission.PET_DELETE,
  ],
  'Lịch hẹn': [
    Permission.APPOINTMENT_VIEW,
    Permission.APPOINTMENT_CREATE,
    Permission.APPOINTMENT_UPDATE,
    Permission.APPOINTMENT_CANCEL,
  ],
  'Tiếp nhận': [Permission.QUEUE_VIEW, Permission.QUEUE_MANAGE],
  'Hồ sơ bệnh án': [
    Permission.MEDICAL_RECORD_VIEW,
    Permission.MEDICAL_RECORD_CREATE,
    Permission.MEDICAL_RECORD_UPDATE,
  ],
  'Đơn thuốc': [
    Permission.PRESCRIPTION_VIEW,
    Permission.PRESCRIPTION_CREATE,
    Permission.PRESCRIPTION_DISPENSE,
  ],
  'Tiêm chủng': [Permission.VACCINATION_VIEW, Permission.VACCINATION_CREATE],
  'Xét nghiệm': [Permission.LABORATORY_VIEW, Permission.LABORATORY_RESULT_ENTER],
  'Danh mục': [Permission.CATALOG_VIEW, Permission.CATALOG_MANAGE],
  Kho: [Permission.INVENTORY_VIEW, Permission.INVENTORY_IMPORT, Permission.INVENTORY_EXPORT],
  'Bán hàng': [Permission.POS_SELL],
  'Hóa đơn & thanh toán': [
    Permission.INVOICE_VIEW,
    Permission.INVOICE_CREATE,
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_REFUND,
  ],
  'Quản trị': [
    Permission.EMPLOYEE_MANAGE,
    Permission.BRANCH_MANAGE,
    Permission.ROLE_MANAGE,
    Permission.REPORT_VIEW,
    Permission.AUDIT_VIEW,
  ],
};

const ALL_PERMISSIONS = Object.values(Permission);

/**
 * Ma tran quyen MAC DINH, dung theo muc 4 cua SRS. Day chi la trang thai KHOI TAO
 * duoc seed vao `role_permissions` - tu do tro di quan tri vien sua qua giao dien va
 * CSDL moi la nguon su that. Migration khong ghi de len thay doi cua quan tri vien.
 *
 * PET_OWNER khong co mat: chu thu cung khong dung endpoint nhan vien nao ca, ho di
 * qua cac route rieng (`/pets/mine`, `/appointments/mine`) von chi kiem tra quyen so
 * huu chu khong kiem tra permission.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // SRS 4.1: "Co toan quyen tren he thong."
  [Role.ADMIN]: ALL_PERMISSIONS,

  // SRS 4.2: xem dashboard, quan ly nhan vien/san pham/thuoc/kho/NCC/dich vu,
  // xem doanh thu + bao cao, quan ly khach hang, xem ho so thu cung.
  // KHONG co ROLE_MANAGE (BR-16: chi Admin) va khong co MEDICAL_RECORD_CREATE.
  [Role.MANAGER]: [
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,
    Permission.CUSTOMER_DELETE,
    Permission.PET_VIEW,
    Permission.PET_CREATE,
    Permission.PET_UPDATE,
    Permission.APPOINTMENT_VIEW,
    Permission.APPOINTMENT_CREATE,
    Permission.APPOINTMENT_UPDATE,
    Permission.APPOINTMENT_CANCEL,
    Permission.QUEUE_VIEW,
    Permission.QUEUE_MANAGE,
    Permission.MEDICAL_RECORD_VIEW,
    Permission.PRESCRIPTION_VIEW,
    Permission.VACCINATION_VIEW,
    Permission.LABORATORY_VIEW,
    Permission.CATALOG_VIEW,
    Permission.CATALOG_MANAGE,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_IMPORT,
    Permission.INVENTORY_EXPORT,
    Permission.POS_SELL,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_CREATE,
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_REFUND,
    Permission.EMPLOYEE_MANAGE,
    Permission.BRANCH_MANAGE,
    Permission.REPORT_VIEW,
  ],

  // SRS 4.3 Veterinarian: xem lich kham, xem thong tin thu cung, kham, tao ho so
  // benh an, chan doan, dieu tri, ke don, ghi vaccine, yeu cau xet nghiem.
  [Role.DOCTOR]: [
    Permission.CUSTOMER_VIEW,
    Permission.PET_VIEW,
    Permission.PET_UPDATE,
    Permission.APPOINTMENT_VIEW,
    Permission.APPOINTMENT_UPDATE,
    Permission.QUEUE_VIEW,
    Permission.QUEUE_MANAGE,
    Permission.MEDICAL_RECORD_VIEW,
    Permission.MEDICAL_RECORD_CREATE,
    Permission.MEDICAL_RECORD_UPDATE,
    // Bac si KE don nhung KHONG cap phat - SRS 4.5 giao viec cap phat cho duoc si, va
    // tach hai quyen nay chinh la cai lam nen the kiem tra cheo cua quy trinh dung thuoc.
    Permission.PRESCRIPTION_VIEW,
    Permission.PRESCRIPTION_CREATE,
    // SRS 4.3 giao dich danh cho bac si: "ghi vaccine, yeu cau xet nghiem".
    Permission.VACCINATION_VIEW,
    Permission.VACCINATION_CREATE,
    Permission.LABORATORY_VIEW,
    Permission.LABORATORY_RESULT_ENTER,
    Permission.CATALOG_VIEW,
    Permission.INVENTORY_VIEW,
    Permission.INVOICE_VIEW,
  ],

  // SRS 4.4: quan ly khach hang + thu cung, dat lich, xac nhan lich, check-in,
  // quan ly hang cho, tao luot kham, tao hoa don, ho tro thanh toan.
  [Role.RECEPTIONIST]: [
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,
    Permission.CUSTOMER_DELETE,
    Permission.PET_VIEW,
    Permission.PET_CREATE,
    Permission.PET_UPDATE,
    Permission.APPOINTMENT_VIEW,
    Permission.APPOINTMENT_CREATE,
    Permission.APPOINTMENT_UPDATE,
    Permission.APPOINTMENT_CANCEL,
    Permission.QUEUE_VIEW,
    Permission.QUEUE_MANAGE,
    Permission.MEDICAL_RECORD_VIEW,
    Permission.PRESCRIPTION_VIEW,
    // Le tan la nguoi goi dien nhac lich tiem (`GET /vaccinations/due`), nen phai xem
    // duoc so tiem chung - nhung khong ghi duoc mui tiem nao.
    Permission.VACCINATION_VIEW,
    Permission.LABORATORY_VIEW,
    Permission.CATALOG_VIEW,
    Permission.INVENTORY_VIEW,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_CREATE,
    Permission.PAYMENT_CREATE,
  ],

  // SRS 4.5: quan ly thuoc/lo/han su dung, nhap-xuat thuoc, kiem ke, dieu chinh ton,
  // xu ly don thuoc, theo doi thuoc sap het.
  // Chi co MEDICAL_RECORD_VIEW (de doc don thuoc), khong duoc tao/sua ho so benh an.
  [Role.PHARMACIST]: [
    Permission.CUSTOMER_VIEW,
    Permission.PET_VIEW,
    Permission.MEDICAL_RECORD_VIEW,
    // Duoc si CAP PHAT nhung KHONG ke don - mat con lai cua the kiem tra cheo o tren.
    Permission.PRESCRIPTION_VIEW,
    Permission.PRESCRIPTION_DISPENSE,
    // Duoc si quan ly ca lo vaccine trong kho, nen phai tra cuu duoc mui tiem da xuat
    // tu lo nao - nhung viec tiem la cua bac si.
    Permission.VACCINATION_VIEW,
    Permission.CATALOG_VIEW,
    Permission.CATALOG_MANAGE,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_IMPORT,
    Permission.INVENTORY_EXPORT,
    Permission.INVOICE_VIEW,
  ],

  // SRS 4.6: tim san pham, tao gio hang, ban hang, tao hoa don, thanh toan,
  // xem thong tin san pham, ho tro quan ly khach hang.
  [Role.STAFF]: [
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,
    Permission.CATALOG_VIEW,
    Permission.INVENTORY_VIEW,
    Permission.POS_SELL,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_CREATE,
    Permission.PAYMENT_CREATE,
  ],
};
