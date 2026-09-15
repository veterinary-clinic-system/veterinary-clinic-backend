import { BadRequestException, ValidationError } from '@nestjs/common';

const CONSTRAINT_PRIORITY = [
  'isDefined',
  'isNotEmpty',
  'isNotEmptyObject',
  'arrayNotEmpty',
  'isString',
  'isInt',
  'isNumber',
  'isBoolean',
  'isArray',
  'isEnum',
  'isIn',
  'isUuid',
  'isDateString',
  'isEmail',
  'isPhoneNumber',
  'min',
  'max',
  'minLength',
  'maxLength',
  'minDate',
  'maxDate',
  'arrayMinSize',
  'arrayMaxSize',
  'matches',
];

export function formatValidationErrors(errors: ValidationError[]): BadRequestException {
  return new BadRequestException(collectMessages(errors));
}

function collectMessages(errors: ValidationError[], parentPath = ''): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    const best = pickMostRelevant(error.constraints);
    if (best) {
      messages.push(best);
    }

    if (error.children?.length) {
      messages.push(...collectMessages(error.children, path));
    }
  }

  return messages;
}

function pickMostRelevant(constraints?: Record<string, string>): string | null {
  if (!constraints) {
    return null;
  }

  const keys = Object.keys(constraints);
  if (keys.length === 0) {
    return null;
  }

  keys.sort((a, b) => rank(a) - rank(b));
  return constraints[keys[0]];
}

function rank(constraint: string): number {
  const index = CONSTRAINT_PRIORITY.indexOf(constraint);
  return index === -1 ? CONSTRAINT_PRIORITY.length : index;
}
