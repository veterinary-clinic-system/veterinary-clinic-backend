import { ValueTransformer } from 'typeorm';

/**
 * Chuyen doi cot NUMERIC <-> number.
 *
 * Cung ly do ky thuat voi `moneyTransformer`: driver `pg` tra ve NUMERIC duoi dang
 * CHUOI (no khong the biet cot do co vuot do chinh xac cua `double` hay khong). Khong
 * co transformer nay
 * thi mot chi so xet nghiem doc len se la `"25.0"`, va phep so sanh voi khoang tham
 * chieu (`value > referenceMax`) tro thanh so sanh CHUOI - `"25.0" > "6"` tinh co van ra
 * dung, nhung `"9.5" > "17"` thi ra sai. Bug kieu do khong bao gio lo ra trong test co
 * so tron.
 *
 * Khac `moneyTransformer` o cho KHONG lam tron: chi so xet nghiem la so thuc that
 * (pH 7.35, WBC 10.4), lam tron o day la lam hong du lieu y te.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined): number | null =>
    value === null || value === undefined ? null : value,

  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};
