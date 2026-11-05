import 'dotenv/config';

function cloudNameFromEnvironment(): string | undefined {
  const explicit = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (explicit) return explicit;
  const url = process.env.CLOUDINARY_URL?.trim();
  if (!url) return undefined;
  try {
    return new URL(url).hostname || undefined;
  } catch {
    return undefined;
  }
}

export const CLOUDINARY_CLOUD_NAME = cloudNameFromEnvironment();
const cloudName = CLOUDINARY_CLOUD_NAME ?? 'cloudinary-not-configured';
const rootFolder = (process.env.CLOUDINARY_FOLDER ?? 'vetcare').replace(/^\/+|\/+$/g, '');

export function cloudinaryWebImage(relativePath: string): string {
  const path = relativePath.replace(/^\/+/, '');
  return `https://res.cloudinary.com/${cloudName}/image/upload/${rootFolder}/web/${path}`;
}

/**
 * URL ảnh tĩnh dùng chung (ảnh mặc định, ảnh bác sĩ mẫu). Khi lưu trữ là S3 thì ảnh nằm ở
 * `<S3_PUBLIC_BASE_URL>/<S3_KEY_PREFIX>/web/<path>` - scripts/migrate-cloudinary-to-s3.mjs chép
 * chúng sang đúng khoá đó. Ngược lại vẫn trỏ Cloudinary như trước.
 */
export function webAssetUrl(relativePath: string): string {
  const path = relativePath.replace(/^\/+/, '');
  const base = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  if (process.env.STORAGE_PROVIDER?.trim().toLowerCase() === 's3' && base) {
    const prefix = (process.env.S3_KEY_PREFIX?.trim() || 'media').replace(/^\/+|\/+$/g, '');
    return [base, prefix, 'web', path].filter(Boolean).join('/');
  }
  return cloudinaryWebImage(path);
}

export const DEFAULT_USER_IMAGE = webAssetUrl('images/default-user.svg');
export const DEFAULT_STAFF_IMAGE = webAssetUrl('images/default-staff.svg');
export const DEFAULT_DOCTOR_IMAGE = webAssetUrl('images/default-doctor.svg');
export const DEFAULT_PET_IMAGE = webAssetUrl('images/default-pet.svg');
export const DEFAULT_ITEM_IMAGE = webAssetUrl('images/default-item.svg');
