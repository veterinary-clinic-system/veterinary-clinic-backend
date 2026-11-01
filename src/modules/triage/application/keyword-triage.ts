import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { AiTriageResult } from '@/modules/triage/application/ports/ai-prediction.port';

/**
 * Phân loại dự phòng khi dịch vụ AI không phản hồi: so mô tả của chủ nuôi với các dấu hiệu
 * cảnh báo thường gặp. Thô hơn mô hình nhiều, nhưng một ca "co giật, khó thở" vẫn phải
 * được gắn RED thay vì để lịch hẹn không có mức ưu tiên nào.
 *
 * Mẫu viết trên chữ đã bỏ dấu, nên phải tránh từ trùng nghĩa khi mất dấu:
 * "ói" ≠ "ơi", "gãi" ≠ "gái", "ve" (ve chó) ≠ "về", "ghẻ" ≠ "ghé", "nôn" ≠ "con non".
 */
interface Sign {
  label: string;
  pattern: RegExp;
}

const RED_SIGNS: Sign[] = [
  { label: 'co giật', pattern: /\bco giat\b/ },
  {
    label: 'khó thở',
    pattern:
      /\b(kho tho|tho gap|tho doc|tho hoc|tho hon hen|tho kho khan|ha mieng tho|tim tai|luoi tim)\b/,
  },
  { label: 'sùi bọt mép', pattern: /\bsui bot\b/ },
  { label: 'ngất / bất tỉnh', pattern: /\b(ngat xiu|bi ngat|bat tinh|hon me)\b/ },
  { label: 'chảy máu nhiều', pattern: /\b(chay mau nhieu|xuat huyet|mat mau)\b/ },
  {
    label: 'nghi ngộ độc',
    pattern: /\b(ngo doc|thuoc chuot|thuoc diet|an phai (ba|thuoc|socola|chocolate|nho))\b/,
  },
  { label: 'tai nạn / chấn thương nặng', pattern: /\b(tai nan|xe (tong|can)|nga tu tren cao)\b/ },
  { label: 'không đi tiểu được', pattern: /\b(khong (di )?tieu duoc|bi bi tieu|bi tac tieu)\b/ },
  // GDV (xoắn dạ dày) hay được tả ngược: "bụng hơi chướng", "bụng căng".
  {
    label: 'chướng bụng',
    pattern: /\b(chuong bung|chuong hoi|bung (hoi |bi |rat )?(chuong|truong|cang)|xoan da day)\b/,
  },
  { label: 'sốt sữa / đẻ khó', pattern: /\b(sot sua|de kho)\b/ },
  { label: 'sốc nhiệt', pattern: /\b(say nang|soc nhiet)\b/ },
];

const ORANGE_SIGNS: Sign[] = [
  { label: 'nôn ra máu', pattern: /\b(non|oi) (ra )?mau\b/ },
  {
    label: 'đi ngoài ra máu',
    pattern: /\b(di ngoai|di ia|tieu chay|phan) (ra |co )?mau\b/,
  },
  { label: 'tiểu ra máu', pattern: /\b(tieu ra mau|nuoc tieu (co )?mau)\b/ },
  { label: 'nôn liên tục', pattern: /\b(non|oi) (lien tuc|nhieu lan|suot)\b/ },
  {
    label: 'lừ đừ, kiệt sức',
    pattern:
      /\b(li bi|lu du|lo do|met la|yeu (lu|ot)|khong (dung|di) (day|len|noi)( duoc)?|bi liet)\b/,
  },
  { label: 'mất nước', pattern: /\b(mat nuoc|mat trung sau)\b/ },
  { label: 'sốt cao', pattern: /\bsot cao\b/ },
  {
    label: 'gãy xương / vết thương sâu',
    pattern: /\b(gay (xuong|chan)|vet thuong (sau|ho|lon)|bi can)\b/,
  },
  {
    label: 'bỏ ăn uống hoàn toàn',
    pattern: /\b(bo an (uong )?hoan toan|khong (an )?uong (nuoc|gi)|bo ca an lan uong)\b/,
  },
];

