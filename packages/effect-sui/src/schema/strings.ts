/** Canonical Sui string nouns: addresses, object ids, digests, versions. */

import { fromBase58, fromHex, toBase58, toHex } from '@mysten/bcs';
import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';
import * as Schema from 'effect-v4/Schema';
import * as SchemaGetter from 'effect-v4/SchemaGetter';

import { SuiDigestBytes } from './bytes';
import { SUI_DIGEST_BYTE_LENGTH, U64_MAX } from './constants';

export const normalizeString = (normalize: (value: string) => string) =>
  Schema.decode<Schema.String>({
    decode: SchemaGetter.transform(normalize),
    encode: SchemaGetter.transform(normalize),
  });

export const normalizeStringOrFail = (normalize: (value: string) => string) =>
  Schema.decode<Schema.String>({
    decode: SchemaGetter.transform(normalize),
    encode: SchemaGetter.transform(normalize),
  });

const validSuiAddress = Schema.makeFilter<string>(isValidSuiAddress, {
  expected: 'a canonical 32-byte Sui address',
});

const validBase58Digest32 = Schema.makeFilter<string>(
  (value) => {
    try {
      return fromBase58(value).length === SUI_DIGEST_BYTE_LENGTH;
    } catch {
      return false;
    }
  },
  { expected: 'a base58-encoded 32-byte Sui digest' },
);

const validU64String = Schema.makeFilter<string>(
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

export const SuiAddress = Schema.String.pipe(
  normalizeString((value) => normalizeSuiAddress(value)),
  Schema.check(validSuiAddress),
  Schema.brand('SuiAddress'),
);
export type SuiAddress = typeof SuiAddress.Type;

export const SuiObjectId = Schema.String.pipe(
  normalizeString((value) => normalizeSuiAddress(value)),
  Schema.check(validSuiAddress),
  Schema.brand('SuiObjectId'),
);
export type SuiObjectId = typeof SuiObjectId.Type;

export const SuiAddressFromHexBytes = Schema.Uint8ArrayFromHex.pipe(
  Schema.decodeTo(SuiAddress, {
    decode: SchemaGetter.transform((bytes) => `0x${toHex(bytes)}`),
    encode: SchemaGetter.transform((address) => fromHex(address)),
  }),
);

export const SuiObjectIdFromHexBytes = Schema.Uint8ArrayFromHex.pipe(
  Schema.decodeTo(SuiObjectId, {
    decode: SchemaGetter.transform((bytes) => `0x${toHex(bytes)}`),
    encode: SchemaGetter.transform((objectId) => fromHex(objectId)),
  }),
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

export const SuiObjectVersion = Schema.Union([Schema.String, Schema.Int]).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => String(value)),
    encode: SchemaGetter.transform((value) => value),
  }),
  Schema.check(validU64String),
  Schema.brand('SuiObjectVersion'),
);
export type SuiObjectVersion = typeof SuiObjectVersion.Type;
