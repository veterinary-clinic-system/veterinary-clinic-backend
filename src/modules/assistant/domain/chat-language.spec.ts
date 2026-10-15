import {
  detectGender,
  detectIntents,
  detectSpeciesPrefix,
  extractEmail,
  extractOwnerName,
  extractPetName,
  extractPhone,
  matchOption,
  nameAliases,
  parseChoiceIndex,
  parseDate,
  parseTime,
} from './chat-language';

// Thứ 5, 15/10/2026, 10:00 giờ máy.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

describe('chat-language', () => {
  describe('extractPhone / extractEmail', () => {
    it.each([
      ['sđt 0912345678 nhé', '0912345678'],
      ['số mình 0912 345 678', '0912345678'],
      ['+84912345678', '0912345678'],
      ['84 912.345.678', '0912345678'],
    ])('nhận SĐT trong "%s"', (text, phone) => {
      expect(extractPhone(text)).toBe(phone);
    });

    it('bỏ qua dãy số không phải SĐT', () => {
      expect(extractPhone('bé nặng 12345 gam')).toBeUndefined();
      expect(extractPhone('0112345678')).toBeUndefined();
    });

    it('nhận email', () => {
      expect(extractEmail('mail: Lan.Nguyen@Gmail.com ạ')).toBe('lan.nguyen@gmail.com');
    });
  });

  describe('parseDate', () => {
    it.each([
      ['sáng mai 9h', '2026-10-16'],
      ['ngày mai', '2026-10-16'],
      ['ngay mai nhe', '2026-10-16'],
      ['hôm nay', '2026-10-15'],
      ['ngày kia', '2026-10-17'],
      ['thứ 6', '2026-10-16'],
      ['thứ hai', '2026-10-19'],
      ['thứ 5', '2026-10-22'],
      ['thứ 3 tuần sau', '2026-10-20'],
      ['20/10', '2026-10-20'],
      ['20-10-2026', '2026-10-20'],
      ['ngày 20', '2026-10-20'],
      ['ngày 3', '2026-11-03'],
      ['5/1', '2027-01-05'],
      ['25 tháng 12', '2026-12-25'],
    ])('"%s" -> %s', (text, expected) => {
      expect(parseDate(text, NOW)).toBe(expected);
    });

    it('không nhầm "email" thành "mai" và không đọc SĐT thành ngày', () => {
      expect(parseDate('email của mình là mai.anh@gmail.com', NOW)).toBeUndefined();
      expect(parseDate('0912345678', NOW)).toBeUndefined();
    });

    it('không nhầm "mãi" (có dấu) thành "mai"', () => {
      expect(parseDate('bé ho mãi không khỏi', NOW)).toBeUndefined();
    });

    it('không coi tuổi/thời gian bệnh là ngày hẹn', () => {
      expect(parseDate('bé 2 tháng tuổi, nôn 2 ngày nay', NOW)).toBeUndefined();
    });
  });

  describe('parseTime', () => {
    it.each([
      ['9h', '09:00'],
      ['9h30', '09:30'],
      ['9:30 sáng', '09:30'],
      ['9 giờ rưỡi', '09:30'],
      ['2 giờ chiều', '14:00'],
      ['14h', '14:00'],
      ['3h', '15:00'],
      ['10h45', '10:30'],
    ])('"%s" -> %s', (text, expected) => {
      expect(parseTime(text).time).toBe(expected);
    });

    it('chỉ có buổi, không có giờ', () => {
      expect(parseTime('chiều mai')).toEqual({ period: 'afternoon' });
      expect(parseTime('sáng thứ 6')).toEqual({ period: 'morning' });
    });

    it('không đọc SĐT hay "24h" thành giờ hẹn', () => {
      expect(parseTime('0912345678').time).toBeUndefined();
      expect(parseTime('nôn trong 24h qua').time).toBeUndefined();
    });
  });

  describe('extractPetName', () => {
    it.each([
      ['Bé tên Milu, mèo cái', 'Milu'],
      ['bé nhà mình tên là mực', 'Mực'],
      ['tên bé là Bông', 'Bông'],
      ['tên của bé: Lucky', 'Lucky'],
      ['Bé Lu bị nôn', 'Lu'],
    ])('"%s" -> %s', (text, expected) => {
      expect(extractPetName(text)).toBe(expected);
    });

    it('không lấy từ thường làm tên', () => {
      expect(extractPetName('bé nhà em bị nôn')).toBeUndefined();
      expect(extractPetName('bé bị ngứa')).toBeUndefined();
    });

    it('"em tên Lan" là tên chủ, không phải tên bé', () => {
      expect(extractPetName('em tên Lan')).toBeUndefined();
      expect(extractOwnerName('em tên Lan')).toBe('Lan');
    });

    it('trả lời cụt khi trợ lý vừa hỏi tên bé', () => {
      expect(extractPetName('Milu ạ', true)).toBe('Milu');
      expect(extractPetName('Milu, mèo cái, Nguyễn Văn An, 0912345678', true)).toBe('Milu');
      expect(extractPetName('Milu ạ')).toBeUndefined();
    });
  });

  describe('extractOwnerName', () => {
    it('các cách xưng tên', () => {
      expect(extractOwnerName('tôi tên Nguyễn Văn An sđt 0912345678')).toBe('Nguyễn Văn An');
      expect(extractOwnerName('họ tên: trần thị bình')).toBe('Trần Thị Bình');
    });

    it('"bé nhà mình tên Milu" không phải tên chủ', () => {
      expect(extractOwnerName('bé nhà mình tên Milu')).toBeUndefined();
    });

    it('câu gộp: bỏ đoạn tên bé (1 từ) và đoạn loài, lấy đoạn họ tên', () => {
      expect(extractOwnerName('Milu, mèo cái, Nguyễn Văn An, 0912345678', true)).toBe(
        'Nguyễn Văn An',
      );
    });
  });

  describe('detectGender / detectSpeciesPrefix', () => {
    it('giới tính', () => {
      expect(detectGender('mèo cái')).toBe('FEMALE');
      expect(detectGender('Cái')).toBe('FEMALE');
      expect(detectGender('đực')).toBe('MALE');
      expect(detectGender('cái gì vậy')).toBeUndefined();
    });

    it('loài, kể cả khi khách sửa lại', () => {
      expect(detectSpeciesPrefix('bé cún nhà em')).toBe('cho');
      expect(detectSpeciesPrefix('không phải chó, là mèo')).toBe('meo');
      expect(detectSpeciesPrefix('con meo nha minh')).toBe('meo');
      expect(detectSpeciesPrefix('cho em hỏi chút')).toBeUndefined();
    });
  });

  describe('matchOption', () => {
    const branches = [
      { id: 'q1', aliases: ['Phòng khám thú y Quận 1', 'quận 1', 'q1'] },
      { id: 'q7', aliases: ['Phòng khám thú y Quận 7', 'quận 7', 'q7'] },
    ];

    it('khớp chi nhánh theo bí danh, không dấu', () => {
      expect(matchOption('khám ở quan 7 nhé', branches)).toBe('q7');
      expect(matchOption('Q1', branches)).toBe('q1');
      expect(matchOption('quận 10', branches)).toBeUndefined();
    });

    it('tách bí danh trong ngoặc', () => {
      expect(nameAliases('Chó cỏ (Chó ta)')).toEqual(['Chó cỏ (Chó ta)', 'Chó cỏ', 'Chó ta']);
    });
  });

  describe('detectIntents', () => {
    it('đặt lịch', () => {
      expect(detectIntents('Tôi muốn đặt lịch khám cho bé').booking).toBe(true);
      expect(detectIntents('dat lich kham giup minh').booking).toBe(true);
    });

    it('"đặt lịch tiêm" là đặt lịch, không phải tra cứu', () => {
      const intents = detectIntents('đặt lịch tiêm phòng cho bé');
      expect(intents.booking).toBe(true);
      expect(intents.scheduleLookup).toBe(false);
    });

    it('tra cứu lịch tiêm / tái khám của bé', () => {
      expect(
        detectIntents('Bé nhà em có lịch tiêm vắc-xin định kỳ nào sắp tới không?').scheduleLookup,
      ).toBe(true);
      expect(detectIntents('Kiểm tra lịch tái khám cho bé').scheduleLookup).toBe(true);
    });

    it('hỏi kiến thức tiêm phòng chung', () => {
      const intents = detectIntents(
        'Lịch tiêm phòng vắc-xin định kỳ cho chó con gồm những mũi nào?',
      );
      expect(intents.vaccineInfo).toBe(true);
      expect(intents.scheduleLookup).toBe(false);
    });

    it('triệu chứng', () => {
      expect(detectIntents('Bé cún nhà em bị nôn mửa và bỏ ăn 2 ngày nay').symptom).toBe(true);
      expect(detectIntents('cho em về sớm').symptom).toBe(false);
    });

    it('chào, cảm ơn, đồng ý, huỷ', () => {
      expect(detectIntents('Xin chào').greeting).toBe(true);
      expect(detectIntents('cảm ơn nhé').thanks).toBe(true);
      expect(detectIntents('ok đặt đi').affirm).toBe(true);
      expect(detectIntents('thôi không đặt nữa').reset).toBe(true);
    });
  });

  it('parseChoiceIndex', () => {
    expect(parseChoiceIndex('2')).toBe(1);
    expect(parseChoiceIndex('số 1')).toBe(0);
    expect(parseChoiceIndex('chọn 3')).toBe(2);
    expect(parseChoiceIndex('2 giờ chiều')).toBeUndefined();
  });
});
