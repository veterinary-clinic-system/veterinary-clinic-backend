import { ZaloNotificationProvider, toZaloPhone } from './zalo-notification.provider';

describe('ZaloNotificationProvider', () => {
  it('SĐT gửi ZNS ở dạng 84xxxxxxxxx', () => {
    expect(toZaloPhone('0912345678')).toBe('84912345678');
    expect(toZaloPhone('+84 912 345 678')).toBe('84912345678');
    expect(toZaloPhone('12345')).toBeNull();
  });

  it('thiếu template ZNS: báo lỗi rõ ràng, không gọi API', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const config = {
      get: jest.fn((key: string) => (key.endsWith('oaAccessToken') ? 'token' : undefined)),
    };
    const result = await new ZaloNotificationProvider(config as never).send({
      recipientPhone: '0912345678',
      message: 'x',
    });
    expect(result).toEqual({ success: false, error: 'ZALO_ZNS_TEMPLATE_ID chưa được cấu hình' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('gửi ZNS theo số điện thoại với template title/content', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: 0, data: { msg_id: 'm1' } }),
    } as Response);
    const config = {
      get: jest.fn((key: string) => (key.endsWith('oaAccessToken') ? 'token' : 'tpl-1')),
    };
    const result = await new ZaloNotificationProvider(config as never).send({
      recipientPhone: '0912345678',
      message: 'Nội dung',
      subject: 'Tiêu đề',
    });
    expect(result).toEqual({ success: true, providerMessageId: 'm1' });
    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(body).toEqual({
      phone: '84912345678',
      template_id: 'tpl-1',
      template_data: { title: 'Tiêu đề', content: 'Nội dung' },
    });
    fetchSpy.mockRestore();
  });
});
