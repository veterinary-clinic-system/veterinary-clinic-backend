/**
 * Co bat thuong cua mot chi so xet nghiem - SRS FR-13-02 (P9-T5).
 *
 * `CRITICAL` KHONG BAO GIO duoc tinh tu dong. He thong chi biet mot khoang tham chieu
 * (`referenceMin`..`referenceMax`), va tu do chi ket luan duoc "trong khoang / duoi /
 * tren". Nguong nguy kich la mot phan doan lam sang: WBC 18 tren khoang 6-17 la HIGH
 * nhe, WBC 60 la mot ca cap cuu - hai truong hop nay cach nhau bang kien thuc thu y chu
 * khong bang mot phep so sanh. Vi vay `CRITICAL` chi den tu viec ky thuat vien / bac si
 * ghi de bang tay, va khi do `flagOverridden` duoc bat len de lan luu sau khong tinh lai.
 */
export enum LabResultFlag {
  NORMAL = 'NORMAL',
  LOW = 'LOW',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}
