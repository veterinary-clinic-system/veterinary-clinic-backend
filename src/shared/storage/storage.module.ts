import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { STORAGE_PROVIDER } from './ports/storage.port';
import { CloudinaryStorageAdapter } from './adapters/cloudinary-storage.adapter';

@Module({
  controllers: [FilesController],
  providers: [
    CloudinaryStorageAdapter,
    {
      provide: STORAGE_PROVIDER,
      useExisting: CloudinaryStorageAdapter,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
