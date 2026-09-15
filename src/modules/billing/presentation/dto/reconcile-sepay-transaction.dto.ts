import { IsString, Matches } from 'class-validator';

export class ReconcileSepayTransactionDto {
  @IsString()
  @Matches(/^HD\d+$/i, { message: 'invoiceCode phải có dạng HDxxxxxx' })
  invoiceCode: string;
}
