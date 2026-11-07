import { registerAs } from '@nestjs/config';

export default registerAs('files', () => ({
  s3: {
    bucket: process.env.S3_BUCKET?.trim() || undefined,
    region: process.env.S3_REGION?.trim() || process.env.AWS_REGION?.trim() || undefined,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL?.trim() || undefined,
    keyPrefix: process.env.S3_KEY_PREFIX?.trim() || 'media',
  },
}));
