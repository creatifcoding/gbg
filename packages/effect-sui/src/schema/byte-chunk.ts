import * as Chunk from 'effect/Chunk';

export type ByteChunk = Chunk.Chunk<number>;

export const chunkFromBytes = (bytes: Uint8Array | Iterable<number>): ByteChunk =>
  Chunk.fromIterable(bytes);

export const bytesFromChunk = (chunk: ByteChunk): Uint8Array =>
  Uint8Array.from(Chunk.toReadonlyArray(chunk));

export const isByteChunk = (chunk: ByteChunk): boolean =>
  Chunk.every(chunk, (byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255);

export const isByteChunkLength = (chunk: ByteChunk, length: number): boolean =>
  chunk.length === length && isByteChunk(chunk);
