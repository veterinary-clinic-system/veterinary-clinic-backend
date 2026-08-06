import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Dia chi IP that cua nguoi goi - FR-26 doi cot nay trong nhat ky kiem toan.
 *
 * `x-forwarded-for` di TRUOC `request.ip`: o moi truong that API luon nam sau mot reverse
 * proxy, va khi do `request.ip` la IP cua chinh proxy - moi dong audit se mang cung mot
 * dia chi va cot nay thanh vo dung. Lay phan tu DAU cua chuoi, do la client that (cac
 * phan tu sau la cac proxy trung gian).
 *
 * MOT CANH BAO: header nay do client gui nen GIA MAO DUOC. No du de tra loi "may nao da
 * lam viec nay" trong mot ky kiem toan noi bo, nhung khong duoc dung lam co so cho bat ky
 * quyet dinh bao mat nao (chan IP, xac thuc). Muon tin duoc no thi phai cau hinh proxy
 * ghi de header va bat `trust proxy` cho dung so lop - viec cua tang van hanh.
 */
export function resolveClientIp(request: Request): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  return request.ip ?? null;
}

/**
 * `@ClientIp()` - dung cho cac handler phai tu ghi audit thay vi qua interceptor.
 *
 * Chi co dang nhap / dang xuat can toi no: hai hanh dong do XAC LAP danh tinh nguoi goi
 * chu khong xay ra sau khi da co danh tinh, nen interceptor (doc `request.user`) khong
 * biet ai vua dang nhap. Xem `AuthService.login`.
 */
export const ClientIp = createParamDecorator((_: unknown, context: ExecutionContext) =>
  resolveClientIp(context.switchToHttp().getRequest<Request>()),
);
