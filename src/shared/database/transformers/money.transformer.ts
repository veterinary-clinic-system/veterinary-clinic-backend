import { ValueTransformer } from 'typeorm';

/**
 * Chuyen doi cot tien te BIGINT <-> number.
 *
 * Vi sao can: theo Phan V.4 quyet dinh #2, tien te luu bang BIGINT don vi DONG (VND
 * khong co don vi nho hon, va float gay sai so cong don - khong chap nhan duoc voi
 * hoa don). Nhung driver `pg` tra ve BIGINT duoi dang CHUOI de khong mat do chinh xac
 * voi so vuot 2^53. Neu khong co transformer nay, `price * quantity` se thanh phep
 * noi chuoi va hoa don sai mot cach im lang.
 *
 * An toan ve do chinh xac: 2^53 dong ~ 9.007 x 10^15 dong, lon hon GDP Viet Nam nhieu
 * bac - khong co hoa don phong kham nao cham toi nguong do.
 */
export const moneyTransformer: ValueTransformer = {
  /** number -> BIGINT khi ghi xuong CSDL. Lam tron de chan phan thap phan lot vao. */
  to: (value: number | null | undefined): string | null =>
    value === null || value === undefined ? null : String(Math.round(value)),

  /** BIGINT (chuoi) -> number khi doc len. */
  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};
