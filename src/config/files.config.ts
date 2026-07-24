import { registerAs } from '@nestjs/config';

export default registerAs('files', () => ({
  storageRoot: process.env.FILE_STORAGE_ROOT ?? './uploads',
  publicBaseUrl: process.env.FILE_PUBLIC_BASE_URL ?? 'http://localhost:3000/uploads',
}));
