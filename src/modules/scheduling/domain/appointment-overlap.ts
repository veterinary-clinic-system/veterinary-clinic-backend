import { ConflictException } from '@nestjs/common';

/**
 * Ma loi PostgreSQL cho vi pham rang buoc EXCLUDE (exclusion_violation).
 * Xem migration 1785000000000-ArchitectureDocPartV, muc 4.
 */
const PG_EXCLUSION_VIOLATION = '23P01';

/** Ten rang buoc chong trung lich hen, dat trong cung migration do. */
const APPOINTMENT_OVERLAP_CONSTRAINT = 'appointment_no_overlap';

/**
 * Nhan dien loi "trung lich hen" do CHINH CSDL nem ra.
 *
 * Vi sao can, du tang ung dung da kiem tra truoc (assertSlotIsFree)?
 * Vi kiem tra o tang ung dung luon con mot khe ho: giua luc doc "khung gio nay con
 * trong" va luc INSERT, mot request khac co the da chen vao. Advisory lock thu hep
 * khe ho do nhung rang buoc EXCLUDE moi la thu dong han no lai - va khi no chan thi
 * loi bat len duoi dang loi CSDL tho.
 *
 * Ham nay dich loi tho do thanh 409 Conflict voi thong bao nguoi dung hieu duoc,
 * thay vi de no noi len thanh 500 Internal Server Error.
 */
export function isAppointmentOverlapError(error: unknown): boolean {
  const candidate = error as { code?: string; constraint?: string } | null;
  return (
    candidate?.code === PG_EXCLUSION_VIOLATION &&
    candidate?.constraint === APPOINTMENT_OVERLAP_CONSTRAINT
  );
}

/**
 * Chay `operation`, doi loi trung lich cua CSDL thanh ConflictException.
 * Moi loi khac duoc nem lai nguyen ven.
 */
export async function mapAppointmentOverlapError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isAppointmentOverlapError(error)) {
      throw new ConflictException('Khung gio nay vua co nguoi dat - vui long chon khung gio khac');
    }
    throw error;
  }
}
