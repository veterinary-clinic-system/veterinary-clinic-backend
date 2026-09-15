import { ValueTransformer } from 'typeorm';

export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined): number | null =>
    value === null || value === undefined ? null : value,

  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};
