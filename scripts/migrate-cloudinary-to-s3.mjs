// Chép mọi tệp Cloudinary mà hệ thống còn dùng sang S3 và đổi URL trong DB.
//
// Chạy TRÊN MÁY CHỦ, bên trong image api (đã có pg + @aws-sdk/client-s3 và đủ biến môi trường):
//   docker compose --env-file prod.env -f docker-compose.prod.yml run --rm --no-deps \
//     -v "$PWD/scripts:/app/scripts:ro" api node scripts/migrate-cloudinary-to-s3.mjs [--apply]
//
// Không có --apply: chỉ liệt kê URL tìm thấy và khoá S3 sẽ dùng, không ghi gì.
// Có --apply: tải từng tệp từ Cloudinary, ghi lên S3, rồi đổi URL trong MỘT transaction
// (cột text/varchar, mảng text, json/jsonb và DEFAULT của cột). Chạy lại an toàn: lần sau
// không còn URL Cloudinary nào để đổi. Tệp tải lỗi được giữ nguyên URL cũ và in ra cuối.
//
// Khoá S3: <S3_KEY_PREFIX>/<đường dẫn sau thư mục gốc CLOUDINARY_FOLDER>, ví dụ
//   https://res.cloudinary.com/x/image/upload/v17/vetcare/pet-avatars/abc.jpg
//   -> media/pet-avatars/abc.jpg
// Ảnh tĩnh của web (WEB_ASSETS) luôn được chép, kể cả khi DB không nhắc tới, vì web và
// backend dựng URL của chúng theo đúng khoá media/web/... (webAssetUrl / mediaImage).
import { pathToFileURL } from 'node:url';

const CLOUDINARY_URL_RE = /https:\/\/res\.cloudinary\.com\/[^\s"'<>\\{}]+/g;

export const WEB_ASSETS = [
  ...['default-user', 'default-staff', 'default-item', 'default-doctor', 'default-pet'].map(
    (name) => ({ source: `web/images/${name}.svg`, key: `web/images/${name}.svg` }),
  ),
  ...[1, 2, 3, 4, 5, 6].map((index) => ({
    source: `web/doctors/doctor-${index}.svg`,
    key: `web/doctors/doctor-${index}.svg`,
  })),
  // Ảnh chụp lớn (1,5-2 MB PNG): chép bản WebP Cloudinary nén sẵn, web trỏ tới đuôi .webp.
  ...[
    'pets-photoreal-v1.png',
    'golden-retriever-walking-v1.png',
    'british-shorthair-jumping-v1.png',
    'pet-companion-poster.jpg',
  ].map((file) => ({
    source: `web/images/${file}`,
    transform: 'f_webp,q_auto',
    key: `web/images/${file.replace(/\.[a-z]+$/, '.webp')}`,
  })),
];

/** Tách các URL Cloudinary trong một chuỗi (bỏ dấu câu dính ở cuối). */
export function extractCloudinaryUrls(text) {
  return [...String(text).matchAll(CLOUDINARY_URL_RE)].map((m) => m[0].replace(/[.,;:)\]]+$/, ''));
}

/** URL Cloudinary -> khoá S3 (không gồm tiền tố), hoặc null nếu không phải URL tệp đã tải lên. */
export function keyForCloudinaryUrl(url, rootFolder) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // /<cloud>/<image|video|raw>/upload/[biến đổi/][v123/]<public_id>.<đuôi>
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 4 || parts[2] !== 'upload') return null;
  let rest = parts.slice(3);
  while (rest.length > 1 && /^[a-z]{1,3}_[^/]*$/.test(rest[0])) rest = rest.slice(1);
  if (rest.length > 1 && /^v\d+$/.test(rest[0])) rest = rest.slice(1);
  if (rootFolder && rest[0] === rootFolder && rest.length > 1) rest = rest.slice(1);
  const key = rest.map(decodeURIComponent).join('/');
  return /\.[A-Za-z0-9]+$/.test(key) ? key : null;
}

