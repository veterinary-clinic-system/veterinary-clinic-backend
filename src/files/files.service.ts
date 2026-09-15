import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { FileCategory, IMAGE_CATEGORIES } from './file-category.enum';

const MAX_IMAGE_DIMENSION_PX = 1600;

@Injectable()
export class FilesService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Persists an uploaded file to the local-disk volume (prompt.md Section 2: "Local
   * disk via a Docker volume - no S3/MinIO"). Images are re-encoded through sharp
   * (strips EXIF, caps dimensions) so a phone photo can't blow up storage or leak
   * location metadata; non-image categories (lab PDFs) are written as-is.
   */
  async save(category: FileCategory, file: Express.Multer.File): Promise<{ url: string; path: string }> {
    const storageRoot = this.configService.get<string>('files.storageRoot')!;
    const categoryDir = join(storageRoot, category);
    await mkdir(categoryDir, { recursive: true });

    const isImage = IMAGE_CATEGORIES.includes(category) && file.mimetype.startsWith('image/');
    const extension = isImage ? 'jpg' : this.safeExtension(file.originalname);
    const filename = `${randomUUID()}.${extension}`;
    const absolutePath = join(categoryDir, filename);

    if (isImage) {
      await sharp(file.buffer)
        .rotate()
        .resize({
          width: MAX_IMAGE_DIMENSION_PX,
          height: MAX_IMAGE_DIMENSION_PX,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toFile(absolutePath);
    } else {
      await writeFile(absolutePath, file.buffer);
    }

    const relativePath = `${category}/${filename}`;
    const publicBaseUrl = this.configService.get<string>('files.publicBaseUrl');

    return {
      url: `${publicBaseUrl}/${relativePath}`,
      path: relativePath,
    };
  }

  private safeExtension(originalName: string): string {
    const match = /\.([a-zA-Z0-9]+)$/.exec(originalName);
    return (match?.[1] ?? 'bin').toLowerCase();
  }
}
