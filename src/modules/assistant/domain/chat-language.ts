/**
 * Bộ phân tích tiếng Việt cho trợ lý đặt lịch - toàn hàm thuần, không đụng DB, để test
 * được từng câu khách hay gõ.
 *
 * Nguyên tắc chung:
 *  - Khớp từ theo RANH GIỚI CHỮ CÁI UNICODE (`hasWord`), không dùng `\b` của JS: `\b`
 *    coi "ó" trong "chó" là ký tự phân cách, và "mai" sẽ khớp cả "email".
 *  - Từ dễ nhập nhằng khi bỏ dấu ("cho" = chó/cho, "ve" = ve/về, "dau" = đau/đâu, "mai"
 *    = mai/mãi) chỉ khớp trên bản CÓ dấu. Bản bỏ dấu chỉ dùng khi khách gõ không dấu cả
 *    câu (`isUnaccented`).
 *  - SĐT và email bị gỡ khỏi câu trước khi tìm ngày/giờ, để "0912 345 678" không thành
 *    "9 giờ" và "...@gmail.com" không thành "ngày mai".
 */

export type DayPeriod = 'morning' | 'afternoon';

/** Chữ thường + chuẩn hoá Unicode dựng sẵn (bàn phím Telex/VNI sinh ra cả hai dạng). */
export function normalizeText(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
}

