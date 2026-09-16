import 'reflect-metadata';
import { config } from 'dotenv';
import { readdir, unlink } from 'fs/promises';
import { extname, join, resolve } from 'path';
import { v2 as cloudinary } from 'cloudinary';

config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
const rootFolder = (process.env.CLOUDINARY_FOLDER ?? 'vetcare').replace(/^\/+|\/+$/g, '');

if (cloudName || apiKey || apiSecret) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

const configured = cloudinary.config();
if (!configured.cloud_name || !configured.api_key || !configured.api_secret) {
  throw new Error(
    'Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET first.',
  );
}

const publicRoot = resolve(process.cwd(), '../veterinary-clinic-web/public');
const groups = ['images', 'doctors'] as const;
const deleteLocal = process.argv.includes('--delete-local');

async function uploadGroup(group: (typeof groups)[number]): Promise<void> {
  const directory = join(publicRoot, group);
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || entry.name.toLowerCase() === 'readme.md') continue;
    const extension = extname(entry.name);
    const name = entry.name.slice(0, -extension.length);
    const publicId = `${rootFolder}/web/${group}/${name}`;
    const result = await cloudinary.uploader.upload(join(directory, entry.name), {
      public_id: publicId,
      resource_type: 'image',
      overwrite: true,
      invalidate: true,
    });
    console.log(`${group}/${entry.name} -> ${result.secure_url}`);
    if (deleteLocal) await unlink(join(directory, entry.name));
  }
}

async function main(): Promise<void> {
  for (const group of groups) await uploadGroup(group);
  console.log('Cloudinary web asset upload complete.');
  if (deleteLocal) console.log('Uploaded local image files were removed.');
}

main().catch((error) => {
  console.error('Cloudinary web asset upload failed:', error);
  process.exit(1);
});
