import { IsEmail, IsOptional, IsString, MaxLength, Matches } from 'class-validator';

/**
 * `POST /catalog/suppliers` - SRS FR-17.
 *
 * KHONG co `supplierCode`: ma (NCC0001) do cot DEFAULT cua CSDL cap - xem
 * `1791000003000-ProductsAndSuppliers.ts`. De client tu dat thi hai nguoi tao cung luc
 * se sinh trung ma.
 */
export class CreateSupplierDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @Matches(/^0\d{9}$/, { message: 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxCode?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
