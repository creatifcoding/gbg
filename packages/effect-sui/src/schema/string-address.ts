import { fromHex, toHex } from '@mysten/bcs';
import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';
import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';

import { normalizeString } from './string-normalize';

export const validSuiAddress = Schema.makeFilter<string>(isValidSuiAddress, {
  expected: 'a canonical 32-byte Sui address',
});

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
