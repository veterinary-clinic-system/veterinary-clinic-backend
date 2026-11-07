import { CommonSymptom } from '@/shared/common/enums/common-symptom.enum';
import {
  buildClinicalDescription,
  commonSymptomCodes,
  normalizeGenderForAi,
  normalizeSpeciesForAi,
  validAiImageUrls,
  validAiVideoUrls,
} from '@/modules/triage/application/ai-input.mapper';

describe('AI input mapping', () => {
  it('maps clinic symptoms to the deployed AI catalog', () => {
    expect(
      commonSymptomCodes([
        CommonSymptom.VOMITING,
        CommonSymptom.LOSS_OF_APPETITE,
        CommonSymptom.WEIGHT_LOSS,
      ]),
    ).toEqual(['SY025', 'SY011']);
  });

  it('builds a Vietnamese clinical description with patient context', () => {
    const description = buildClinicalDescription({
      commonSymptoms: [CommonSymptom.DIARRHEA],
      otherSymptoms: 'Kéo dài hai ngày',
      chronicConditions: ['Suy thận'],
      allergies: ['Penicillin'],
    });
    expect(description).toContain('tiêu chảy');
    expect(description).toContain('Kéo dài hai ngày');
    expect(description).toContain('Suy thận');
    expect(description).toContain('Penicillin');
  });

  it('normalizes demographics and removes unsupported media', () => {
    expect(normalizeSpeciesForAi('Mèo', 'British Shorthair')).toBe('Mèo');
    expect(normalizeGenderForAi('FEMALE')).toBe('F');
    expect(
      validAiImageUrls([
        'https://example.test/valid.jpg',
        'https://example.test/default.svg',
        'not-a-url',
      ]),
    ).toEqual(['https://example.test/valid.jpg']);
    expect(validAiVideoUrls(['https://evil.example/video.mp4'])).toEqual([]);
  });

  it('accepts videos from the configured S3/CloudFront base URL only', () => {
    expect(
      validAiVideoUrls(
        [
          'https://cdn.example.net/media/symptom-videos/a.mp4',
          'https://cdn.example.net.evil.io/media/b.mp4',
          'https://cdn.example.net/media/symptom-videos/c.gif',
        ],
        ['https://cdn.example.net/'],
      ),
    ).toEqual(['https://cdn.example.net/media/symptom-videos/a.mp4']);
  });
});
