/**
 * Sau khi doi chieu SRS (muc 4), day la 6 vai tro nghiep vu cua VCMS cong voi
 * PET_OWNER.
 *
 * Anh xa voi SRS:
 *   ADMIN        = Admin
 *   MANAGER      = Manager
 *   DOCTOR       = Veterinarian  <-- GIU TEN CU, KHONG DOI
 *   RECEPTIONIST = Receptionist
 *   PHARMACIST   = Pharmacist
 *   STAFF        = Staff (nhan vien ban hang)
 *   PET_OWNER    = phan mo rong ngoai SRS (SRS xep "Customer Portal" vao Could Have)
 *
 * Vi sao khong doi DOCTOR -> VETERINARIAN: ten nay nam trong kieu enum cua Postgres
 * (`users_role_enum`), trong bang `doctors`, trong payload JWT dang luu hanh, trong
 * seed va trong ca tang frontend. Doi ten khong them mot hanh vi nghiep vu nao ma
 * bat migrate du lieu song - khong dang. Anh xa duoc ghi o day mot lan.
 *
 * GUEST co y khong phai gia tri luu tru - khach chua dang nhap khong co ban ghi User
 * cho toi khi luong dat lich tu tao mot tai khoan PET_OWNER cho ho.
 */
export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  DOCTOR = 'DOCTOR',
  RECEPTIONIST = 'RECEPTIONIST',
  PHARMACIST = 'PHARMACIST',
  STAFF = 'STAFF',
  PET_OWNER = 'PET_OWNER',
}

/**
 * Vai tro lam viec tai co so - deu phai gan voi mot chi nhanh cu the.
 *
 * ADMIN dung ngoai danh sach nay vi la vai tro toan he thong (branchId luon null,
 * xem `UsersService.create`). PET_OWNER la khach hang, khong thuoc chi nhanh nao.
 */
export const BRANCH_SCOPED_ROLES: readonly Role[] = [
  Role.MANAGER,
  Role.DOCTOR,
  Role.RECEPTIONIST,
  Role.PHARMACIST,
  Role.STAFF,
];

/** Moi vai tro nhan vien - dung de loc "ai la nhan su" khoi "ai la khach hang". */
export const STAFF_ROLES: readonly Role[] = [Role.ADMIN, ...BRANCH_SCOPED_ROLES];
