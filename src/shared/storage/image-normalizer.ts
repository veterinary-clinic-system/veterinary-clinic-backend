import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { FileCategory, IMAGE_CATEGORIES } from './file-category.enum';

const MAX_IMAGE_DIMENSION_PX = 1600;

export interface NormalizedFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

/**
 * Chuan hoa tep truoc khi day xuong kho luu tru - dung chung cho MOI adapter, vi day la
 * quy tac nghiep vu (bao mat + gioi han dung luong), khong phai chi tiet cua noi luu tru:
 *
 *   - Anh duoc ma hoa lai qua sharp: xoa metadata EXIF (tranh lo toa do GPS cho nuoi)
 *     va gioi han kich thuoc, de mot buc anh dien thoai khong lam phinh kho luu tru.
 *   - Cac loai khac (PDF ket qua xet nghiem) duoc giu nguyen.
 */
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
