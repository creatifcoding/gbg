import { fromBase58, toBase58 } from '@mysten/bcs';
import * as Schema from 'effect-v4/Schema';
import * as SchemaGetter from 'effect-v4/SchemaGetter';

import { SuiDigestBytes } from './bytes';
import { SUI_DIGEST_BYTE_LENGTH } from './constants';

export const validBase58Digest32 = Schema.makeFilter<string>(
  (value) => {
    try {
      return fromBase58(value).length === SUI_DIGEST_BYTE_LENGTH;
    } catch {
      return false;
    }
  },
  { expected: 'a base58-encoded 32-byte Sui digest' },
);

export const SuiObjectDigest = Schema.String.check(validBase58Digest32).pipe(
  Schema.brand('SuiObjectDigest'),
);
export type SuiObjectDigest = typeof SuiObjectDigest.Type;

export const SuiTransactionDigest = Schema.String.check(validBase58Digest32).pipe(
  Schema.brand('SuiTransactionDigest'),
);
export type SuiTransactionDigest = typeof SuiTransactionDigest.Type;

export const SuiObjectDigestFromBytes = SuiDigestBytes.pipe(
  Schema.decodeTo(SuiObjectDigest, {
    decode: SchemaGetter.transform((bytes) => toBase58(bytes)),
    encode: SchemaGetter.transform((digest) => fromBase58(digest) as SuiDigestBytes),
  }),
);

export const SuiTransactionDigestFromBytes = SuiDigestBytes.pipe(
  Schema.decodeTo(SuiTransactionDigest, {
    decode: SchemaGetter.transform((bytes) => toBase58(bytes)),
    encode: SchemaGetter.transform((digest) => fromBase58(digest) as SuiDigestBytes),
  }),
);
