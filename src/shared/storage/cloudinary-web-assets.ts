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

export const DEFAULT_USER_IMAGE = cloudinaryWebImage('images/default-user.svg');
export const DEFAULT_STAFF_IMAGE = cloudinaryWebImage('images/default-staff.svg');
export const DEFAULT_DOCTOR_IMAGE = cloudinaryWebImage('images/default-doctor.svg');
export const DEFAULT_PET_IMAGE = cloudinaryWebImage('images/default-pet.svg');
export const DEFAULT_ITEM_IMAGE = cloudinaryWebImage('images/default-item.svg');
