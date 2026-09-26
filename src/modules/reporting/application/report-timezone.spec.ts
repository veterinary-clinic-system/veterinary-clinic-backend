import { DEFAULT_REPORT_TIMEZONE, getReportTimezone } from './report-timezone';

describe('getReportTimezone', () => {
  it('uses the clinic timezone by default', () => {
    expect(getReportTimezone(undefined)).toBe(DEFAULT_REPORT_TIMEZONE);
  });

  it('accepts a valid IANA timezone', () => {
    expect(getReportTimezone('Asia/Ho_Chi_Minh')).toBe('Asia/Ho_Chi_Minh');
  });

  it('rejects invalid timezone names at startup', () => {
    expect(() => getReportTimezone('UTC+7')).toThrow('REPORT_TIMEZONE');
  });
});
