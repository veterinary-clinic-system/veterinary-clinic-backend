import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { AiClientService } from '@/modules/triage/infrastructure/ai-client/ai-client.service';
import { DiagnosisDetailedResponse } from '@/modules/triage/infrastructure/ai-client/ai-client.types';
import { HttpAiPredictionAdapter } from './http-ai-prediction.adapter';

describe('HttpAiPredictionAdapter', () => {
  const response: DiagnosisDetailedResponse = {
    diseases: [
      { disease: 'DI001', disease_name: 'Viêm dạ dày', prevalence_rate: 0.82 },
      { disease: 'DI002', disease_name: null, prevalence_rate: 0.45 },
    ],
    triage_result: { color_code: 'YELLOW', reasoning: 'Nôn và bỏ ăn kéo dài.' },
    compiled: {
      symptoms: [
        { symptom: 'SY001', intensity: 2 },
        { symptom: 'SY002', intensity: 1 },
      ],
    },
    weight_adjustments: null,
  };

  function setup() {
    const client = {
      diagnose: jest.fn().mockResolvedValue(response),
      getSymptomLabels: jest.fn().mockResolvedValue(
        new Map([
          ['SY001', 'Chưa tiêm vaccin'],
          ['SY002', 'Ăn bậy'],
        ]),
      ),
      getDiseaseCodes: jest.fn().mockResolvedValue(
        new Map([
          ['viem da day', 'DI001'],
          ['suy than cap', 'DI002'],
        ]),
      ),
    };
    return {
      client,
      adapter: new HttpAiPredictionAdapter(client as unknown as AiClientService),
    };
  }

  it('maps an appointment to the deployed detailed-diagnosis contract', async () => {
    const { client, adapter } = setup();

    const result = await adapter.triage({
      symptomText: 'Nôn và bỏ ăn hai ngày',
      symptomCodes: ['SY025', 'SY011'],
      photoUrls: ['https://example.test/pet.jpg'],
      videoUrls: [],
      petSpecies: 'Chó',
      petBreed: 'Poodle',
      petGender: 'FEMALE',
      petWeight: 5,
      petAgeYears: 2,
    });

    expect(client.diagnose).toHaveBeenCalledWith({
      'pet-info': {
        breed: 'Chó',
        specie: 'Poodle',
        gender: 'F',
        weight: 5,
        age: 2,
      },
      symptoms: ['SY025', 'SY011'],
      describe: 'Nôn và bỏ ăn hai ngày',
      images: ['https://example.test/pet.jpg'],
      videos: [],
    });
    expect(result.priorityColor).toBe(PriorityColor.YELLOW);
    expect(result.suspectedGroups).toEqual([
      { name: 'Viêm dạ dày', confidence: 0.82 },
      { name: 'DI002', confidence: 0.45 },
    ]);
    expect(result.extractedKeywords).toEqual([
      'Chưa tiêm vaccin (SY001) - mức 2/3',
      'Ăn bậy (SY002) - mức 1/3',
    ]);
    expect(result.overallConfidence).toBe(0.82);
  });

  it('turns the diagnosis response into a safe public-chat reply', async () => {
    const { client, adapter } = setup();

    const result = await adapter.chat({
      message: 'Chó Poodle 2 tuổi, 5kg đang nôn và bỏ ăn',
      history: [{ role: 'user', content: 'Bé là chó cái.' }],
    });

    expect(client.diagnose).toHaveBeenCalledWith(
      expect.objectContaining({
        'pet-info': expect.objectContaining({
          breed: 'Chó',
          gender: 'F',
          weight: 5,
          age: 2,
        }),
      }),
    );
    expect(result.reply).toContain('Nên khám trong ngày');
    expect(result.reply).toContain('Viêm dạ dày (82%)');
    expect(result.reply).toContain('không thay thế chẩn đoán');
    expect(result.suggestBooking).toBe(true);
    expect(result.sessionId).toBeTruthy();
  });

  it('sends doctor-confirmed diseases as ground truth for online learning', async () => {
    const { client, adapter } = setup();

    await adapter.learn(
      {
        symptomText: 'Nôn và bỏ ăn hai ngày',
        symptomCodes: ['SY025', 'SY011'],
        photoUrls: [],
        videoUrls: [],
        petSpecies: 'Chó',
        petBreed: 'Poodle',
        petGender: 'MALE',
        petWeight: 5,
        petAgeYears: 2,
      },
      ['Viêm dạ dày', 'Bệnh không có trong AI'],
    );

    expect(client.diagnose).toHaveBeenCalledWith(expect.objectContaining({ diseases: ['DI001'] }));
  });
});
