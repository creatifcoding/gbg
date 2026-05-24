/** Byte-level schemas and Chunk helpers for Sui nouns. */

import * as Chunk from 'effect-v4/Chunk';
import * as Schema from 'effect-v4/Schema';
import * as SchemaGetter from 'effect-v4/SchemaGetter';

import { SUI_ADDRESS_BYTE_LENGTH } from './constants';

export const Byte = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: 255 }),
).pipe(Schema.brand('SuiByte'));
export type Byte = typeof Byte.Type;

export type ByteChunk = Chunk.Chunk<number>;

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

export const chunkFromBytes = (bytes: Uint8Array | Iterable<number>): ByteChunk =>
  Chunk.fromIterable(bytes);

export const bytesFromChunk = (chunk: ByteChunk): Uint8Array =>
  Uint8Array.from(Chunk.toReadonlyArray(chunk));

export const isByteChunk = (chunk: ByteChunk): boolean =>
  Chunk.every(chunk, (byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255);

export const isByteChunkLength = (chunk: ByteChunk, length: number): boolean =>
  chunk.length === length && isByteChunk(chunk);

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
