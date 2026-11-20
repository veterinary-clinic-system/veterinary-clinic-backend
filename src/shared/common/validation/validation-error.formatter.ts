import { BadRequestException, ValidationError } from '@nestjs/common';

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
  return translateDefaultMessage(constraints[keys[0]]);
}

/**
 * DTO nào quên đặt `message` thì class-validator trả câu tiếng Anh ("message must be shorter
 * than or equal to 2000 characters") - lọt thẳng lên giao diện tiếng Việt. Dịch các mẫu mặc
 * định hay gặp; câu đã viết tiếng Việt thì không khớp mẫu nào và giữ nguyên.
 */
const DEFAULT_MESSAGE_TRANSLATIONS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [
    /^\S+ must be shorter than or equal to (\d+) characters$/,
    (m) => `Nội dung không được vượt quá ${Number(m[1]).toLocaleString('vi-VN')} ký tự.`,
  ],
  [
    /^\S+ must be longer than or equal to (\d+) characters$/,
    (m) => `Nội dung phải có ít nhất ${m[1]} ký tự.`,
  ],
  [/^\S+ should not be empty$/, () => 'Vui lòng nhập đầy đủ thông tin bắt buộc.'],
  [/^\S+ must not be less than (-?[\d.]+)$/, (m) => `Giá trị phải từ ${m[1]} trở lên.`],
  [/^\S+ must not be greater than (-?[\d.]+)$/, (m) => `Giá trị không được vượt quá ${m[1]}.`],
  [/^\S+ must be a UUID$/, () => 'Mã định danh không hợp lệ.'],
  [/^\S+ must be an email$/, () => 'Email không hợp lệ.'],
  [/^\S+ must contain no more than (\d+) elements$/, (m) => `Chỉ được gửi tối đa ${m[1]} mục.`],
  [/^\S+ must be a valid ISO 8601 date string$/, () => 'Ngày giờ không hợp lệ.'],
  [/^property \S+ should not exist$/, () => 'Dữ liệu gửi lên có trường không hợp lệ.'],
];

export function translateDefaultMessage(message: string): string {
  for (const [pattern, render] of DEFAULT_MESSAGE_TRANSLATIONS) {
    const match = message.match(pattern);
    if (match) return render(match);
  }
  return message;
}

function rank(constraint: string): number {
  const index = CONSTRAINT_PRIORITY.indexOf(constraint);
  return index === -1 ? CONSTRAINT_PRIORITY.length : index;
}
