import { webAssetUrl } from './web-assets';

describe('webAssetUrl', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('points at media/web/... on S3 when a public base URL is set', () => {
    process.env.S3_PUBLIC_BASE_URL = 'https://cdn.example.net/';
    delete process.env.S3_KEY_PREFIX;
    expect(webAssetUrl('/images/default-pet.svg')).toBe(
      'https://cdn.example.net/media/web/images/default-pet.svg',
    );
  });

  it('falls back to the web app public path without S3', () => {
    delete process.env.S3_PUBLIC_BASE_URL;
    expect(webAssetUrl('images/default-pet.svg')).toBe('/images/default-pet.svg');
  });
});
