import { webAssetUrl } from './cloudinary-web-assets';

describe('webAssetUrl', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('points at media/web/... on S3 when the S3 provider is active', () => {
    process.env.STORAGE_PROVIDER = 's3';
    process.env.S3_PUBLIC_BASE_URL = 'https://cdn.example.net/';
    delete process.env.S3_KEY_PREFIX;
    expect(webAssetUrl('/images/default-pet.svg')).toBe(
      'https://cdn.example.net/media/web/images/default-pet.svg',
    );
  });

  it('keeps Cloudinary when the provider is not S3', () => {
    process.env.STORAGE_PROVIDER = 'cloudinary';
    process.env.S3_PUBLIC_BASE_URL = 'https://cdn.example.net';
    expect(webAssetUrl('images/default-pet.svg')).toMatch(
      /^https:\/\/res\.cloudinary\.com\/.+\/web\/images\/default-pet\.svg$/,
    );
  });
});
