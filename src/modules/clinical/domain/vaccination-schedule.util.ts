/**
 * Phan tinh toan THUAN cua lich tiem chung - P9-T2.
 *
 * Tach khoi `VaccinationsService` cung ly do voi `inventory-allocation.util.ts`: quy
 * tac "mui ke tiep roi vao ngay nao" la cho de sai nhat cua ca phase 9 (bien giua trong
 * phac do va sau phac do, phac do mot mui, vaccine khong nhac lai), nhung khong can
 * CSDL de kiem chung. De o day thi test chay bang `npm test`, khong can Postgres.
 */

/** Phan phac do cua mot loai vaccine ma phep tinh nay can toi. */
export interface VaccineSchedule {
  /** So mui cua phac do co ban. >= 1. */
  doseCount: number;
  /** Khoang cach giua cac mui TRONG phac do. Null khi phac do chi co mot mui. */
  intervalDays: number | null;
  /** Khoang nhac lai sau khi da tiem du phac do. Null = khong nhac lai. */
  boosterIntervalDays: number | null;
}

/** `YYYY-MM-DD` theo lich ngay, cung dinh dang voi cot `date` cua Postgres. */
export function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Cong `days` ngay lich vao mot ngay, tra ve `YYYY-MM-DD`. */
export function addDays(from: Date, days: number): string {
  const result = new Date(from.getTime());
  result.setDate(result.getDate() + days);
  return toDateOnly(result);
}

/**
 * Ngay den han cua mui KE TIEP sau khi vua tiem xong mui thu `doseNumber`.
 *
 * Hai khoang cach khac nhau va hay bi lan: `intervalDays` la khoang giua cac mui TRONG
 * phac do co ban (vd 3 mui cach nhau 21 ngay), con `boosterIntervalDays` la khoang nhac
 * lai HANG NAM sau khi da tiem du phac do. Tiem xong mui 2 cua phac do 3 mui thi mui 3
 * cach 21 ngay; tiem xong mui 3 thi mui nhac lai cach 365 ngay.
 *
 * Tra `null` khi khong con gi de nhac: da tiem du phac do va loai vaccine nay khong
 * khai `boosterIntervalDays`. `null` o day co nghia that ("khong nhac"), khong phai
 * "chua tinh duoc" - `VaccinationsService` ghi thang no xuong cot.
 *
 * `doseNumber` vuot qua `doseCount` (bac si tiem bu them mot mui ngoai phac do) van
 * duoc coi la da xong phac do, tuc la roi vao nhanh nhac lai.
 */
export function computeNextDueDate(
  schedule: VaccineSchedule,
  doseNumber: number,
  vaccinatedAt: Date,
): string | null {
  const withinCourse = doseNumber < schedule.doseCount;

  if (withinCourse) {
    // Phac do nhieu mui bat buoc phai co `intervalDays` - `VaccinesService` chan tu luc
    // tao danh muc. Neu du lieu cu van thieu thi khong doan bua mot con so.
    return schedule.intervalDays ? addDays(vaccinatedAt, schedule.intervalDays) : null;
  }

  return schedule.boosterIntervalDays ? addDays(vaccinatedAt, schedule.boosterIntervalDays) : null;
}

/** Trang thai lich nhac, dung de to mau so tiem chung - acceptance P9-T3. */
export type VaccinationDueStatus = 'OVERDUE' | 'DUE_SOON' | 'SCHEDULED' | 'NONE';

/**
 * Phan loai mot `nextDueDate` so voi hom nay.
 *
 * Nguong `DUE_SOON` mac dinh 30 ngay - khop voi cot "sap den han" ma le tan goi nhac
 * (`GET /vaccinations/due?days=30`), de mau vang tren so tiem chung va danh sach goi
 * nhac khong bao gio noi hai chuyen khac nhau.
 */
export function classifyDueDate(
  nextDueDate: string | null,
  today: string,
  dueSoonDays = 30,
): VaccinationDueStatus {
  if (!nextDueDate) {
    return 'NONE';
  }
  if (nextDueDate < today) {
    return 'OVERDUE';
  }
  const threshold = addDays(new Date(`${today}T00:00:00`), dueSoonDays);
  return nextDueDate <= threshold ? 'DUE_SOON' : 'SCHEDULED';
}
