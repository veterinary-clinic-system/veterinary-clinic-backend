import { Role } from './role.enum';

export enum Permission {
  
  CUSTOMER_VIEW = 'CUSTOMER_VIEW',
  CUSTOMER_CREATE = 'CUSTOMER_CREATE',
  CUSTOMER_UPDATE = 'CUSTOMER_UPDATE',
  CUSTOMER_DELETE = 'CUSTOMER_DELETE',

  PET_VIEW = 'PET_VIEW',
  PET_CREATE = 'PET_CREATE',
  PET_UPDATE = 'PET_UPDATE',
  PET_DELETE = 'PET_DELETE',

  APPOINTMENT_VIEW = 'APPOINTMENT_VIEW',
  APPOINTMENT_CREATE = 'APPOINTMENT_CREATE',
  APPOINTMENT_UPDATE = 'APPOINTMENT_UPDATE',
  APPOINTMENT_CANCEL = 'APPOINTMENT_CANCEL',

  QUEUE_VIEW = 'QUEUE_VIEW',
  QUEUE_MANAGE = 'QUEUE_MANAGE',

  MEDICAL_RECORD_VIEW = 'MEDICAL_RECORD_VIEW',
  MEDICAL_RECORD_CREATE = 'MEDICAL_RECORD_CREATE',
  MEDICAL_RECORD_UPDATE = 'MEDICAL_RECORD_UPDATE',

  PRESCRIPTION_VIEW = 'PRESCRIPTION_VIEW',
  PRESCRIPTION_CREATE = 'PRESCRIPTION_CREATE',
  
  PRESCRIPTION_DISPENSE = 'PRESCRIPTION_DISPENSE',

  VACCINATION_VIEW = 'VACCINATION_VIEW',
  
  VACCINATION_CREATE = 'VACCINATION_CREATE',

  LABORATORY_VIEW = 'LABORATORY_VIEW',
  
  LABORATORY_RESULT_ENTER = 'LABORATORY_RESULT_ENTER',

  CATALOG_VIEW = 'CATALOG_VIEW',
  CATALOG_MANAGE = 'CATALOG_MANAGE',

  INVENTORY_VIEW = 'INVENTORY_VIEW',
  INVENTORY_IMPORT = 'INVENTORY_IMPORT',
  INVENTORY_EXPORT = 'INVENTORY_EXPORT',

  POS_SELL = 'POS_SELL',

  INVOICE_VIEW = 'INVOICE_VIEW',
  INVOICE_CREATE = 'INVOICE_CREATE',
  PAYMENT_CREATE = 'PAYMENT_CREATE',
  PAYMENT_REFUND = 'PAYMENT_REFUND',

  EMPLOYEE_MANAGE = 'EMPLOYEE_MANAGE',
  BRANCH_MANAGE = 'BRANCH_MANAGE',
  ROLE_MANAGE = 'ROLE_MANAGE',
  REPORT_VIEW = 'REPORT_VIEW',
  AUDIT_VIEW = 'AUDIT_VIEW',
}

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

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  
  [Role.ADMIN]: ALL_PERMISSIONS,

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

    Permission.PRESCRIPTION_VIEW,
    Permission.PRESCRIPTION_CREATE,
    
    Permission.VACCINATION_VIEW,
    Permission.VACCINATION_CREATE,
    Permission.LABORATORY_VIEW,
    Permission.LABORATORY_RESULT_ENTER,
    Permission.CATALOG_VIEW,
    Permission.INVENTORY_VIEW,
    Permission.INVOICE_VIEW,
  ],

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

    Permission.VACCINATION_VIEW,
    Permission.LABORATORY_VIEW,
    Permission.CATALOG_VIEW,
    Permission.INVENTORY_VIEW,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_CREATE,
    Permission.PAYMENT_CREATE,
  ],

  [Role.PHARMACIST]: [
    Permission.CUSTOMER_VIEW,
    Permission.PET_VIEW,
    Permission.MEDICAL_RECORD_VIEW,
    
    Permission.PRESCRIPTION_VIEW,
    Permission.PRESCRIPTION_DISPENSE,

    Permission.VACCINATION_VIEW,
    Permission.CATALOG_VIEW,
    Permission.CATALOG_MANAGE,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_IMPORT,
    Permission.INVENTORY_EXPORT,
    Permission.INVOICE_VIEW,
  ],

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
