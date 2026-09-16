import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadApiErrorResponse, UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { FileCategory } from '@/shared/storage/file-category.enum';
import { normalizeForStorage } from '@/shared/storage/image-normalizer';
import { StorageProvider, StoredFile } from '@/shared/storage/ports/storage.port';

@Injectable()
export class CloudinaryStorageAdapter implements StorageProvider, OnModuleInit {
  private folder: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const cloudName = this.configService.get<string>('files.cloudinary.cloudName');
    const apiKey = this.configService.get<string>('files.cloudinary.apiKey');
    const apiSecret = this.configService.get<string>('files.cloudinary.apiSecret');

    // CLOUDINARY_URL is parsed automatically by the SDK. Explicit values remain
    // supported because they are easier to configure as separate Render secrets.
    cloudinary.config({
      ...(cloudName ? { cloud_name: cloudName } : {}),
      ...(apiKey ? { api_key: apiKey } : {}),
      ...(apiSecret ? { api_secret: apiSecret } : {}),
      secure: true,
    });

    const configured = cloudinary.config();
    if (!configured.cloud_name || !configured.api_key || !configured.api_secret) {
      throw new Error(
        'Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, ' +
          'CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
      );
    }

    this.folder = (this.configService.get<string>('files.cloudinary.folder') ?? 'vetcare')
      .replace(/^\/+|\/+$/g, '');
  }

  async save(category: FileCategory, file: Express.Multer.File): Promise<StoredFile> {
    const { buffer } = await normalizeForStorage(category, file);
    const result = await this.upload(buffer, `${this.folder}/${category}`);

    return {
      url: result.secure_url,
      path: `${result.resource_type}/${result.public_id}`,
    };
  }

  private upload(buffer: Buffer, folder: string): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          overwrite: false,
          unique_filename: true,
          use_filename: false,
        },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Cloudinary upload returned no result'));
          resolve(result);
        },
      );

      stream.end(buffer);
    });
  }
}
