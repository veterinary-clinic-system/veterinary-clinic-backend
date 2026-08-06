/**
 * Sinh CSV cho cac bao cao xuat file - P10-T4.
 *
 * BOM UTF-8 (`﻿`) o dau file la BAT BUOC voi du an nay: khong co no, Excel tren
 * Windows doan bang codepage he thong va `Cà phê` hien thanh `CÃ  phÃª`. Toan bo ten
 * hang, ten khach va ten benh trong he thong deu la tieng Viet co dau, nen day khong
 * phai truong hop hiem - no la lan xuat file dau tien.
 *
 * CRLF thay vi LF: RFC 4180 quy dinh vay, va Excel cu tren Windows doc file chi co LF
 * thanh mot dong duy nhat.
 */
const BOM = '﻿';
const CRLF = '\r\n';

/**
 * Boc mot o theo RFC 4180.
 *
 * Boc dau nhay khi o co chua dau phay, dau nhay hoac xuong dong; dau nhay ben trong
 * duoc nhan doi. Bo qua buoc nay thi mot ten hang co dau phay ("Thuoc A, dang goi") se
 * lam lech toan bo cac cot cua dong do - loi im lang nhat cua CSV.
 */
function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];
  return BOM + lines.join(CRLF) + CRLF;
}
