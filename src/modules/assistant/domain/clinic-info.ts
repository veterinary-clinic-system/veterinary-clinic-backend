import { detectSpeciesPrefix, hasWord, stripDiacritics } from './chat-language';

/**
 * Tri thức nền của CHÍNH phòng khám (chi nhánh, giờ mở cửa, bảng giá, hotline, loài nhận
 * khám) - lấy thẳng từ CSDL mỗi lượt chat. Trước đây những câu này rơi vào LLM hỏi đáp
 * chung, vốn không biết gì về phòng khám nên trả lời "em chưa có thông tin".
 *
 * Module thuần (không gọi DB) để test được bằng câu mẫu.
 */

export interface ClinicInfoTopics {
  branches: boolean;
  hours: boolean;
  prices: boolean;
  hotline: boolean;
  /** Tiền tố loài khách hỏi "có khám ... không" (`bo sat`, `chim`...). */
  speciesAsked?: string;
  /** Ngày trong tuần khách hỏi riêng ("thứ 7", "chủ nhật") - 0 = Chủ nhật. */
  weekday?: number;
}

export interface ClinicBranchInfo {
  branchName: string;
  address: string;
  phone: string;
  openingHours: Array<{ dayOfWeek: number; openTime: string; closeTime: string }>;
}

export interface ClinicServiceInfo {
  name: string;
  price: number;
}

export interface ClinicSpeciesInfo {
  speciesName: string;
  breedNames: string[];
}

const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const BRANCH_PATTERN =
  /\b(chi nhanh|co so|dia chi|o dau|cho nao|nam o|bao nhieu chi nhanh|may chi nhanh)\b/;
const HOURS_PATTERN =
  /\b(mo cua|dong cua|gio (lam viec|lam|mo cua|dong cua|hanh chinh)|may gio (mo|dong)|lam viec (may|tu|den|vao)|lam viec khong|co lam|nghi (trua|le|cuoi tuan)|ngay nghi|cuoi tuan)\b/;
const PRICE_PATTERN =
  /\b(bang gia|bao nhieu tien|chi phi|phi (kham|dich vu|tiem)|het bao nhieu|gia (kham|tiem|dich vu|ca|bao nhieu|the nao|nhu the nao|sieu am|phau thuat|xet nghiem))\b|\bgia\b[^.?!\n]*\bbao nhieu\b/;
const HOTLINE_PATTERN =
  /\b(hotline|so dien thoai (cua )?(phong kham|ben (em|minh))|sdt (cua )?(phong kham|ben (em|minh))|lien he (phong kham|the nao|bang cach nao)|goi (cho |dien cho )?phong kham|so tong dai)\b/;
/** "phòng khám có khám bò sát không", "bên mình có nhận chữa chim không". */
const SPECIES_SERVICE_PATTERN =
  /\b(co|nhan|tiep nhan|chua|dieu tri)\s+(kham|chua|nhan|dieu tri|tri)?\b[^.?!\n]*\b(khong|ko|k)\b|\b(co|nhan|tiep nhan)\s+(kham|chua|dieu tri)\b/;
const WEEKDAY_PATTERNS: Array<[RegExp, number]> = [
  [/\b(thu 7|thu bay|t7)\b/, 6],
  [/\b(chu nhat|cn)\b/, 0],
  [/\b(thu 2|thu hai)\b/, 1],
  [/\b(thu 3|thu ba)\b/, 2],
  [/\b(thu 4|thu tu)\b/, 3],
  [/\b(thu 5|thu nam)\b/, 4],
  [/\b(thu 6|thu sau)\b/, 5],
];

