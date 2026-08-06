import { REDACTED, diffAuditSnapshots, sanitizeAuditPayload } from './audit-sanitizer';

/**
 * Test cho bo loc truong nhay cam cua nhat ky kiem toan - SRS muc 14, acceptance P10-T1:
 * *"`passwordHash` khong xuat hien trong bat ky dong audit nao - viet test khang dinh
 * dieu nay"*.
 *
 * `describe('khong ro mat khau')` la test ma acceptance goi dich danh. Dung noi long no
 * khi refactor: no la thu duy nhat chung minh mot cach may kiem chung duoc rang nhat ky
 * kiem toan khong tro thanh mot bang mat khau.
 */
describe('audit-sanitizer', () => {
  describe('khong ro mat khau', () => {
    it('che `passwordHash` doc tu entity User', () => {
      const user = {
        id: 'u-1',
        phone: '0900000001',
        fullName: 'Nguyen Van A',
        passwordHash: '$2b$12$abcdefghijklmnopqrstuv',
      };

      const sanitized = sanitizeAuditPayload(user) as Record<string, unknown>;

      expect(sanitized.passwordHash).toBe(REDACTED);
      expect(JSON.stringify(sanitized)).not.toContain('$2b$12$');
      // Cac truong con lai phai con nguyen - che het thi nhat ky vo dung.
      expect(sanitized.phone).toBe('0900000001');
      expect(sanitized.fullName).toBe('Nguyen Van A');
    });

    it('che moi bien the cua ten truong mat khau', () => {
      const body = {
        password: 'Admin@12345',
        newPassword: 'Moi@12345',
        old_password: 'Cu@12345',
        PASSWORD: 'HOA@12345',
        passwordConfirmation: 'Admin@12345',
      };

      const sanitized = sanitizeAuditPayload(body) as Record<string, string>;

      expect(Object.values(sanitized)).toEqual([REDACTED, REDACTED, REDACTED, REDACTED, REDACTED]);
      expect(JSON.stringify(sanitized)).not.toContain('12345');
    });

    it('che ca khi mat khau nam trong doi tuong long nhau', () => {
      const payload = {
        actor: { id: 'u-1', credentials: { password: 'bi-mat' } },
        items: [{ token: 'eyJhbGciOi' }],
      };

      expect(JSON.stringify(sanitizeAuditPayload(payload))).not.toContain('bi-mat');
      expect(JSON.stringify(sanitizeAuditPayload(payload))).not.toContain('eyJhbGciOi');
    });

    it('che token, khoa API va so the - khong chi mat khau', () => {
      const payload = {
        accessToken: 'a',
        refreshToken: 'b',
        apiKey: 'c',
        cardNumber: 'd',
        cvv: 'e',
        otp: 'f',
      };

      const sanitized = sanitizeAuditPayload(payload) as Record<string, string>;
      expect(Object.values(sanitized).every((value) => value === REDACTED)).toBe(true);
    });

    it('bang khac biet cung khong lam ro mat khau', () => {
      // Duong nguy hiem nhat: hai ban chup deu da duoc che, nhung neu `diff` chay tren
      // du lieu THO thi mat khau se quay lai qua cua sau nay.
      const before = sanitizeAuditPayload({ id: 'u-1', passwordHash: 'hash-cu' }) as Record<
        string,
        unknown
      >;
      const after = sanitizeAuditPayload({ id: 'u-1', passwordHash: 'hash-moi' }) as Record<
        string,
        unknown
      >;

      const diff = diffAuditSnapshots(before, after);

      expect(JSON.stringify(diff)).not.toContain('hash-cu');
      expect(JSON.stringify(diff)).not.toContain('hash-moi');
      // Hai ban chup deu thanh `[REDACTED]` nen doi mat khau khong con la mot "thay doi"
      // nhin thay duoc o day. Dung nhu mong muon: nhat ky ghi rang co lenh sua nguoi
      // dung (mot dong `UPDATE` tren `User`), khong ghi mat khau moi la gi.
      expect(diff.passwordHash).toBeUndefined();
    });
  });

  describe('sanitizeAuditPayload', () => {
    it('giu Date duoi dang chuoi ISO thay vi duyet thanh doi tuong rong', () => {
      const sanitized = sanitizeAuditPayload({ createdAt: new Date('2026-08-06T03:00:00Z') }) as {
        createdAt: string;
      };
      expect(sanitized.createdAt).toBe('2026-08-06T03:00:00.000Z');
    });

    it('khong sua doi tuong goc', () => {
      const original = { password: 'bi-mat', name: 'A' };
      sanitizeAuditPayload(original);
      expect(original.password).toBe('bi-mat');
    });

    it('giu nguyen mang va gia tri nguyen thuy', () => {
      expect(sanitizeAuditPayload([1, 'a', null])).toEqual([1, 'a', null]);
      expect(sanitizeAuditPayload(42)).toBe(42);
      expect(sanitizeAuditPayload(null)).toBeNull();
      expect(sanitizeAuditPayload(undefined)).toBeNull();
    });

    it('chan doi tuong long qua sau thay vi trang stack', () => {
      type Nested = { child?: Nested; leaf?: string };
      const deep: Nested = { leaf: 'day' };
      let cursor = deep;
      for (let i = 0; i < 20; i += 1) {
        cursor.child = { leaf: `muc-${i}` };
        cursor = cursor.child;
      }
      expect(() => sanitizeAuditPayload(deep)).not.toThrow();
      expect(JSON.stringify(sanitizeAuditPayload(deep))).toContain('[MAX_DEPTH]');
    });
  });

  describe('diffAuditSnapshots', () => {
    it('chi giu lai truong thuc su doi', () => {
      const diff = diffAuditSnapshots(
        { id: 'c-1', fullName: 'A', phone: '0900000001' },
        { id: 'c-1', fullName: 'B', phone: '0900000001' },
      );

      expect(diff).toEqual({ fullName: { before: 'A', after: 'B' } });
    });

    it('truong moi them va truong bi go deu la thay doi', () => {
      const diff = diffAuditSnapshots({ a: 1 }, { b: 2 });
      expect(diff).toEqual({
        a: { before: 1, after: null },
        b: { before: null, after: 2 },
      });
    });

    it('tao moi (khong co ban chup truoc) liet ke toan bo truong', () => {
      const diff = diffAuditSnapshots(null, { id: 'p-1', name: 'Luna' });
      expect(diff).toEqual({
        id: { before: null, after: 'p-1' },
        name: { before: null, after: 'Luna' },
      });
    });

    it('khong doi gi thi bang khac biet rong', () => {
      expect(diffAuditSnapshots({ a: 1 }, { a: 1 })).toEqual({});
    });
  });
});
