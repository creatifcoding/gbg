import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';

import { U64_MAX } from './constants';

export const validU64String = Schema.makeFilter<string>(
  (value) => {
    try {
      const n = BigInt(value);
      return n >= 0n && n <= U64_MAX;
    } catch {
      return false;
    }
  },
  { expected: 'a u64 encoded as a decimal string' },
);

export const SuiObjectVersion = Schema.Union([Schema.String, Schema.Int]).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => String(value)),
    encode: SchemaGetter.transform((value) => value),
  }),
  Schema.check(validU64String),
  Schema.brand('SuiObjectVersion'),
);
export type SuiObjectVersion = typeof SuiObjectVersion.Type;
