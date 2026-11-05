import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import filesConfig from '@/shared/config/files.config';
import { CloudinaryStorageAdapter } from './adapters/cloudinary-storage.adapter';
import { S3StorageAdapter } from './adapters/s3-storage.adapter';
import { STORAGE_PROVIDER } from './ports/storage.port';
import { StorageModule } from './storage.module';

const STORAGE_ENV = [
  'STORAGE_PROVIDER',
  'S3_BUCKET',
  'S3_REGION',
  'S3_PUBLIC_BASE_URL',
  'CLOUDINARY_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

async function resolveProvider(env: Record<string, string>) {
  const saved = Object.fromEntries(STORAGE_ENV.map((key) => [key, process.env[key]]));
  STORAGE_ENV.forEach((key) => delete process.env[key]);
  Object.assign(process.env, env);
  try {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [filesConfig] }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        StorageModule,
      ],
    }).compile();
    return moduleRef.get(STORAGE_PROVIDER);
  } finally {
    STORAGE_ENV.forEach((key) =>
      saved[key] === undefined ? delete process.env[key] : (process.env[key] = saved[key]),
    );
  }
}

describe('StorageModule', () => {
  it('uses S3 without needing Cloudinary keys when STORAGE_PROVIDER=s3', async () => {
    const provider = await resolveProvider({
      STORAGE_PROVIDER: 'S3',
      S3_BUCKET: 'vetcare-media',
      S3_REGION: 'ap-southeast-1',
      S3_PUBLIC_BASE_URL: 'https://cdn.example.net',
    });
    expect(provider).toBeInstanceOf(S3StorageAdapter);
  });

  it('keeps Cloudinary as the default provider', async () => {
    const provider = await resolveProvider({
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
    });
    expect(provider).toBeInstanceOf(CloudinaryStorageAdapter);
  });
});
