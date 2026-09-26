export const DEFAULT_REPORT_TIMEZONE = 'Asia/Bangkok';

export function getReportTimezone(value = process.env.REPORT_TIMEZONE): string {
  const timezone = value?.trim() || DEFAULT_REPORT_TIMEZONE;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
  } catch {
    throw new Error(`REPORT_TIMEZONE is not a valid IANA timezone: ${timezone}`);
  }

  return timezone;
}
