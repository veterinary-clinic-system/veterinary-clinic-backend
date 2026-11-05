import { registerAs } from '@nestjs/config';

export default registerAs('files', () => ({
  provider: process.env.STORAGE_PROVIDER?.trim().toLowerCase() || 'cloudinary',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER ?? 'vetcare',
  },
  s3: {
    bucket: process.env.S3_BUCKET?.trim() || undefined,
    region: process.env.S3_REGION?.trim() || process.env.AWS_REGION?.trim() || undefined,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL?.trim() || undefined,
    keyPrefix: process.env.S3_KEY_PREFIX?.trim() || 'media',
  },
}));
