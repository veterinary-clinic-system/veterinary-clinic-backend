import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesController } from './files.controller';
import { STORAGE_PROVIDER } from './ports/storage.port';
import { LocalDiskStorageAdapter } from './adapters/local-disk-storage.adapter';
import { S3StorageAdapter } from './adapters/s3-storage.adapter';

/**
 * Composition root cho port StorageProvider. Day la cho duy nhat biet dang ghi tep
 * ra dia hay len S3; phan con lai cua he thong chi thay STORAGE_PROVIDER.
 */
@Module({
  controllers: [FilesController],
  providers: [
    LocalDiskStorageAdapter,
    S3StorageAdapter,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalDiskStorageAdapter, S3StorageAdapter],
      useFactory: (config: ConfigService, local: LocalDiskStorageAdapter, s3: S3StorageAdapter) =>
        config.get<string>('files.provider') === 's3' ? s3 : local,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
