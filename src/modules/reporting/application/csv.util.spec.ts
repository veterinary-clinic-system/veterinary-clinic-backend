import { toCsv } from './csv.util';

describe('toCsv', () => {
  it('emits a real UTF-8 BOM and escapes spreadsheet cells', () => {
    const csv = toCsv(['Tên', 'Ghi chú'], [['Mèo Mun', 'Có dấu phẩy, và "nháy"']]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Mèo Mun,"Có dấu phẩy, và ""nháy"""');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});
