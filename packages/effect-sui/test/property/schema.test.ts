import { fromBase58, toBase58, toHex } from '@mysten/bcs';
import * as Schema from 'effect/Schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  SUI_ADDRESS_BYTE_LENGTH,
  SUI_DIGEST_BYTE_LENGTH,
  SuiAddress,
  SuiAddressFromHexBytes,
  SuiAuthError,
  SuiBcsParseError,
  SuiExecutionError,
  SuiIndexerVisibilityError,
  SuiMoveAbortError,
  SuiObjectDigest,
  SuiObjectDigestFromBytes,
  SuiObjectId,
  SuiObjectLoadError,
  SuiObjectRef,
  SuiObjectStaleError,
  SuiObjectVersion,
  SuiPackageError,
  SuiPtbInvalidError,
  SuiSchemaDecodeError,
  SuiTransactionDigestFromBytes,
  SuiTransportError,
  SuiWaitError,
  bytesFromChunk,
  chunkFromBytes,
  decodeSuiObjectRef,
  decodeSuiTypeTagString,
  isByteChunkLength,
  normalizeSuiTypeTag,
  parseSuiTypeTag,
} from '../../src/schema';

const bytes32 = fc.uint8Array({ minLength: 32, maxLength: 32 });
const hex32 = bytes32.map((bytes) => toHex(bytes));
const suiHex32 = hex32.map((hex) => `0x${hex}`);
const digest32 = bytes32.map((bytes) => toBase58(bytes));

describe('@tmnl/effect-sui schema nouns', () => {
  it('normalizes Sui addresses to 0x-prefixed 32-byte lower hex', () => {
    expect(Schema.decodeUnknownSync(SuiAddress)('0x2')).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000002',
    );
    expect(Schema.decodeUnknownSync(SuiObjectId)('ABC')).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000abc',
    );
  });

  it('round-trips address bytes through Schema.Uint8ArrayFromHex', () => {
    fc.assert(
      fc.property(hex32, (hex) => {
        const decoded = Schema.decodeUnknownSync(SuiAddressFromHexBytes)(hex);
        const encoded = Schema.encodeUnknownSync(SuiAddressFromHexBytes)(decoded);
        expect(encoded).toBe(hex.toLowerCase());
      }),
    );
  });

  it('rejects malformed addresses', () => {
    expect(() => Schema.decodeUnknownSync(SuiAddress)('0xzz')).toThrow();
    expect(() => Schema.decodeUnknownSync(SuiAddress)('not-hex')).toThrow();
  });

  it('validates base58 32-byte digests and rejects wrong lengths', () => {
    fc.assert(
      fc.property(digest32, (digest) => {
        expect(Schema.decodeUnknownSync(SuiObjectDigest)(digest)).toBe(digest);
        expect(fromBase58(digest)).toHaveLength(SUI_DIGEST_BYTE_LENGTH);
      }),
    );

    expect(() => Schema.decodeUnknownSync(SuiObjectDigest)(toBase58(new Uint8Array([1, 2, 3])))).toThrow();
  });

  it('round-trips digest bytes through object and transaction digest codecs', () => {
    fc.assert(
      fc.property(bytes32, (bytes) => {
        const objectDigest = Schema.decodeUnknownSync(SuiObjectDigestFromBytes)(bytes);
        const txDigest = Schema.decodeUnknownSync(SuiTransactionDigestFromBytes)(bytes);

        expect(objectDigest).toBe(toBase58(bytes));
        expect(txDigest).toBe(toBase58(bytes));
        expect(Schema.encodeUnknownSync(SuiObjectDigestFromBytes)(objectDigest)).toEqual(bytes);
        expect(Schema.encodeUnknownSync(SuiTransactionDigestFromBytes)(txDigest)).toEqual(bytes);
      }),
    );
  });

  it('uses Chunk for structured byte processing before BCS boundaries', () => {
    fc.assert(
      fc.property(bytes32, (bytes) => {
        const chunk = chunkFromBytes(bytes);
        expect(isByteChunkLength(chunk, SUI_ADDRESS_BYTE_LENGTH)).toBe(true);
        expect(bytesFromChunk(chunk)).toEqual(bytes);
      }),
    );
  });

  it('normalizes object refs and JSON u64 versions', () => {
    fc.assert(
      fc.property(suiHex32, digest32, fc.bigInt({ min: 0n, max: 10_000_000n }), (objectId, digest, version) => {
        const ref = decodeSuiObjectRef({ objectId, digest, version: version.toString() });
        expect(ref).toBeInstanceOf(SuiObjectRef);
        expect(ref.version).toBe(version.toString());
        expect(ref.objectId).toBe(objectId.toLowerCase());
        expect(ref.toMysten()).toEqual({ objectId: ref.objectId, version: ref.version, digest });
      }),
    );

    expect(Schema.decodeUnknownSync(SuiObjectVersion)(42)).toBe('42');
    expect(() => Schema.decodeUnknownSync(SuiObjectVersion)('-1')).toThrow();
  });
});