/** URL công khai của một khoá S3 (mã hoá từng đoạn đường dẫn). */
export function publicUrl(base, key) {
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function findColumns(client) {
  const { rows } = await client.query(`
    SELECT table_name, column_name, data_type, udt_name, column_default
    FROM information_schema.columns c
    JOIN information_schema.tables t USING (table_schema, table_name)
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND (data_type IN ('text', 'character varying', 'json', 'jsonb')
           OR (data_type = 'ARRAY' AND udt_name IN ('_text', '_varchar')))`);
  return rows.map((row) => ({
    table: row.table_name,
    column: row.column_name,
    kind:
      row.data_type === 'ARRAY'
        ? 'array'
        : row.data_type.startsWith('json')
          ? row.data_type
          : 'text',
    columnDefault: row.column_default,
  }));
}

async function collectUrls(client, columns) {
  const found = new Map(); // url -> Set("bảng.cột")
  for (const col of columns) {
    const t = quoteIdent(col.table);
    const c = quoteIdent(col.column);
    const { rows } = await client.query(
      `SELECT ${c}::text AS v FROM ${t} WHERE ${c}::text LIKE '%res.cloudinary.com%'`,
    );
    for (const value of [...rows.map((r) => r.v), col.columnDefault ?? '']) {
      for (const url of extractCloudinaryUrls(value)) {
        if (!found.has(url)) found.set(url, new Set());
        found.get(url).add(`${col.table}.${col.column}`);
      }
    }
  }
  return found;
}

async function replaceEverywhere(client, columns, oldUrl, newUrl) {
  let changed = 0;
  for (const col of columns) {
    const t = quoteIdent(col.table);
    const c = quoteIdent(col.column);
    let sql;
    if (col.kind === 'text') {
      sql = `UPDATE ${t} SET ${c} = replace(${c}, $1, $2) WHERE strpos(${c}, $1) > 0`;
    } else if (col.kind === 'array') {
      sql = `UPDATE ${t} SET ${c} = ARRAY(
               SELECT replace(v, $1, $2) FROM unnest(${c}) WITH ORDINALITY AS u(v, i) ORDER BY i)
             WHERE strpos(${c}::text, $1) > 0`;
    } else {
      sql = `UPDATE ${t} SET ${c} = replace(${c}::text, $1, $2)::${col.kind}
             WHERE strpos(${c}::text, $1) > 0`;
    }
    changed += (await client.query(sql, [oldUrl, newUrl])).rowCount ?? 0;
    if (col.columnDefault?.includes(oldUrl)) {
      const expr = col.columnDefault.split(oldUrl).join(newUrl);
      await client.query(`ALTER TABLE ${t} ALTER COLUMN ${c} SET DEFAULT ${expr}`);
      col.columnDefault = expr;
    }
  }
  return changed;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const env = (name, fallback) => process.env[name]?.trim() || fallback;
  const bucket = env('S3_BUCKET');
  const region = env('S3_REGION', env('AWS_REGION'));
  const base = env('S3_PUBLIC_BASE_URL')?.replace(/\/+$/, '');
  const prefix = env('S3_KEY_PREFIX', 'media').replace(/^\/+|\/+$/g, '');
  const rootFolder = env('CLOUDINARY_FOLDER', 'vetcare').replace(/^\/+|\/+$/g, '');
  const cloudName = env('CLOUDINARY_CLOUD_NAME', env('CLOUDINARY_URL', '').replace(/^.*@/, ''));
  if (!bucket || !region || !base)
    throw new Error('Thiếu S3_BUCKET, S3_REGION hoặc S3_PUBLIC_BASE_URL');

  const { default: pg } = await import('pg');
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new pg.Client({
    host: env('DB_HOST', 'localhost'),
    port: Number(env('DB_PORT', '5432')),
    user: env('DB_USERNAME', 'vetclinic'),
    password: env('DB_PASSWORD', 'vetclinic'),
    database: env('DB_DATABASE', 'veterinary_clinic'),
  });
  const s3 = new S3Client({ region });
  await client.connect();

  try {
    const columns = await findColumns(client);
    const found = await collectUrls(client, columns);
    const jobs = []; // { source, key, oldUrl? }
    const skipped = [];
    for (const [url, where] of found) {
      const key = keyForCloudinaryUrl(url, rootFolder);
      if (key) jobs.push({ source: url, key: `${prefix}/${key}`, oldUrl: url, where: [...where] });
      else skipped.push(url);
    }
    if (cloudName) {
      for (const asset of WEB_ASSETS) {
        const source = `https://res.cloudinary.com/${cloudName}/image/upload/${
          asset.transform ? `${asset.transform}/` : ''
        }${rootFolder}/${asset.source}`;
        if (!jobs.some((job) => job.key === `${prefix}/${asset.key}`)) {
          jobs.push({ source, key: `${prefix}/${asset.key}`, where: ['ảnh tĩnh web'] });
        }
      }
    } else {
      console.warn('Không có CLOUDINARY_CLOUD_NAME: bỏ qua ảnh tĩnh web không có trong DB.');
    }

    console.log(
      `Tìm thấy ${found.size} URL Cloudinary trong ${columns.length} cột; ${jobs.length} tệp cần chép.`,
    );
    for (const job of jobs)
      console.log(`  ${job.source}\n    -> ${publicUrl(base, job.key)}  [${job.where.join(', ')}]`);
    for (const url of skipped) console.log(`  BỎ QUA (không phải tệp tải lên): ${url}`);
    if (!apply) {
      console.log('\nChạy thử xong, chưa ghi gì. Thêm --apply để chép và đổi URL.');
      return;
    }

    const failed = [];
    const copied = [];
    for (const job of jobs) {
      try {
        const response = await fetch(job.source);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = Buffer.from(await response.arrayBuffer());
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: job.key,
            Body: body,
            ContentType: response.headers.get('content-type') ?? 'application/octet-stream',
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
        copied.push(job);
        console.log(`  ĐÃ CHÉP ${job.key} (${body.length} byte)`);
      } catch (error) {
        failed.push({ job, error });
        console.log(`  LỖI ${job.source}: ${error.message}`);
      }
    }

    await client.query('BEGIN');
    try {
      let rows = 0;
      for (const job of copied.filter((j) => j.oldUrl)) {
        rows += await replaceEverywhere(client, columns, job.oldUrl, publicUrl(base, job.key));
      }
      await client.query('COMMIT');
      console.log(`\nĐã chép ${copied.length} tệp, đổi URL ở ${rows} dòng.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    if (failed.length) {
      console.log(`${failed.length} tệp lỗi, giữ nguyên URL Cloudinary:`);
      for (const { job } of failed) console.log(`  ${job.source}`);
      process.exitCode = 2;
    }
  } finally {
    await client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error('Chuyển Cloudinary -> S3 thất bại:', error);
    process.exit(1);
  });
}
