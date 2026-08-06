import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../enums/audit-action.enum';

export const AUDIT_KEY = 'audit';

/**
 * Suy ra hanh dong tu chinh noi dung request.
 *
 * Can den no vi mot so chuyen trang thai trong he thong nay di chung mot handler
 * `PATCH /:id`: xac nhan mot lich hen (`APPROVE`) va doi gio kham (`UPDATE`) la cung mot
 * endpoint, khac nhau o `body.status`. Ghi ca hai thanh `UPDATE` thi cau hoi "ai da xac
 * nhan lich nay" khong tra loi duoc nua - dung cai FR-26 tach rieng `APPROVE` de tranh.
 *
 * Tra `undefined` de dung `action` mac dinh.
 */
export type AuditActionResolver = (body: unknown) => AuditAction | undefined;

export interface AuditOptions {
  /** Hanh dong mac dinh. Dung khi khong khai `resolveAction` hoac ham do tra `undefined`. */
  action: AuditAction;
  /** Xem `AuditActionResolver`. Chi khai cho handler thuc su da nghia. */
  resolveAction?: AuditActionResolver;
  /**
   * Ten LOP entity cua TypeORM (`'User'`, `'Invoice'`), khong phai ten bang.
   *
   * Interceptor dung chinh ten nay de tu chup trang thai truoc/sau qua
   * `dataSource.getRepository(entity)`. Vi the no phai la ten that trong
   * `entity-registry.ts` - go sai thi khong co ban chup nao, va dong audit van duoc ghi
   * nhung chi con `action`/`entityId` (xem `AuditInterceptor.snapshot`).
   */
  entity: string;
  /**
   * Tham so duong dan chua id cua ban ghi. Mac dinh `'id'`.
   *
   * Endpoint dang `POST /medical-records/:id/complete` thi id nam o `'id'`; dang
   * `PATCH /examinations/lab-tests/:labTestId` thi phai noi ro `'labTestId'`.
   */
  idParam?: string;
  /**
   * Bo qua viec chup truoc/sau. Dat `false` cho cac hanh dong khong tuong ung mot dong
   * du lieu nao (`LOGIN`, `LOGOUT`) hoac cho endpoint ghi hang loat, noi mot ban chup
   * theo id la vo nghia.
   */
  snapshot?: boolean;
}

/**
 * Danh dau mot handler la can ghi nhat ky kiem toan - SRS FR-26, BR-17 (P10-T1).
 *
 * `AuditInterceptor` doc metadata nay, tu chup trang thai truoc va sau khi handler chay,
 * roi ghi mot dong `audit_logs` BAT DONG BO. Nghiep vu khong doi audit, va audit hong
 * khong lam hong nghiep vu - xem ghi chu dau interceptor.
 *
 * CHI GAN TREN HANDLER GHI. Gan tren handler doc se sinh mot dong audit cho moi lan mo
 * mot trang danh sach, va bang audit se ngap trong nhung dong khong ai doc - dung cai
 * lam nhat ky kiem toan tro nen vo dung.
 */
export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);
