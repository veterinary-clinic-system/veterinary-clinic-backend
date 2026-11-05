import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FileCategory } from '@/shared/storage/file-category.enum';
import { normalizeForStorage } from '@/shared/storage/image-normalizer';
import { StorageProvider, StoredFile } from '@/shared/storage/ports/storage.port';

/**
 * Lưu tệp vào bucket S3 riêng tư; tệp được phục vụ qua `S3_PUBLIC_BASE_URL` (CloudFront có
 * Origin Access Control trỏ vào bucket). Khoá đối tượng luôn bắt đầu bằng `S3_KEY_PREFIX`
 * (mặc định `media`) để behavior `/media/*` của CloudFront chuyển thẳng đường dẫn sang S3.
 * Ảnh cũ trên Cloudinary vẫn giữ nguyên URL - adapter này chỉ áp dụng cho tệp tải lên mới.
 */
export class S3StorageAdapter implements StorageProvider {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly publicBaseUrl: string;

  constructor(configService: ConfigService) {
    const bucket = configService.get<string>('files.s3.bucket');
    const region = configService.get<string>('files.s3.region');
    const publicBaseUrl = configService.get<string>('files.s3.publicBaseUrl');
    if (!bucket || !region || !publicBaseUrl) {
      throw new Error(
        'S3 storage is not configured. Set S3_BUCKET, S3_REGION and S3_PUBLIC_BASE_URL ' +
          '(credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).',
      );
    }

    this.bucket = bucket;
    this.prefix = (configService.get<string>('files.s3.keyPrefix') ?? 'media').replace(
      /^\/+|\/+$/g,
      '',
    );
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, '');
    this.client = new S3Client({ region });
  }

  async save(category: FileCategory, file: Express.Multer.File): Promise<StoredFile> {
    const { buffer, filename, contentType } = await normalizeForStorage(category, file);
    const key = [this.prefix, category, filename].filter(Boolean).join('/');

    await this.client
      .send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          // Tên tệp là UUID mới mỗi lần tải nên nội dung dưới một URL không bao giờ đổi.
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      )
      .catch(
        (error: { name?: string; message?: string; $metadata?: { httpStatusCode?: number } }) => {
          this.logger.error(
            `S3 upload failed (${category}, HTTP ${error.$metadata?.httpStatusCode ?? '?'}, ` +
              `${error.name ?? 'Error'}): ${error.message}`,
          );
          throw new ServiceUnavailableException(
            'Kho lưu trữ ảnh/video tạm thời không phản hồi, vui lòng thử lại sau ít phút.',
          );
        },
      );

    return { url: `${this.publicBaseUrl}/${key}`, path: key };
  }
}
