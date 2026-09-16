import 'reflect-metadata';
import { config } from 'dotenv';
import { readdir, unlink } from 'fs/promises';
import { extname, join, relative, resolve, sep } from 'path';
import { v2 as cloudinary } from 'cloudinary';
import dataSource from '../src/shared/database/data-source';

config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
const rootFolder = (process.env.CLOUDINARY_FOLDER ?? 'vetcare').replace(/^\/+|\/+$/g, '');
const uploadsRoot = resolve(process.cwd(), 'uploads');
const deleteLocal = process.argv.includes('--delete-local');

if (cloudName || apiKey || apiSecret) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

const configured = cloudinary.config();
if (!configured.cloud_name || !configured.api_key || !configured.api_secret) {
  throw new Error('Cloudinary credentials are missing');
}

interface MigratedFile {
  absolutePath: string;
  relativePath: string;
  secureUrl: string;
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : Promise.resolve([path]);
    }),
  );
  return nested.flat();
}

async function uploadFile(absolutePath: string): Promise<MigratedFile> {
  const relativePath = relative(uploadsRoot, absolutePath).split(sep).join('/');
  const extension = extname(relativePath);
  const publicId = `${rootFolder}/${relativePath.slice(0, -extension.length)}`;
  const result = await cloudinary.uploader.upload(absolutePath, {
    public_id: publicId,
    resource_type: 'auto',
    overwrite: true,
    invalidate: true,
  });
  console.log(`${relativePath} -> ${result.secure_url}`);
  return { absolutePath, relativePath, secureUrl: result.secure_url };
}

async function updateDatabase(files: MigratedFile[]): Promise<void> {
  const scalarColumns = [
    ['users', 'avatar_url'],
    ['employees', 'avatar_url'],
    ['doctors', 'avatar_url'],
    ['pets', 'avatar_url'],
    ['items', 'image_url'],
  ] as const;
  const arrayColumns = [
    ['appointments', 'photo_urls'],
    ['queue_entries', 'photo_urls'],
    ['examinations', 'attachment_urls'],
    ['lab_test_orders', 'result_file_urls'],
  ] as const;

  await dataSource.transaction(async (manager) => {
    for (const file of files) {
      const pattern = `%/uploads/${file.relativePath}`;
      for (const [table, column] of scalarColumns) {
        await manager.query(
          `UPDATE "${table}" SET "${column}" = $1 WHERE "${column}" LIKE $2`,
          [file.secureUrl, pattern],
        );
      }
      for (const [table, column] of arrayColumns) {
        await manager.query(
          `UPDATE "${table}" SET "${column}" = ARRAY(
             SELECT CASE WHEN value LIKE $2 THEN $1 ELSE value END
             FROM unnest("${column}") AS value
           ) WHERE EXISTS (SELECT 1 FROM unnest("${column}") AS value WHERE value LIKE $2)`,
          [file.secureUrl, pattern],
        );
      }
    }
  });
}

async function main(): Promise<void> {
  const paths = await listFiles(uploadsRoot);
  const migrated: MigratedFile[] = [];
  for (const path of paths) migrated.push(await uploadFile(path));

  await dataSource.initialize();
  try {
    await updateDatabase(migrated);
  } finally {
    await dataSource.destroy();
  }

  if (deleteLocal) {
    for (const file of migrated) await unlink(file.absolutePath);
  }
  console.log(`Migrated ${migrated.length} uploaded files to Cloudinary.`);
}

main().catch((error) => {
  console.error('Local upload migration failed:', error);
  process.exit(1);
});
