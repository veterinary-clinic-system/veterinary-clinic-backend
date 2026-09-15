

export const REDACTED = '[REDACTED]';

const SENSITIVE_PATTERNS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'pin',
  'otp',
  'privatekey',
  'private_key',
  'salt',
];

const MAX_DEPTH = 8;

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
  return SENSITIVE_PATTERNS.some((pattern) => normalized.includes(pattern.replace(/_/g, '')));
}

export function sanitizeAuditPayload(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }
  if (depth >= MAX_DEPTH) {
    return '[MAX_DEPTH]';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAuditPayload(entry, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? REDACTED : sanitizeAuditPayload(entry, depth + 1);
  }
  return result;
}

export function diffAuditSnapshots(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);

  for (const key of keys) {
    const oldValue = before?.[key] ?? null;
    const newValue = after?.[key] ?? null;
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = { before: oldValue, after: newValue };
    }
  }
  return changes;
}
