import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';

import { SuiAddressBytes, SuiDigestBytes } from './byte-schemas';

export const addressBytesFromHex = Schema.Uint8ArrayFromHex.pipe(
  Schema.decodeTo(SuiAddressBytes, {
    decode: SchemaGetter.transform((bytes) => bytes),
    encode: SchemaGetter.transform((bytes) => bytes),
  }),
);

export const digestBytesFromBase64 = Schema.Uint8ArrayFromBase64.pipe(
  Schema.decodeTo(SuiDigestBytes, {
    decode: SchemaGetter.transform((bytes) => bytes),
    encode: SchemaGetter.transform((bytes) => bytes),
  }),
);
