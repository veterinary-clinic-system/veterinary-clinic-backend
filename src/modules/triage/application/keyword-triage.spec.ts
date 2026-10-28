import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { keywordTriage } from '@/modules/triage/application/keyword-triage';

describe('keywordTriage', () => {
  it.each([
    ['Bé bị co giật và sùi bọt mép', PriorityColor.RED],
    ['Mèo thở gấp, lưỡi tím tái', PriorityColor.RED],
    ['Chó lỡ ăn phải thuốc chuột hồi sáng', PriorityColor.RED],
    ['meo duc khong di tieu duoc tu hom qua', PriorityColor.RED],
    ['Bé nôn ra máu', PriorityColor.ORANGE],
    ['Cún đi ngoài ra máu, lừ đừ', PriorityColor.ORANGE],
    ['Bé cún nhà em bị nôn mửa và bỏ ăn 2 ngày nay, có nguy hiểm không?', PriorityColor.ORANGE],
    ['Mèo bị ngứa và rụng lông', PriorityColor.YELLOW],
    ['Bé hắt hơi sổ mũi', PriorityColor.YELLOW],
    ['Bé vẫn ăn uống bình thường, muốn kiểm tra định kỳ', PriorityColor.GREEN],
  ])('%s → %s', (text, color) => {
    expect(keywordTriage(text).priorityColor).toBe(color);
  });

  it('bỏ qua dấu hiệu bị phủ định', () => {
    expect(keywordTriage('Bé không co giật, chỉ hơi ngứa').priorityColor).toBe(
      PriorityColor.YELLOW,
    );
  });

  it('không nhầm từ mất dấu: "ơi", "bé gái", "về", "con non"', () => {
    const result = keywordTriage('Bác sĩ ơi, bé gái nhà em mới về, là con non 2 tháng');
    expect(result.priorityColor).toBe(PriorityColor.GREEN);
    expect(result.extractedKeywords).toEqual([]);
  });

  it('ghi rõ đây là đánh giá dự phòng trong raw để báo cáo và bác sĩ phân biệt được', () => {
    const result = keywordTriage('Bé bị tiêu chảy');
    expect(result.modelVersion).toBe('keyword-rules-v1');
    expect(result.raw).toMatchObject({
      fallback: 'keyword-rules',
      triage_result: { color_code: PriorityColor.YELLOW },
    });
    expect(result.extractedKeywords).toEqual(['tiêu chảy']);
  });
});