export function stripDiacritics(value: string): string {
  return normalizeText(value).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/** Câu không có một dấu tiếng Việt nào - khách gõ không dấu. */
export function isUnaccented(value: string): boolean {
  return stripDiacritics(value) === normalizeText(value).replace(/đ/g, 'd');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `phrase` xuất hiện như một cụm từ trọn vẹn (không dính chữ cái/chữ số hai bên). */
export function hasWord(text: string, phrase: string): boolean {
  const pattern = escapeRegExp(phrase).replace(/ /g, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'u').test(text);
}

function hasAnyWord(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => hasWord(text, phrase));
}

/** Khớp cụm có dấu trên câu có dấu; nếu khách gõ không dấu thì khớp bản bỏ dấu. */
function mentions(raw: string, phrases: string[]): boolean {
  const accented = normalizeText(raw);
  if (hasAnyWord(accented, phrases)) return true;
  if (!isUnaccented(raw)) return false;
  const plain = stripDiacritics(raw);
  return phrases.some((phrase) => hasWord(plain, stripDiacritics(phrase)));
}

// ---------------------------------------------------------------- liên hệ

const PHONE_PATTERN = /(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){9}(?!\d)/;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

/** SĐT di động/cố định VN, trả về dạng 0xxxxxxxxx. */
export function extractPhone(text: string): string | undefined {
  const match = text.match(PHONE_PATTERN);
  if (!match) return undefined;
  const digits = match[0].replace(/\D/g, '');
  const local = digits.startsWith('84') ? `0${digits.slice(2)}` : digits;
  return /^0[235789]\d{8}$/.test(local) ? local : undefined;
}

export function extractEmail(text: string): string | undefined {
  return text.match(EMAIL_PATTERN)?.[0].toLowerCase();
}

export function removeContacts(text: string): string {
  return text
    .replace(new RegExp(EMAIL_PATTERN.source, 'gi'), ' ')
    .replace(new RegExp(PHONE_PATTERN.source, 'g'), ' ');
}

// ---------------------------------------------------------------- ngày giờ

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysLocal(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

const WEEKDAY_WORDS: Array<[string, number]> = [
  ['chủ nhật', 0],
  ['cn', 0],
  ['thứ hai', 1],
  ['thứ 2', 1],
  ['thứ ba', 2],
  ['thứ 3', 2],
  ['thứ tư', 3],
  ['thứ 4', 3],
  ['thứ năm', 4],
  ['thứ 5', 4],
  ['thứ sáu', 5],
  ['thứ 6', 5],
  ['thứ bảy', 6],
  ['thứ 7', 6],
];

/**
 * Ngày khách nhắc tới, dạng yyyy-MM-dd theo giờ máy chủ. Hiểu: hôm nay, (ngày) mai,
 * ngày kia/mốt, thứ 2..CN (kèm "tuần sau"), 20/10, 20/10/2026, "ngày 20", "20 tháng 10".
 * Trả về ngày đúng như khách nói - kể cả hôm nay/quá khứ; việc từ chối là của tầng đặt
 * lịch, để còn giải thích được cho khách thay vì lặng lẽ dời sang ngày khác.
 */
export function parseDate(raw: string, now: Date = new Date()): string | undefined {
  const text = removeNames(removeContacts(raw));
  const t = normalizeText(text);
  const unaccented = isUnaccented(text);
  const plain = stripDiacritics(text);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const numeric = t.match(/(?<!\d)(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?(?!\d)/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = numeric[3] ? Number(numeric[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    let date = validDate(year, month, day);
    if (date && !numeric[3] && date < today) date = validDate(year + 1, month, day);
    if (date) return toIsoDate(date);
  }

  const dayMonth = t.match(/(?<!\d)(\d{1,2})\s*tháng\s*(\d{1,2})(?!\d)/);
  if (dayMonth) {
    let date = validDate(today.getFullYear(), Number(dayMonth[2]), Number(dayMonth[1]));
    if (date && date < today) {
      date = validDate(today.getFullYear() + 1, Number(dayMonth[2]), Number(dayMonth[1]));
    }
    if (date) return toIsoDate(date);
  }

  const dayOnly =
    t.match(/ngày\s+(\d{1,2})(?![\d/-])/) ??
    (unaccented ? plain.match(/ngay\s+(\d{1,2})(?![\d/-])/) : null);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    let date = validDate(today.getFullYear(), today.getMonth() + 1, day);
    if (!date || date < today) {
      const next = addDaysLocal(new Date(today.getFullYear(), today.getMonth(), 1), 32);
      date = validDate(next.getFullYear(), next.getMonth() + 1, day);
    }
    if (date) return toIsoDate(date);
  }

  if (hasWord(t, 'hôm nay') || (unaccented && hasWord(plain, 'hom nay'))) return toIsoDate(today);
  if (
    hasAnyWord(t, ['ngày kia', 'ngày mốt', 'mốt']) ||
    (unaccented && hasWord(plain, 'ngay kia'))
  ) {
    return toIsoDate(addDaysLocal(today, 2));
  }
  if (hasWord(t, 'mai') || (unaccented && hasWord(plain, 'ngay mai'))) {
    return toIsoDate(addDaysLocal(today, 1));
  }

  const weekdayText = unaccented ? plain : t;
  for (const [word, weekday] of WEEKDAY_WORDS) {
    const phrase = unaccented ? stripDiacritics(word) : word;
    if (!hasWord(weekdayText, phrase)) continue;
    let diff = (weekday - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    const nextWeek = mentions(raw, ['tuần sau', 'tuần tới']);
    // "thứ 3 tuần sau" nói vào thứ 6: lần thứ 3 kế tiếp ĐÃ là tuần sau, không cộng nữa.
    const daysToNextMonday = (8 - today.getDay()) % 7 || 7;
    if (nextWeek && diff < daysToNextMonday) diff += 7;
    return toIsoDate(addDaysLocal(today, diff));
  }

  return undefined;
}

export interface ParsedTime {
  time?: string;
  period?: DayPeriod;
}

/**
 * Giờ khách muốn: 9h, 9h30, 9:30, 9 giờ, 9 giờ rưỡi, 2 giờ chiều... và buổi (sáng/chiều)
 * khi không nói giờ cụ thể. Phút được làm tròn XUỐNG lưới 30 phút của lịch khám.
 */
export function parseTime(raw: string): ParsedTime {
  const text = removeNames(removeContacts(raw));
  const t = normalizeText(text);
  const plain = stripDiacritics(text);
  const unaccented = isUnaccented(text);

  const afternoon = mentions(text, ['chiều', 'tối', 'trưa']) || /\bpm\b/.test(plain);
  const morning = mentions(text, ['sáng']) || /\bam\b/.test(plain);
  const period: DayPeriod | undefined = afternoon ? 'afternoon' : morning ? 'morning' : undefined;

  const source = unaccented ? plain : t;
  const candidates = [
    ...source.matchAll(/(?<![\d/])(\d{1,2})\s*:\s*(\d{2})(?!\d)/g),
    ...source.matchAll(
      /(?<![\d/])(\d{1,2})\s*(?:h|giờ|gio|g)(?![\p{L}])\s*(\d{1,2}|rưỡi|ruoi)?(?![\d\p{L}])/gu,
    ),
  ];

  for (const match of candidates) {
    let hours = Number(match[1]);
    let minutes = match[2] === 'rưỡi' || match[2] === 'ruoi' ? 30 : Number(match[2] ?? 0);
    if (hours > 23 || minutes > 59) continue;
    if (afternoon && hours < 12) hours += 12;
    // "3h" không kèm buổi: phòng khám không mở 3 giờ sáng, khách muốn 15h.
    if (!period && hours >= 1 && hours <= 5) hours += 12;
    if (hours < 6 || hours > 21) continue;
    minutes = minutes >= 30 ? 30 : 0;
    return {
      time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      period: hours < 12 ? 'morning' : 'afternoon',
    };
  }

  return { period };
}

// ---------------------------------------------------------------- tên, giới tính

const NAME_STOP_WORDS = new Set(
  [
    'là',
    'tên',
    'nhà',
    'mình',
    'em',
    'tôi',
    'bị',
    'của',
    'này',
    'đó',
    'kia',
    'gì',
    'cưng',
    'yêu',
    'cún',
    'mèo',
    'chó',
    'đực',
    'cái',
    'trai',
    'gái',
    'con',
    'bé',
    'thú',
    'đang',
    'đã',
    'có',
    'không',
    'chưa',
    'muốn',
    'cần',
    'đi',
    'khám',
    'ở',
    'tại',
    'và',
    'với',
    'thì',
    'mà',
    'nó',
    'ạ',
    'nhé',
    'nha',
    'ơi',
    'hay',
    'hoặc',
    'sáng',
    'chiều',
    'mai',
    'hôm',
    'ngày',
    'giờ',
    'lúc',
    'đặt',
    'lịch',
    'hẹn',
    'ok',
    'vâng',
    'dạ',
    'được',
    'rồi',
    'chi',
    'nhánh',
    'quận',
    'số',
    'sđt',
    'email',
    'gmail',
    'họ',
    'anh',
    'chị',
    'bạn',
  ].map((w) => w.normalize('NFC')),
);

const HARD_STOP_WORDS = new Set(
  ['bé', 'mèo', 'chó', 'cún', 'con', 'sđt', 'số', 'email', 'gmail', 'chi', 'nhánh', 'quận'].map(
    (w) => w.normalize('NFC'),
  ),
);

/** Người/bé tên "Mai", "Sáng"...: bỏ tên riêng khỏi câu trước khi tìm ngày giờ. */
function removeNames(text: string): string {
  return (
    text
      // "tên (là) Mai Lan" - mọi chữ viết hoa ngay sau "tên".
      .replace(/(?<![\p{L}])tên(?:\s+là|\s*:)?((?:\s+\p{Lu}[\p{L}'-]*)+)/gu, ' ')
      // "chị Mai" - "Mai" viết hoa giữa câu là tên; đầu câu thì vẫn có thể là "Mai 9h".
      // Chỉ riêng "Mai": "Thứ 6", "Ngày 20" viết hoa giữa câu vẫn là ngày.
      .replace(/(?<=[\p{Ll}]\s+)Mai(?![\p{L}])/gu, ' ')
  );
}

function cleanNameCandidate(raw: string, maxWords: number): string | undefined {
  const words = raw
    .split(/[,.;:!?\n()]/)[0]
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const kept: string[] = [];
  for (const word of words) {
    const lower = normalizeText(word);
    // Từ VIẾT HOA là một phần của tên ("Mai Lan", "Ngọc Sáng"), trừ vài từ không bao giờ
    // là tên người/bé. Hàm này chỉ chạy trên đoạn ngay sau "tên ..." nên không bắt nhầm.
    const capitalizedName = /^\p{Lu}/u.test(word) && !HARD_STOP_WORDS.has(lower);
    if ((NAME_STOP_WORDS.has(lower) && !capitalizedName) || /\d/.test(word)) break;
    if (!/^[\p{L}'-]+$/u.test(word)) break;
    kept.push(word);
    if (kept.length >= maxWords) break;
  }
  if (kept.length === 0) return undefined;
  const name = kept.join(' ');
  return name.length >= 2 ? capitalizeWords(name) : undefined;
}

function capitalizeWords(value: string): string {
  return value
    .split(' ')
    .map((word) => word.charAt(0).toLocaleUpperCase('vi-VN') + word.slice(1))
    .join(' ');
}

/**
 * Câu trả lời cụt khi trợ lý VỪA hỏi đúng thông tin đó ("Milu", "Nguyễn Văn An"). Câu
 * gộp nhiều ý ("Milu, mèo cái, Nguyễn Văn An, 09...") được tách theo dấu phẩy; lấy đoạn
 * đầu tiên có số từ nằm trong [minWords, maxWords] và không chứa từ chức năng nào.
 */
function bareAnswer(raw: string, maxWords: number, minWords = 1): string | undefined {
  const text = removeContacts(raw)
    .replace(/^\s*(?:dạ|da|vâng|ừ|à)\s*[,]?\s*/i, '')
    .replace(/\s*(?:ạ|nhé|nha|nhá)\s*[.!]*\s*$/i, '')
    .trim();
  for (const segment of text.split(/[,;\n]/).map((part) => part.trim())) {
    const words = segment.split(/\s+/).filter(Boolean);
    if (words.length < minWords || words.length > maxWords) continue;
    if (!words.every((w) => /^[\p{L}'-]+$/u.test(w))) continue;
    if (words.some((w) => NAME_STOP_WORDS.has(normalizeText(w)))) continue;
    return capitalizeWords(segment);
  }
  return undefined;
}

/**
 * Khách gõ không dấu ("meo ten Mimi", "ten Le Van Bao"): cho các từ khoá trong mẫu
 * regex nhận thêm bản không dấu. Chỉ bật khi CẢ câu không dấu - "cho"/"con" có dấu
 * mang nghĩa khác nên không được nới cho câu có dấu.
 */
const UNACCENTED_KEYWORDS: Record<string, string> = {
  tên: '(?:tên|ten)',
  bé: '(?:bé|be)',
  cún: '(?:cún|cun)',
  mèo: '(?:mèo|meo)',
  của: '(?:của|cua)',
  nhà: '(?:nhà|nha)',
  mình: '(?:mình|minh)',
  tôi: '(?:tôi|toi)',
  là: '(?:là|la)',
  họ: '(?:họ|ho)',
  chủ: '(?:chủ|chu)',
  chị: '(?:chị|chi)',
};

function namePattern(source: string, raw: string, flags: string): RegExp {
  if (!isUnaccented(raw)) return new RegExp(source, flags);
  const keys = Object.keys(UNACCENTED_KEYWORDS).sort((a, b) => b.length - a.length);
  const widened = source.replace(
    new RegExp(String.raw`(?<![\p{L}])(${keys.join('|')})(?![\p{L}])`, 'gu'),
    (keyword) => UNACCENTED_KEYWORDS[keyword] ?? keyword,
  );
  return new RegExp(widened, flags);
}

const PET_NAMED_SOURCE = String.raw`(?:tên\s+(?:của\s+)?(?:bé|cún|mèo|con|chó)(?:\s+(?:nhà|của)\s+(?:em|mình|tôi))?\s*(?:là|:)?|(?:bé|cún|mèo|con|chó)(?:\s+(?:nhà|của)\s+(?:em|mình|tôi))?\s+tên(?:\s+là|\s*:)?)\s+([\p{L}][\p{L}'-]*(?:\s+\p{Lu}[\p{L}'-]*)?)`;

export function extractPetName(raw: string, awaitingPetName = false): string | undefined {
  const text = removeContacts(raw);

  // Không nhận "em tên ...": khách xưng "em" với phòng khám, đó là tên CHỦ chứ không phải tên bé.
  const named = text.match(namePattern(PET_NAMED_SOURCE, text, 'iu'));
  if (named) {
    const name = cleanNameCandidate(named[1], 2);
    if (name) return name;
  }

  // "bé Milu bị nôn" - chỉ tin khi tên được viết hoa, vì "bé nhà em", "bé bị" rất phổ biến.
  const capitalized = text.match(/(?:^|[\s,.])(?:[Bb]é|[Cc]ún|[Mm]èo)\s+(\p{Lu}[\p{L}'-]*)/u);
  if (capitalized) {
    const name = cleanNameCandidate(capitalized[1], 1);
    if (name) return name;
  }

  if (!awaitingPetName) return undefined;

  // Trợ lý vừa hỏi "Bé tên là gì?" thì "tên Pun" là tên bé. Chỉ nhận 1-2 chữ: từ 3 chữ trở
  // lên ("tên Nguyễn Văn An") gần như chắc là họ tên chủ, để extractOwnerName lấy.
  const answered = text.match(
    namePattern(String.raw`^\s*tên(?:\s+là|\s*:)?\s+([^,;\n]+)`, text, 'iu'),
  );
  if (answered) {
    const words = answered[1].trim().split(/\s+/);
    return words.length <= 2 ? cleanNameCandidate(answered[1], 2) : undefined;
  }

  return bareAnswer(text, 2);
}

const OWNER_SELF_SOURCE = String.raw`(?<!(?:nhà|của)\s)(?:tôi|mình|em|anh|chị)\s+tên(?:\s+là|\s*:)?\s+([\p{L}][\p{L}\s'-]*)`;
const OWNER_LABEL_SOURCE = String.raw`(?:họ\s*(?:và\s*)?tên|tên\s+(?:tôi|mình|chủ|người\s+đặt))\s*(?:là|:)?\s*([\p{L}][\p{L}\s'-]*)`;
/**
 * "..., 0912345678 tên Hồ Thị Dung": "tên" đứng một mình kèm họ tên VIẾT HOA từ 2 chữ trở
 * lên. Không đứng sau "bé/con/mèo..." (đó là tên bé), và đòi 2 chữ nên "tên Milu" không lọt.
 */
const OWNER_BARE_SOURCE = String.raw`(?<!(?:bé|con|cún|mèo|chó)\s)(?<![\p{L}])tên(?:\s+là|\s*:)?\s+(\p{Lu}[\p{L}'-]*(?:\s+\p{Lu}[\p{L}'-]*){1,4})`;

export function extractOwnerName(raw: string, awaitingOwnerName = false): string | undefined {
  const text = removeContacts(raw);
  for (const [source, flags, minWords] of [
    // (?<!nhà |của ): "bé nhà mình tên Milu" là tên BÉ.
    [OWNER_SELF_SOURCE, 'iu', 1],
    [OWNER_LABEL_SOURCE, 'iu', 1],
    [OWNER_BARE_SOURCE, 'gu', 2],
  ] as const) {
    for (const match of text.matchAll(
      new RegExp(namePattern(source, text, flags).source, `${flags.replace('g', '')}g`),
    )) {
      const name = cleanNameCandidate(match[1], 5);
      if (name && name.split(' ').length >= minWords) return name;
    }
  }

  // "Trần Thị Smoke 0987000111" / "0987000111 - Trần Thị Smoke": họ tên VIẾT HOA (2-5 chữ)
  // đứng sát số điện thoại là họ tên người liên hệ, kể cả không có chữ "tên".
  const nextToPhone =
    raw.match(
      new RegExp(
        String.raw`(\p{Lu}[\p{L}'-]*(?:\s+\p{Lu}[\p{L}'-]*){1,4})\s*[,:\-–]?\s*${PHONE_PATTERN.source}`,
        'u',
      ),
    ) ??
    raw.match(
      new RegExp(
        String.raw`${PHONE_PATTERN.source}\s*[,:\-–]?\s*(\p{Lu}[\p{L}'-]*(?:\s+\p{Lu}[\p{L}'-]*){1,4})`,
        'u',
      ),
    );
  if (nextToPhone) {
    const name = cleanNameCandidate(nextToPhone[1], 5);
    if (name && name.split(' ').length >= 2) return name;
  }

  return awaitingOwnerName ? bareAnswer(text, 5, 2) : undefined;
}

export type PetGender = 'MALE' | 'FEMALE';

export function detectGender(raw: string): PetGender | undefined {
  const text = normalizeText(removeContacts(raw));
  const plain = isUnaccented(raw) ? stripDiacritics(removeContacts(raw)) : '';
  if (
    mentions(raw, ['đực', 'giống đực', 'bé trai', 'con trai', 'male']) ||
    (plain && hasWord(plain, 'duc'))
  ) {
    return 'MALE';
  }
  // "cái" đứng cuối một ý ("Mướp cái,", "mèo cái", "Cái") - không bắt "cái gì", "cái chân".
  const trailingFemale = /(?<![\p{L}])cái(?=\s*(?:[,.;!?)]|$))/u;
  if (
    mentions(raw, ['bé gái', 'con gái', 'giống cái', 'con cái', 'mèo cái', 'chó cái', 'female']) ||
    trailingFemale.test(text) ||
    (plain && /(?<![\p{L}])cai(?=\s*(?:[,.;!?)]|$))/u.test(plain))
  ) {
    return 'FEMALE';
  }
  return undefined;
}

/** Câu có dạng ngày (31/2, 30-02) mà không ra được ngày thật - để báo cho khách. */
export function hasInvalidDateText(raw: string): boolean {
  const text = removeContacts(raw);
  const match = text.match(/(?<!\d)(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?(?!\d)/);
  if (!match) return false;
  const year = match[3] ? Number(match[3]) + (match[3].length <= 2 ? 2000 : 0) : 2024;
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
  return date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[1]);
}

// ---------------------------------------------------------------- danh mục

export interface NamedOption {
  id: string;
  aliases: string[];
}

/** Chọn mục có bí danh dài nhất xuất hiện trong câu (so khớp không dấu). */
export function matchOption(raw: string, options: NamedOption[]): string | undefined {
  const plain = stripDiacritics(removeContacts(raw));
  let best: { id: string; length: number } | undefined;
  for (const option of options) {
    for (const alias of option.aliases) {
      const needle = stripDiacritics(alias);
      if (needle.length < 2 || !hasWord(plain, needle)) continue;
      if (!best || needle.length > best.length) best = { id: option.id, length: needle.length };
    }
  }
  return best?.id;
}

/** "Chó cỏ (Chó ta)" -> ["Chó cỏ (Chó ta)", "Chó cỏ", "Chó ta"]. */
export function nameAliases(name: string): string[] {
  const aliases = new Set<string>([name]);
  const outside = name.replace(/\(.*?\)/g, '').trim();
  if (outside) aliases.add(outside);
  for (const inner of name.matchAll(/\(([^)]+)\)/g)) {
    for (const part of inner[1].split(/[/,]/)) {
      if (part.trim()) aliases.add(part.trim());
    }
  }
  return [...aliases];
}

/** Từ khoá chỉ loài -> chữ đầu (bỏ dấu) của tên loài trong danh mục. */
export const SPECIES_KEYWORDS: Array<{ prefix: string; words: string[] }> = [
  { prefix: 'cho', words: ['chó', 'cún', 'cẩu', 'puppy', 'dog'] },
  { prefix: 'meo', words: ['mèo', 'miu', 'mướp', 'cat', 'kitten'] },
  { prefix: 'tho', words: ['thỏ', 'rabbit'] },
  { prefix: 'hamster', words: ['hamster', 'chuột', 'gặm nhấm', 'nhím', 'sóc', 'chinchilla'] },
  { prefix: 'chim', words: ['chim', 'vẹt', 'sáo', 'chào mào', 'bồ câu'] },
  { prefix: 'ca', words: ['cá', 'cá koi', 'cá vàng', 'cá betta'] },
  { prefix: 'bo sat', words: ['rùa', 'bò sát', 'kỳ đà', 'tắc kè', 'trăn', 'rắn', 'iguana'] },
];

/** Từ khoá đủ an toàn để khớp cả khi khách gõ không dấu ("meo", "cun"). */
const UNACCENTED_SPECIES_WORDS: Array<{ prefix: string; words: string[] }> = [
  { prefix: 'cho', words: ['cun', 'con cho', 'be cho', 'cho con', 'cho nha'] },
  { prefix: 'meo', words: ['meo', 'miu'] },
  { prefix: 'tho', words: ['con tho', 'be tho'] },
  { prefix: 'hamster', words: ['hamster', 'chuot'] },
];

export function detectSpeciesPrefix(raw: string): string | undefined {
  const text = normalizeText(removeContacts(raw));
  let best: { prefix: string; index: number } | undefined;
  for (const { prefix, words } of SPECIES_KEYWORDS) {
    for (const word of words) {
      const match = new RegExp(
        `(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`,
        'u',
      ).exec(text);
      // Khách sửa lại ("không phải chó, là mèo"): loài nhắc SAU CÙNG thắng.
      if (match && (!best || match.index > best.index)) best = { prefix, index: match.index };
    }
  }
  if (best) return best.prefix;

  if (isUnaccented(raw)) {
    const plain = stripDiacritics(removeContacts(raw));
    for (const { prefix, words } of UNACCENTED_SPECIES_WORDS) {
      if (hasAnyWord(plain, words)) return prefix;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------- ý định

export interface MessageIntents {
  greeting: boolean;
  thanks: boolean;
  booking: boolean;
  affirm: boolean;
  reset: boolean;
  scheduleLookup: boolean;
  vaccineInfo: boolean;
  symptom: boolean;
}

const SYMPTOM_WORDS = [
  'nôn',
  'ói',
  'mửa',
  'tiêu chảy',
  'đi ngoài',
  'phân lỏng',
  'đi phân',
  'sốt',
  'bỏ ăn',
  'biếng ăn',
  'không ăn',
  'ngứa',
  'gãi',
  'rụng lông',
  'ho',
  'hắt hơi',
  'sổ mũi',
  'khó thở',
  'thở gấp',
  'thở khò khè',
  'co giật',
  'chảy máu',
  'đau',
  'mệt',
  'lờ đờ',
  'li bì',
  've',
  'rận',
  'bọ chét',
  'bị thương',
  'vết thương',
  'gãy',
  'què',
  'đi khập khiễng',
  'viêm',
  'chảy mủ',
  'đỏ mắt',
  'chảy nước mắt',
  'ghèn',
  'ghẻ',
  'nấm',
  'sưng',
  'u',
  'cục',
  'khối u',
  'uống nhiều nước',
  'tiểu ra máu',
  'tiểu nhiều',
  'bí tiểu',
  'run',
  'ngất',
  'trúng độc',
  'ăn phải',
  'nuốt phải',
  'chướng bụng',
  'bụng to',
  'mất nước',
  'gầy',
  'sút cân',
  'hôi miệng',
  'chảy dãi',
  'loét',
  'triệu chứng',
  'bệnh',
  'bị ốm',
  'ốm',
  'yếu',
];

const PLAIN_SYMPTOM_WORDS = [
  'non',
  'oi mua',
  'tieu chay',
  'bo an',
  'bieng an',
  'rung long',
  'kho tho',
  'co giat',
  'chay mau',
  'li bi',
  'bo chet',
  'bi thuong',
  'ngua',
  'trieu chung',
  'bi om',
];

export function detectIntents(raw: string): MessageIntents {
  const t = normalizeText(raw);
  const plain = stripDiacritics(raw);
  const unaccented = isUnaccented(raw);
  const short = t.split(' ').length <= 6;

  const vaccineTopic = /tiem|vac[\s-]?xin|vacxin|vaccine|vaccin/.test(plain);
  const followUpTopic = hasAnyWord(plain, ['tai kham', 'kham lai']);
  const appointmentTopic = hasAnyWord(plain, ['lich hen', 'lich kham']);
  const ownQualifier = hasAnyWord(plain, [
    'cua be',
    'cua em',
    'cua minh',
    'cua toi',
    'nha em',
    'nha minh',
    'nha toi',
    'sap toi',
    'khi nao',
    'bao gio',
    'kiem tra',
    'tra cuu',
    'xem lich',
    'con mui',
    'den han',
  ]);
  const infoQualifier = hasAnyWord(plain, [
    'gom nhung',
    'nhung mui',
    'mui nao',
    'can tiem',
    'nen tiem',
    'mui gi',
    'may mui',
    'bao nhieu mui',
    'tiem gi',
    'lich tiem cho cho con',
    'lich tiem cho meo con',
  ]);

  const bookingPhrase = hasAnyWord(plain, [
    'dat lich',
    'dat hen',
    'hen kham',
    'len lich',
    'dang ky kham',
    'muon kham',
    'book',
    'dua be den',
    'dua be toi',
    'dua be di kham',
    'dat cho be',
    'dat kham',
    'dat giup',
    'dat ho',
    'dat luon',
  ]);
  // "đặt lịch tái khám/tiêm cho bé" là ĐẶT LỊCH, không phải tra cứu lịch.
  const vaccineInfo = !bookingPhrase && vaccineTopic && infoQualifier;
  const scheduleLookup =
    !bookingPhrase &&
    !vaccineInfo &&
    (((vaccineTopic || appointmentTopic) && ownQualifier) || followUpTopic);
  const booking = bookingPhrase;

  const symptomHit =
    hasAnyWord(t, SYMPTOM_WORDS) || (unaccented && hasAnyWord(plain, PLAIN_SYMPTOM_WORDS));

  return {
    greeting:
      short &&
      /^(?:xin chao|chao|hello|hi|alo|hey|ad oi|bac si oi|shop oi|phong kham oi)(?![\p{L}])/u.test(
        plain,
      ),
    thanks: short && /^(?:cam on|thanks|thank you|tks|camon)(?![\p{L}])/u.test(plain),
    booking,
    affirm: /^(?:ok|oke|okay|co|dong y|vang|u|uh|duoc|dat di|chot|dung roi|yes)(?![\p{L}])/u.test(
      plain,
    ),
    reset: hasAnyWord(plain, [
      'huy dat lich',
      'bat dau lai',
      'khong dat nua',
      'thoi khong dat',
      'dat lai tu dau',
    ]),
    scheduleLookup,
    vaccineInfo,
    symptom: symptomHit,
  };
}

/** "1", "số 2", "phương án 3", "chọn 1" -> chỉ số 0-based. */
export function parseChoiceIndex(raw: string): number | undefined {
  const plain = stripDiacritics(raw);
  const match = plain.match(/^(?:chon|so|phuong an|lua chon|option)?\s*(\d)\s*[.)]?\s*$/);
  return match ? Number(match[1]) - 1 : undefined;
}
