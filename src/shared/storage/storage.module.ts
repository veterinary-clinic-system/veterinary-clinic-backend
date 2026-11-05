import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesController } from './files.controller';
import { STORAGE_PROVIDER, StorageProvider } from './ports/storage.port';
import { CloudinaryStorageAdapter } from './adapters/cloudinary-storage.adapter';
import { S3StorageAdapter } from './adapters/s3-storage.adapter';

@Module({
  controllers: [FilesController],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      // Chỉ dựng adapter được chọn: adapter Cloudinary ném lỗi lúc khởi động khi thiếu khoá,
      // nên máy chủ đã chuyển sang S3 không cần giữ khoá Cloudinary.
      useFactory: (configService: ConfigService): StorageProvider => {
        if (configService.get<string>('files.provider') === 's3') {
          return new S3StorageAdapter(configService);
        }
        const adapter = new CloudinaryStorageAdapter(configService);
        adapter.onModuleInit();
        return adapter;
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
