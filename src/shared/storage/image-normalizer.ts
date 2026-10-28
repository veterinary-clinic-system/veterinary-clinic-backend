import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
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
    // MIME do trình duyệt khai, không phải nội dung thật: tệp hỏng hoặc đổi đuôi làm sharp
    // ném lỗi - đó là lỗi của tệp gửi lên (400), không phải lỗi hệ thống (500).
    const buffer = await sharp(file.buffer)
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION_PX,
        height: MAX_IMAGE_DIMENSION_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer()
      .catch(() => {
        throw new BadRequestException(
          'Không đọc được ảnh - tệp bị hỏng hoặc không phải ảnh JPG/PNG/WEBP.',
        );
      });

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
