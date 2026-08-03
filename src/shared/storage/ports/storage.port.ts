import { FileCategory } from '@/shared/storage/file-category.enum';

/**
 * Port `StorageProvider` - Phan III tai lieu kien truc.
 *
 * Ly do trung tuong hoa: noi luu tep chac chan se doi (dia cuc bo khi phat trien ->
 * MinIO khi demo -> S3/R2 khi trien khai that), va Phan V.3 da chot anh KHONG duoc
 * nam trong PostgreSQL - chi URL duoc luu trong CSDL.
 *
 * Hai adapter: LocalDiskStorageAdapter va S3StorageAdapter (dung chung cho MinIO va S3
 * vi MinIO noi giao thuc S3).
 */

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface StoredFile {
  /** URL cong khai de tra ve cho client va luu vao CSDL. */
  url: string;
  /** Duong dan/khoa noi bo trong kho luu tru, dung khi can xoa hoac ky URL tam thoi. */
  path: string;
}

export interface StorageProvider {
  save(category: FileCategory, file: Express.Multer.File): Promise<StoredFile>;
}
