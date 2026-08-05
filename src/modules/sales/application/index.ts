/**
 * API cong khai cua bounded context `sales`.
 *
 * Hien khong module nao khac can goi vao POS - hoa don di theo chieu nguoc lai (sales
 * goi billing). Barrel nay ton tai de ranh gioi module co dung mot cua vao ke ca khi cua
 * do dang dong: ESLint `import/no-restricted-paths` chi cho phep import tu day va tu
 * `domain/entities`, nen khi P10 (bao cao doanh thu) can toi, no se duoc mo o day chu
 * khong phai bang mot import lach vao `application/pos.service`.
 */
export type { CartItemStock, CartView } from './pos.service';
