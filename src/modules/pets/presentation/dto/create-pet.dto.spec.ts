import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePetDto } from './create-pet.dto';
import { isRecentBirthDate } from '@/shared/common/validation/is-recent-birth-date.validator';
import { translateDefaultMessage } from '@/shared/common/validation/validation-error.formatter';

const base = {
  ownerId: '6f1c1b8e-6b1a-4a57-9a64-0e5a3b7d3c11',
  speciesId: '6f1c1b8e-6b1a-4a57-9a64-0e5a3b7d3c12',
  breedId: '6f1c1b8e-6b1a-4a57-9a64-0e5a3b7d3c13',
  gender: 'MALE',
};

async function errorsFor(extra: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(CreatePetDto, { ...base, ...extra });
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('Hồ sơ thú cưng chặn dữ liệu phi lý (QA 19/11/2026)', () => {
  it('tên toàn khoảng trắng bị chặn, tên có khoảng trắng hai đầu được cắt', async () => {
    expect(await errorsFor({ name: '     ' })).toContain('Vui lòng nhập tên thú cưng');
    const dto = plainToInstance(CreatePetDto, { ...base, name: '  Milo  ' });
    expect(dto.name).toBe('Milo');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('tên quá dài trả lỗi 400 thay vì vỡ cột VARCHAR(255) thành lỗi 500', async () => {
    expect((await errorsFor({ name: 'A'.repeat(300) })).join()).toContain('không được vượt quá');
  });

  it.each([-5, 0, 1000])('cân nặng %p kg bị chặn', async (weight) => {
    expect(await errorsFor({ name: 'Milo', weight })).not.toHaveLength(0);
  });

  it('cân nặng hợp lệ được nhận', async () => {
    expect(await errorsFor({ name: 'Milo', weight: 4.5 })).toHaveLength(0);
  });

  it('ngày sinh tương lai và quá 40 năm bị chặn', async () => {
    expect(await errorsFor({ name: 'Milo', birthDate: '2999-01-01' })).not.toHaveLength(0);
    expect(await errorsFor({ name: 'Milo', birthDate: '1800-01-01' })).not.toHaveLength(0);
    expect(isRecentBirthDate('2020-05-01', new Date(2026, 10, 19))).toBe(true);
    expect(isRecentBirthDate('1985-01-01', new Date(2026, 10, 19))).toBe(false);
  });
});

describe('translateDefaultMessage', () => {
  it('dịch câu mặc định tiếng Anh của class-validator', () => {
    expect(
      translateDefaultMessage('message must be shorter than or equal to 2000 characters'),
    ).toBe('Nội dung không được vượt quá 2.000 ký tự.');
  });

  it('giữ nguyên câu đã viết tiếng Việt', () => {
    expect(translateDefaultMessage('Vui lòng nhập tên thú cưng')).toBe(
      'Vui lòng nhập tên thú cưng',
    );
  });
});
