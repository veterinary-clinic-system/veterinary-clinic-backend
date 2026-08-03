import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { FileCategory } from '@/shared/storage/file-category.enum';
import { normalizeForStorage } from '@/shared/storage/image-normalizer';
import { StorageProvider, StoredFile } from '@/shared/storage/ports/storage.port';

/**
 * Adapter luu tru tren dia cuc bo (qua Docker volume). Mac dinh khi phat trien:
 * khong can dung MinIO/S3 chi de chay thu mot man hinh.
 */
@Injectable()
export class LocalDiskStorageAdapter implements StorageProvider {
  constructor(private readonly configService: ConfigService) {}

  async save(category: FileCategory, file: Express.Multer.File): Promise<StoredFile> {
    const { buffer, filename } = await normalizeForStorage(category, file);

    const storageRoot = this.configService.get<string>('files.storageRoot')!;
    const categoryDir = join(storageRoot, category);
    await mkdir(categoryDir, { recursive: true });
    await writeFile(join(categoryDir, filename), buffer);

    const relativePath = `${category}/${filename}`;
    const publicBaseUrl = this.configService.get<string>('files.publicBaseUrl');

    return { url: `${publicBaseUrl}/${relativePath}`, path: relativePath };
  }
}
