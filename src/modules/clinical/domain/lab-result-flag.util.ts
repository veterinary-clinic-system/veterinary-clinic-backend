import { LabResultFlag } from '@/shared/common/enums/lab-result-flag.enum';

export interface ReferenceRange {
  referenceMin: number | null;
  referenceMax: number | null;
}

export function computeLabResultFlag(value: number, range: ReferenceRange): LabResultFlag {
  if (range.referenceMin !== null && value < range.referenceMin) {
    return LabResultFlag.LOW;
  }
  if (range.referenceMax !== null && value > range.referenceMax) {
    return LabResultFlag.HIGH;
  }
  return LabResultFlag.NORMAL;
}

export function isValidReferenceRange(range: ReferenceRange): boolean {
  return (
    range.referenceMin === null ||
    range.referenceMax === null ||
    range.referenceMin <= range.referenceMax
  );
}
