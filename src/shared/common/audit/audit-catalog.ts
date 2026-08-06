import { AuditAction } from '@/shared/common/enums/audit-action.enum';

/**
 * Danh sach dung cho O CHON cua trang xem nhat ky (P10-T2).
 *
 * Tach khoi enum `AuditAction` vi hai thu tra loi hai cau hoi khac nhau: enum la tap
 * hanh dong ma MA NGUON duoc phep ghi, con hai hang so o day la tap gia tri ma NGUOI
 * DUNG thay trong bo loc. Chung trung nhau hom nay, nhung bang audit la bat bien va se
 * con giu nhung gia tri cua cac phien ban truoc - bo loc phai go duoc ca chung.
 */
export const AUDIT_ACTIONS: string[] = Object.values(AuditAction);

/**
 * Ten entity duoc audit, dung thu tu hien tren o chon.
 *
 * Giu tay chu khong sinh tu `entity-registry`: phan lon entity trong he thong khong bao
 * gio xuat hien trong bang audit (bang noi, bang tra cuu), va do mot o chon ba muoi dong
 * de tim lay nam dong co du lieu la mot giao dien te.
 */
export const AUDIT_ENTITIES: string[] = [
  'User',
  'Pet',
  'Appointment',
  'MedicalRecord',
  'Prescription',
  'Vaccination',
  'LabTestOrder',
  'Invoice',
  'Payment',
  'InventoryItem',
  'StockTake',
  'RolePermission',
];
