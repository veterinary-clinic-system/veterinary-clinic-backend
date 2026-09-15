import { FileCategory } from '@/shared/storage/file-category.enum';

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface StoredFile {
  
  url: string;
  
  path: string;
}

export interface StorageProvider {
  save(category: FileCategory, file: Express.Multer.File): Promise<StoredFile>;
}
