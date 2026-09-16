import { registerAs } from '@nestjs/config';

export default registerAs('files', () => ({
  provider: 'cloudinary',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER ?? 'vetcare',
  },
}));
