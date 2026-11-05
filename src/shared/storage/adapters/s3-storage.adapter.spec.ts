import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FileCategory } from '@/shared/storage/file-category.enum';
import { S3StorageAdapter } from './s3-storage.adapter';

function config(s3: Record<string, string | undefined>): ConfigService {
  return new ConfigService({ files: { provider: 's3', s3 } });
}

const pdf = {
  buffer: Buffer.from('%PDF-1.4'),
  mimetype: 'application/pdf',
  originalname: 'ket-qua.PDF',
  size: 8,
} as Express.Multer.File;

describe('S3StorageAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('refuses to start without bucket, region and public URL', () => {
    expect(() => new S3StorageAdapter(config({ bucket: 'b', region: 'ap-southeast-1' }))).toThrow(
      /S3_PUBLIC_BASE_URL/,
    );
  });

  it('uploads under the key prefix and returns the CloudFront URL', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    const adapter = new S3StorageAdapter(
      config({
        bucket: 'vetcare-media',
        region: 'ap-southeast-1',
        publicBaseUrl: 'https://cdn.example.net/',
        keyPrefix: '/media/',
      }),
    );

    const stored = await adapter.save(FileCategory.LAB_RESULT, pdf);

    expect(stored.path).toMatch(/^media\/lab-results\/[0-9a-f-]{36}\.pdf$/);
    expect(stored.url).toBe(`https://cdn.example.net/${stored.path}`);
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command.input).toMatchObject({
      Bucket: 'vetcare-media',
      Key: stored.path,
      ContentType: 'application/pdf',
    });
  });

  it('maps S3 errors to 503', async () => {
    jest.spyOn(S3Client.prototype, 'send').mockRejectedValue(new Error('AccessDenied') as never);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const adapter = new S3StorageAdapter(
      config({ bucket: 'b', region: 'ap-southeast-1', publicBaseUrl: 'https://cdn.example.net' }),
    );

    await expect(adapter.save(FileCategory.LAB_RESULT, pdf)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
