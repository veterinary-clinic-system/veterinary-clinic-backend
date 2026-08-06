/**
 * Loc truong nhay cam khoi nhat ky kiem toan - SRS muc 14, P10-T1.
 *
 * DANH SACH DEN CHU KHONG PHAI DANH SACH TRANG, va do la mot quyet dinh can noi ro vi no
 * di nguoc phan xa thong thuong:
 *
 *   Mot danh sach trang ("chi ghi cac truong sau") an toan hon ve nguyen tac, nhung o day
 *   no pha hong chinh cong dung cua audit. Interceptor la MOT ham chung chay cho moi thuc
 *   the - khach hang, hoa don, don thuoc, phieu kiem ke. Danh sach trang nghia la phai
 *   liet ke truoc moi truong cua moi thuc the, va lan sau ai do them mot cot thi cot do
 *   lang le khong duoc ghi lai. Mot nhat ky kiem toan im lang bo qua thay doi la thu te
 *   hon la khong co nhat ky, vi khong ai biet no dang thieu.
 *
 * Bu lai, danh sach den phai khop theo MAU TEN chu khong phai ten chinh xac: `password`,
 * `passwordHash`, `newPassword`, `password_confirmation` deu phai bi chan boi mot luat.
 * Va phai di DE QUY - mat khau nam trong mot doi tuong long nhau van la mat khau.
 */

/** Ghi de len gia tri bi loc, de doc log thay ro "cho nay co du lieu nhung da bi che". */
export const REDACTED = '[REDACTED]';

/**
 * Mau ten truong bi che. So khop KHONG PHAN BIET hoa thuong va theo kieu "co chua", nen
 * `passwordHash`, `PASSWORD`, `old_password` deu dinh cung mot mau `password`.
 */
const SENSITIVE_PATTERNS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'pin',
  'otp',
  'privatekey',
  'private_key',
  'salt',
];

/** Do sau toi da khi di de quy - chan doi tuong tu tham chieu vong lam trang stack. */
const MAX_DEPTH = 8;

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
  return SENSITIVE_PATTERNS.some((pattern) => normalized.includes(pattern.replace(/_/g, '')));
}

/**
 * Tra ve mot ban sao da che cac truong nhay cam.
 *
 * KHONG sua doi tuong goc: doi tuong dua vao day thuong la chinh entity vua doc tu CSDL
 * hoac body cua request, va ca hai deu con duoc dung tiep sau khi audit ghi xong.
 *
 * `Date` va `Buffer` duoc giu nguyen dang thay vi bi duyet nhu doi tuong thuong - duyet
 * mot `Date` se ra `{}` va moi moc thoi gian trong nhat ky se bien thanh rong.
 */
export function sanitizeAuditPayload(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }
  if (depth >= MAX_DEPTH) {
    return '[MAX_DEPTH]';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAuditPayload(entry, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? REDACTED : sanitizeAuditPayload(entry, depth + 1);
  }
  return result;
}

/**
 * Chi giu lai cac truong THUC SU DOI giua truoc va sau.
 *
 * Ghi ca hai ban chup day du thi mot lan sua so dien thoai se de lai hai khoi ba muoi
 * truong giong het nhau, va nguoi doc phai tu do tim ra cho khac. Bang nay tra loi thang
 * cau hoi cua kiem toan vien: "da doi cai gi".
 *
 * So sanh bang JSON: cac gia tri o day deu la du lieu tho da qua `sanitizeAuditPayload`
 * (khong con `Date`, khong con ham), nen so sanh chuoi hoa la du va tat dinh.
 */
export function diffAuditSnapshots(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);

  for (const key of keys) {
    const oldValue = before?.[key] ?? null;
    const newValue = after?.[key] ?? null;
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = { before: oldValue, after: newValue };
    }
  }
  return changes;
}
