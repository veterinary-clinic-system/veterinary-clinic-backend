import 'dotenv/config';

/**
 * URL ảnh tĩnh dùng chung (ảnh mặc định, ảnh bác sĩ mẫu).
 *
 * Có `S3_PUBLIC_BASE_URL` (production): ảnh nằm ở `<S3_PUBLIC_BASE_URL>/<S3_KEY_PREFIX>/web/<path>`
 * trên bucket S3, phục vụ qua CloudFront. Không có (máy dev, CI): trả đường dẫn tương đối
 * `/<path>` - web phục vụ đúng các tệp này trong thư mục `public/`.
 */
export function webAssetUrl(relativePath: string): string {
  const path = relativePath.replace(/^\/+/, '');
  const base = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base) return `/${path}`;
  const prefix = (process.env.S3_KEY_PREFIX?.trim() || 'media').replace(/^\/+|\/+$/g, '');
  return [base, prefix, 'web', path].filter(Boolean).join('/');
}

export const DEFAULT_USER_IMAGE = webAssetUrl('images/default-user.svg');
export const DEFAULT_STAFF_IMAGE = webAssetUrl('images/default-staff.svg');
export const DEFAULT_DOCTOR_IMAGE = webAssetUrl('images/default-doctor.svg');
export const DEFAULT_PET_IMAGE = webAssetUrl('images/default-pet.svg');
export const DEFAULT_ITEM_IMAGE = webAssetUrl('images/default-item.svg');
