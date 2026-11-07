import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesController } from './files.controller';
import { STORAGE_PROVIDER, StorageProvider } from './ports/storage.port';
import { S3StorageAdapter } from './adapters/s3-storage.adapter';

@Module({
  controllers: [FilesController],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): StorageProvider =>
        new S3StorageAdapter(configService),
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
