import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileCategory } from '@/shared/storage/file-category.enum';
import { normalizeForStorage } from '@/shared/storage/image-normalizer';
import { StorageProvider, StoredFile } from '@/shared/storage/ports/storage.port';

@Injectable()
export class S3StorageAdapter implements StorageProvider, OnModuleInit {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const endpoint = this.configService.get<string>('files.s3.endpoint');
    this.bucket = this.configService.get<string>('files.s3.bucket')!;
    this.publicBaseUrl =
      this.configService.get<string>('files.publicBaseUrl') ?? `${endpoint}/${this.bucket}`;

    this.client = new S3Client({
      region: this.configService.get<string>('files.s3.region')!,
      endpoint,
      forcePathStyle: this.configService.get<boolean>('files.s3.forcePathStyle'),
      credentials: {
        accessKeyId: this.configService.get<string>('files.s3.accessKeyId')!,
        secretAccessKey: this.configService.get<string>('files.s3.secretAccessKey')!,
      },
    });
  }

  async save(category: FileCategory, file: Express.Multer.File): Promise<StoredFile> {
    const { buffer, filename, contentType } = await normalizeForStorage(category, file);
    const key = `${category}/${filename}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return { url: `${this.publicBaseUrl}/${key}`, path: key };
  }
}