describe('@tmnl/effect-sui type tags', () => {
  it('normalizes primitive, vector, and struct type tags', () => {
    expect(decodeSuiTypeTagString('u64')).toBe('u64');
    expect(decodeSuiTypeTagString('vector<0x2::sui::SUI>')).toBe(
      'vector<0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI>',
    );
    expect(normalizeSuiTypeTag('0x2::coin::Coin<0x2::sui::SUI>')).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000002::coin::Coin<0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI>',
    );
  });

  it('parses structured type tags for future BCS/PTB passes', () => {
    const parsed = parseSuiTypeTag('vector<0x2::sui::SUI>');
    expect(parsed._tag).toBe('VectorTypeTag');
    expect(parsed.toString()).toBe(
      'vector<0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI>',
    );
  });

  it('rejects malformed type tags', () => {
    expect(() => decodeSuiTypeTagString('vector<>')).toThrow();
    expect(() => decodeSuiTypeTagString('not-a-type')).toThrow();
  });
});

describe('@tmnl/effect-sui tagged errors', () => {
  it('constructs yieldable tagged error classes with stable tags', () => {
    expect(new SuiSchemaDecodeError({ schema: 'SuiAddress', message: 'bad' })._tag).toBe(
      'Sui/SchemaDecode',
    );
    expect(
      new SuiObjectLoadError({
        code: 'notExists',
        message: 'missing',
        objectId: Schema.decodeUnknownSync(SuiObjectId)('0x2'),
      })._tag,
    ).toBe('Sui/ObjectLoad');
    expect(new SuiTransportError({ transport: 'grpc', message: 'down' })._tag).toBe(
      'Sui/Transport',
    );
    expect(new SuiExecutionError({ message: 'abort' })._tag).toBe('Sui/Execution');
  });

  it('constructs rich error topology classes with stable tags', () => {
    const objectId = Schema.decodeUnknownSync(SuiObjectId)('0x2');
    const digest = Schema.decodeUnknownSync(SuiTransactionDigestFromBytes)(new Uint8Array(32).fill(1));

    expect(new SuiObjectStaleError({ objectId, message: 'stale ref' })._tag).toBe('Sui/ObjectStale');
    expect(new SuiBcsParseError({ codec: 'Counter', message: 'bad bytes', byteLength: 4 })._tag).toBe('Sui/BcsParse');
    expect(new SuiPtbInvalidError({ phase: 'analyze', message: 'missing input' })._tag).toBe('Sui/PtbInvalid');
    expect(new SuiMoveAbortError({ abortCode: '42', module: 'counter', message: 'abort' })._tag).toBe('Sui/MoveAbort');
    expect(new SuiAuthError({ mode: 'wallet', message: 'rejected' })._tag).toBe('Sui/Auth');
    expect(new SuiWaitError({ kind: 'timeout', digest, timeoutMs: 1_000, message: 'not visible' })._tag).toBe('Sui/Wait');
    expect(new SuiIndexerVisibilityError({ digest, message: 'indexer lag' })._tag).toBe('Sui/IndexerVisibility');
    expect(new SuiPackageError({ kind: 'typeNotRegistered', packageId: objectId, typeName: 'Counter', message: 'missing' })._tag).toBe('Sui/Package');
  });
});