export function detectClinicInfoTopics(raw: string): ClinicInfoTopics | null {
  const plain = stripDiacritics(raw);
  const topics: ClinicInfoTopics = {
    branches: BRANCH_PATTERN.test(plain),
    hours: HOURS_PATTERN.test(plain),
    prices: PRICE_PATTERN.test(plain),
    hotline: HOTLINE_PATTERN.test(plain),
  };

  const weekday = WEEKDAY_PATTERNS.find(([pattern]) => pattern.test(plain))?.[1];
  // "mở cửa thứ 7 không" hỏi giờ; "thứ 7" đứng một mình (không kèm "mở/làm/nghỉ") có thể chỉ là
  // ngày khách muốn đặt nên không tự suy ra là câu hỏi giờ mở cửa.
  if (weekday !== undefined && (topics.hours || /\b(mo|lam|nghi|hoat dong)\b/.test(plain))) {
    topics.hours = true;
    topics.weekday = weekday;
  }

  if (
    SPECIES_SERVICE_PATTERN.test(plain) &&
    /\b(phong kham|ben (em|minh|ban)|o day|ben nay)\b|\bco (kham|nhan|chua)\b/.test(plain)
  ) {
    topics.speciesAsked = detectSpeciesPrefix(raw);
  }

  const any =
    topics.branches || topics.hours || topics.prices || topics.hotline || !!topics.speciesAsked;
  return any ? topics : null;
}

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('vi-VN')} đ`;
}

/** Gom các ngày có cùng khung giờ: "Thứ 2 - Thứ 6: 07:00-11:00, 13:30-17:30". */
export function describeOpeningHours(hours: ClinicBranchInfo['openingHours']): string[] {
  const byDay = new Map<number, string>();
  for (let day = 0; day < 7; day++) {
    const ranges = hours
      .filter((h) => h.dayOfWeek === day)
      .sort((a, b) => a.openTime.localeCompare(b.openTime))
      .map((h) => `${h.openTime}-${h.closeTime}`);
    byDay.set(day, ranges.length > 0 ? ranges.join(', ') : 'nghỉ');
  }

  // Thứ 2 trước, Chủ nhật cuối - đúng thứ tự người Việt đọc lịch tuần.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const groups: Array<{ days: number[]; value: string }> = [];
  for (const day of order) {
    const value = byDay.get(day)!;
    const last = groups[groups.length - 1];
    if (last && last.value === value) last.days.push(day);
    else groups.push({ days: [day], value });
  }
  return groups.map(({ days, value }) => {
    const label =
      days.length === 1
        ? WEEKDAY_NAMES[days[0]]
        : days.length === 2
          ? `${WEEKDAY_NAMES[days[0]]}, ${WEEKDAY_NAMES[days[1]]}`
          : `${WEEKDAY_NAMES[days[0]]} - ${WEEKDAY_NAMES[days[days.length - 1]]}`;
    return `${label}: ${value === 'nghỉ' ? '**nghỉ**' : value}`;
  });
}

function dayAnswer(branch: ClinicBranchInfo, weekday: number): string {
  const ranges = branch.openingHours
    .filter((h) => h.dayOfWeek === weekday)
    .sort((a, b) => a.openTime.localeCompare(b.openTime))
    .map((h) => `${h.openTime}-${h.closeTime}`);
  return ranges.length > 0
    ? `**${WEEKDAY_NAMES[weekday]}** có mở cửa (${ranges.join(', ')})`
    : `**${WEEKDAY_NAMES[weekday]}** **nghỉ**`;
}

export interface ClinicInfoInput {
  topics: ClinicInfoTopics;
  branches: ClinicBranchInfo[];
  services: ClinicServiceInfo[];
  species: ClinicSpeciesInfo[];
  /** Dịch vụ khách nhắc tên trong câu (nếu có) - để báo đúng giá dịch vụ đó. */
  mentionedServiceNames: string[];
}

export function buildClinicInfoReply(input: ClinicInfoInput): string {
  const { topics, branches, services, species } = input;
  const sections: string[] = [];

  if (topics.branches || (topics.hours && branches.length > 0)) {
    const lines = branches.map((branch) => {
      const parts = [`- **${branch.branchName}**: ${branch.address}`];
      if (branch.phone) parts.push(`  ☎ ${branch.phone}`);
      if (topics.hours) {
        if (topics.weekday !== undefined) parts.push(`  🕘 ${dayAnswer(branch, topics.weekday)}`);
        else parts.push(...describeOpeningHours(branch.openingHours).map((l) => `  🕘 ${l}`));
      }
      return parts.join('\n');
    });
    const heading =
      branches.length === 0
        ? 'Dạ hiện phòng khám chưa cập nhật danh sách chi nhánh.'
        : topics.branches
          ? `Dạ phòng khám có **${branches.length} chi nhánh**:`
          : 'Dạ giờ làm việc của phòng khám:';
    sections.push([heading, ...lines].join('\n'));
  }

  if (topics.prices) {
    const mentioned = services.filter((s) => input.mentionedServiceNames.includes(s.name));
    const shown = (mentioned.length > 0 ? mentioned : services).slice(0, 8);
    if (shown.length === 0) {
      sections.push('Dạ hiện phòng khám chưa công bố bảng giá dịch vụ trực tuyến.');
    } else {
      sections.push(
        [
          mentioned.length > 0 ? 'Dạ giá dịch vụ bạn hỏi:' : 'Dạ bảng giá dịch vụ tham khảo:',
          ...shown.map((s) => `- ${s.name}: **${formatMoney(s.price)}**`),
          '_Giá chưa gồm thuốc, xét nghiệm hay vật tư phát sinh nếu bác sĩ chỉ định._',
        ].join('\n'),
      );
    }
  }

  if (topics.hotline && !topics.branches && !topics.hours) {
    sections.push(
      [
        'Dạ bạn có thể liên hệ phòng khám qua:',
        ...branches.map((b) => `- **${b.branchName}**: ☎ ${b.phone}`),
      ].join('\n'),
    );
  }

  if (topics.speciesAsked) {
    const prefix = topics.speciesAsked;
    const match = species.find((s) => stripDiacritics(s.speciesName).startsWith(prefix));
    if (match) {
      const examples = match.breedNames
        .filter((name) => !/giong khac|chua xac dinh/.test(stripDiacritics(name)))
        .slice(0, 4);
      sections.push(
        `Dạ phòng khám **có tiếp nhận khám ${match.speciesName.toLocaleLowerCase('vi-VN')}**` +
          (examples.length > 0 ? ` (ví dụ: ${examples.join(', ')})` : '') +
          '. Bạn có thể đặt lịch trực tuyến hoặc gọi hotline để được tư vấn trước.',
      );
    } else {
      const hotline = branches[0]?.phone;
      sections.push(
        'Dạ hiện phòng khám chưa có danh mục khám cho loài này' +
          (hotline ? `, bạn gọi **${hotline}** để được tư vấn giúp em nhé.` : '.'),
      );
    }
  }

  return sections.join('\n\n');
}

/** Có hỏi đúng tên dịch vụ trong câu không (so khớp không dấu, cả cụm). */
export function serviceNamesMentioned(raw: string, names: string[]): string[] {
  const plain = stripDiacritics(raw);
  return names.filter((name) => {
    const needle = stripDiacritics(name);
    return needle.length >= 3 && hasWord(plain, needle);
  });
}
