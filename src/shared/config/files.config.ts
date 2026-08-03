import { registerAs } from '@nestjs/config';

export default registerAs('files', () => ({
  /**
   * Chon adapter cho port StorageProvider: 'local' (mac dinh, ghi ra dia qua Docker
   * volume) hoac 's3' (MinIO khi dev/demo, S3 hoac Cloudflare R2 khi trien khai that).
   */
  provider: process.env.STORAGE_PROVIDER ?? 'local',

  storageRoot: process.env.FILE_STORAGE_ROOT ?? './uploads',
  publicBaseUrl: process.env.FILE_PUBLIC_BASE_URL ?? 'http://localhost:3000/uploads',

  s3: {
    endpoint: process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000',
    bucket: process.env.STORAGE_BUCKET ?? 'vetcare',
    region: process.env.STORAGE_REGION ?? 'us-east-1',
    accessKeyId: process.env.STORAGE_ACCESS_KEY ?? 'vetclinic',
    secretAccessKey: process.env.STORAGE_SECRET_KEY ?? 'vetclinic123',
    // MinIO dung dang duong dan (host/bucket/key), khong dung ten mien con nhu AWS.
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE !== 'false',
  },
}));
