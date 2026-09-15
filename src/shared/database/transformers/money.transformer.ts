import { ValueTransformer } from 'typeorm';

export const moneyTransformer: ValueTransformer = {
  
  to: (value: number | null | undefined): string | null =>
    value === null || value === undefined ? null : String(Math.round(value)),

  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};
