import { isValidStructTag, normalizeStructTag } from '@mysten/sui/utils';
import * as Schema from 'effect-v4/Schema';

import { normalizeStringOrFail } from './strings';
import { normalizeSuiTypeTag, normalizeSuiTypeTagOption } from './type-tag-normalize';

export * from './type-tag-normalize';
export * from './type-tag-primitives';

const validSuiTypeTag = Schema.makeFilter<string>(
  (value) => normalizeSuiTypeTagOption(value) !== undefined,
  { expected: 'a Sui primitive, vector, or struct type tag' },
);

export const SuiTypeTagString = Schema.String.pipe(
  normalizeStringOrFail(normalizeSuiTypeTag),
  Schema.check(validSuiTypeTag),
  Schema.brand('SuiTypeTagString'),
);
export type SuiTypeTagString = typeof SuiTypeTagString.Type;

export const SuiStructTagString = Schema.String.pipe(
  normalizeStringOrFail((value) => normalizeStructTag(value)),
  Schema.check(Schema.makeFilter<string>(isValidStructTag, { expected: 'a Sui struct tag' })),
  Schema.brand('SuiStructTagString'),
);
export type SuiStructTagString = typeof SuiStructTagString.Type;
