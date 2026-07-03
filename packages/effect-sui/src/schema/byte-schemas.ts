import * as Schema from 'effect/Schema';

import { SUI_ADDRESS_BYTE_LENGTH } from './constants';

export const Byte = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: 255 }),
).pipe(Schema.brand('SuiByte'));
export type Byte = typeof Byte.Type;

const isByteLength = (length: number, expected: string) =>
  Schema.makeFilter<Uint8Array>(
    (bytes) => bytes.length === length,
    { expected },
  );

export const Bytes32 = Schema.Uint8Array.check(
  isByteLength(SUI_ADDRESS_BYTE_LENGTH, 'a 32-byte Uint8Array'),
).pipe(Schema.brand('SuiBytes32'));
export type Bytes32 = typeof Bytes32.Type;

export const SuiAddressBytes = Bytes32.pipe(Schema.brand('SuiAddressBytes'));
export type SuiAddressBytes = typeof SuiAddressBytes.Type;

export const SuiDigestBytes = Bytes32.pipe(Schema.brand('SuiDigestBytes'));
export type SuiDigestBytes = typeof SuiDigestBytes.Type;