const YELLOW_SIGNS: Sign[] = [
  { label: 'nôn', pattern: /(?<!con )\b(non|non mua|bi oi|hay oi|oi mua)\b/ },
  { label: 'tiêu chảy', pattern: /\b(tieu chay|di ngoai long|phan long|di long)\b/ },
  { label: 'bỏ ăn / chán ăn', pattern: /\b(bo an|chan an|an (it|kem)|khong (chiu )?an)\b/ },
  { label: 'sốt', pattern: /\b(sot|nong (nguoi|tai))\b/ },
  {
    label: 'ho / hắt hơi / sổ mũi',
    pattern:
      /\b(bi ho|hay ho|ho (khan|nhieu|lien|co dom|sac|suot)|hat hoi|chay nuoc mui|so mui|kho khe)\b/,
  },
  {
    label: 'vấn đề về da, lông',
    pattern:
      /\b(ngua|hay gai|gai (nhieu|lien|suot|tai)|rung long|man do|noi man|bi ghe|nam da|bi ve|bo chet|bi ran|co ran)\b/,
  },
  { label: 'đi khập khiễng', pattern: /\b(khap khieng|tap tenh|dau chan|que chan)\b/ },
  {
    label: 'vấn đề về mắt, tai',
    pattern:
      /\b(mat (do|sung|chay nuoc|duc)|chay ghen|nhieu ghen|viem tai|tai (hoi|do|chay dich))\b/,
  },
  { label: 'sụt cân', pattern: /\b(sut can|gay sut|gay di)\b/ },
  { label: 'mệt mỏi', pattern: /\b(met moi|ue oai|khong muon choi)\b/ },
  { label: 'vết thương ngoài da', pattern: /\b(vet thuong|tray xuoc|bi thuong)\b/ },
  { label: 'uống / tiểu nhiều bất thường', pattern: /\b(uong nhieu nuoc|tieu nhieu)\b/ },
];

const NEGATION_BEFORE = /\b(khong|chua|het|da het|ko)\s+$/;
/** "2 ngày nay", "mấy ngày", "cả tuần" - bệnh kéo dài làm ca nhiều dấu hiệu nặng thêm một bậc. */
const PROLONGED = /\b([2-9]|\d{2}|hai|ba|bon|nam|may|vai|nhieu) ngay\b|\btuan\b/;

export const KEYWORD_TRIAGE_MODEL_VERSION = 'keyword-rules-v1';

function normalize(text: string): string {
  return text
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchSigns(text: string, signs: Sign[]): string[] {
  return signs
    .filter(({ pattern }) => {
      const global = new RegExp(pattern.source, 'g');
      for (const match of text.matchAll(global)) {
        if (!NEGATION_BEFORE.test(text.slice(0, match.index))) return true;
      }
      return false;
    })
    .map((sign) => sign.label);
}

export function keywordTriage(symptomText: string): AiTriageResult {
  const text = normalize(symptomText);
  const red = matchSigns(text, RED_SIGNS);
  const orange = matchSigns(text, ORANGE_SIGNS);
  const yellow = matchSigns(text, YELLOW_SIGNS);

  let priorityColor = PriorityColor.GREEN;
  if (red.length > 0) priorityColor = PriorityColor.RED;
  else if (orange.length > 0) priorityColor = PriorityColor.ORANGE;
  else if (yellow.length >= 2 && PROLONGED.test(text)) priorityColor = PriorityColor.ORANGE;
  else if (yellow.length > 0) priorityColor = PriorityColor.YELLOW;

  const signs = [...red, ...orange, ...yellow];
  const reasoning =
    'Dịch vụ AI đang tạm không phản hồi nên đây là đánh giá nhanh theo từ khoá trong mô tả: ' +
    (signs.length > 0
      ? `ghi nhận ${signs.join(', ')}.`
      : // Không khớp từ nào chưa có nghĩa là bé khoẻ - đừng trấn an chủ nuôi.
        'không nhận ra dấu hiệu nào trong danh sách từ khoá. Cách đánh giá này rất thô nên ' +
        'không loại trừ được bệnh - nếu bé mệt, bỏ ăn hay có biểu hiện lạ, hãy cho bé đi khám.');

  return {
    priorityColor,
    suspectedGroups: [],
    extractedKeywords: signs,
    nlpConfidence: 0,
    cvConfidence: null,
    overallConfidence: 0,
    raw: {
      fallback: 'keyword-rules',
      triage_result: { color_code: priorityColor, reasoning },
      matched: { red, orange, yellow },
    },
    modelVersion: KEYWORD_TRIAGE_MODEL_VERSION,
  };
}
