import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { FileCategory, IMAGE_CATEGORIES } from './file-category.enum';

const MAX_IMAGE_DIMENSION_PX = 1600;

export interface NormalizedFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export async function normalizeForStorage(
  category: FileCategory,
  file: Express.Multer.File,
): Promise<NormalizedFile> {
  const isImage = IMAGE_CATEGORIES.includes(category) && file.mimetype.startsWith('image/');

  if (isImage) {
    const buffer = await sharp(file.buffer)
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION_PX,
        height: MAX_IMAGE_DIMENSION_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    return { buffer, filename: `${randomUUID()}.jpg`, contentType: 'image/jpeg' };
  }

  return {
    buffer: file.buffer,
    filename: `${randomUUID()}.${safeExtension(file.originalname)}`,
    contentType: file.mimetype || 'application/octet-stream',
  };
}

function safeExtension(originalName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(originalName);
  return (match?.[1] ?? 'bin').toLowerCase();
}
