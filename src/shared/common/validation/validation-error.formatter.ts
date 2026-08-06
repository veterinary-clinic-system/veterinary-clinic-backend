import { BadRequestException, ValidationError } from '@nestjs/common';

/**
 * Thu tu UU TIEN khi mot truong vi pham nhieu luat cung luc.
 *
 * Cang dung dau cang duoc chon. Ly do phai co bang nay: mot truong bat buoc bi BO
 * TRONG se lam hong TAT CA cac luat cua no cung mot luc - `isString`, `minLength`,
 * `maxLength`, `matches`... Neu chon bua, nguoi dung nhan duoc
 * "note không được vượt quá 500 ký tự" cho mot o ho chua go gi ca; cau do doc nhu loi
 * cua he thong chu khong phai loi cua nguoi nhap, va no khong he noi cho ho biet phai
 * lam gi.
 *
 * Thu tu di tu "khong co gia tri" -> "sai kieu" -> "sai pham vi" -> "sai dinh dang",
 * dung theo thu tu ma nguoi nhap se phai sua.
 */
const CONSTRAINT_PRIORITY = [
  'isDefined',
  'isNotEmpty',
  'isNotEmptyObject',
  'arrayNotEmpty',
  'isString',
  'isInt',
  'isNumber',
  'isBoolean',
  'isArray',
  'isEnum',
  'isIn',
  'isUuid',
  'isDateString',
  'isEmail',
  'isPhoneNumber',
  'min',
  'max',
  'minLength',
  'maxLength',
  'minDate',
  'maxDate',
  'arrayMinSize',
  'arrayMaxSize',
  'matches',
];

/**
 * Bien cay `ValidationError` cua class-validator thanh MOT thong diep cho MOI truong.
 *
 * Thay cho `stopAtFirstError: true`. Hai cach deu cho ra mot loi moi truong, nhung
 * `stopAtFirstError` de class-validator chon - va no chon theo thu tu NGUOC voi thu tu
 * khai bao decorator, tuc la ket qua phu thuoc vao viec lap trinh vien go `@MaxLength`
 * o tren hay o duoi `@IsNotEmpty`. Day la mot chi tiet khong ai nho, va no da tung lam
 * hai endpoint tra ve thong diep vo nghia (P10-T8).
 *
 * O day thi thu tu decorator KHONG con y nghia gi: luat nao duoc bao la do
 * `CONSTRAINT_PRIORITY` quyet dinh, giong nhau o moi DTO.
 */
export function formatValidationErrors(errors: ValidationError[]): BadRequestException {
  return new BadRequestException(collectMessages(errors));
}

function collectMessages(errors: ValidationError[], parentPath = ''): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    const best = pickMostRelevant(error.constraints);
    if (best) {
      messages.push(best);
    }

    // DTO long nhau (`newPet` trong don dat lich) va mang doi tuong.
    if (error.children?.length) {
      messages.push(...collectMessages(error.children, path));
    }
  }

  return messages;
}

function pickMostRelevant(constraints?: Record<string, string>): string | null {
  if (!constraints) {
    return null;
  }

  const keys = Object.keys(constraints);
  if (keys.length === 0) {
    return null;
  }

  keys.sort((a, b) => rank(a) - rank(b));
  return constraints[keys[0]];
}

/** Luat khong co trong bang xep sau cung, giu nguyen thu tu tuong doi giua chung. */
function rank(constraint: string): number {
  const index = CONSTRAINT_PRIORITY.indexOf(constraint);
  return index === -1 ? CONSTRAINT_PRIORITY.length : index;
}
