/**
 * Schema-backed Sui durable nouns, byte codecs, and typed errors.
 *
 * The public SDK boundary stays on Mysten-compatible canonical strings, while
 * byte-heavy boundaries expose Uint8Array / Chunk helpers for BCS-oriented
 * processing. BCS serialization itself remains delegated to `@mysten/bcs` and
 * `@mysten/sui`; this module owns validation, normalization, and nominal types.
 */

import { fromBase58, fromHex, toBase58, toHex } from '@mysten/bcs';
import {
  isValidStructTag,
  isValidSuiAddress,
  normalizeStructTag,
  normalizeSuiAddress,
  parseStructTag,
} from '@mysten/sui/utils';
import * as Chunk from 'effect-v4/Chunk';
import * as Schema from 'effect-v4/Schema';
import * as SchemaGetter from 'effect-v4/SchemaGetter';

export const SUI_ADDRESS_BYTE_LENGTH = 32;
export const SUI_DIGEST_BYTE_LENGTH = 32;
export const U64_MAX = 18_446_744_073_709_551_615n;

// ─── Byte-level schemas and Chunk helpers ────────────────────────────────────

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

// ─── Canonical string nouns ──────────────────────────────────────────────────

const normalizeString = (normalize: (value: string) => string) =>
  Schema.decode<Schema.String>({
    decode: SchemaGetter.transform(normalize),
    encode: SchemaGetter.transform(normalize),
  });

const normalizeStringOrFail = (normalize: (value: string) => string) =>
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

// ─── Move type tags ──────────────────────────────────────────────────────────

export const MoveIdentifier = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_]*$/),
).pipe(Schema.brand('MoveIdentifier'));
export type MoveIdentifier = typeof MoveIdentifier.Type;

export const PrimitiveTypeTagName = Schema.Literals([
  'bool',
  'u8',
  'u16',
  'u32',
  'u64',
  'u128',
  'u256',
  'address',
  'signer',
] as const);
export type PrimitiveTypeTagName = typeof PrimitiveTypeTagName.Type;

const primitiveTypeTags = new Set<string>(PrimitiveTypeTagName.literals);

export function normalizeSuiTypeTag(value: string): string {
  const type = value.trim();
  if (primitiveTypeTags.has(type)) return type;

  if (type.startsWith('vector<')) {
    if (!type.endsWith('>')) throw new Error(`Invalid vector type tag: ${value}`);
    return `vector<${normalizeSuiTypeTag(type.slice('vector<'.length, -1))}>`;
  }

  if (!type.includes('::')) throw new Error(`Invalid Sui type tag: ${value}`);

  const parsed = parseStructTag(type);
  const normalizedParams = parsed.typeParams.map((param) =>
    typeof param === 'string' ? normalizeSuiTypeTag(param) : normalizeStructTag(param),
  );

  return normalizeStructTag({
    ...parsed,
    typeParams: normalizedParams,
  });
}

const validSuiTypeTag = Schema.makeFilter<string>(
  (value) => {
    try {
      normalizeSuiTypeTag(value);
      return true;
    } catch {
      return false;
    }
  },
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
  Schema.check(
    Schema.makeFilter<string>(isValidStructTag, {
      expected: 'a Sui struct tag',
    }),
  ),
  Schema.brand('SuiStructTagString'),
);
export type SuiStructTagString = typeof SuiStructTagString.Type;

export type SuiTypeTag = PrimitiveTypeTag | VectorTypeTag | StructTypeTag;

export class SuiStructTag extends Schema.Class<SuiStructTag>('SuiStructTag')({
  address: SuiAddress,
  module: MoveIdentifier,
  name: MoveIdentifier,
  typeParams: Schema.Array(Schema.suspend((): Schema.Schema<SuiTypeTag> => SuiTypeTag)),
}) {
  toString(): string {
    const typeParams = this.typeParams.map((param) => typeTagToString(param));
    return normalizeStructTag({
      address: this.address,
      module: this.module,
      name: this.name,
      typeParams,
    });
  }
}

export class PrimitiveTypeTag extends Schema.TaggedClass<PrimitiveTypeTag>()('PrimitiveTypeTag', {
  name: PrimitiveTypeTagName,
}) {
  toString(): string {
    return this.name;
  }
}

export class VectorTypeTag extends Schema.TaggedClass<VectorTypeTag>()('VectorTypeTag', {
  element: Schema.suspend((): Schema.Schema<SuiTypeTag> => SuiTypeTag),
}) {
  toString(): string {
    return `vector<${typeTagToString(this.element)}>`;
  }
}

export class StructTypeTag extends Schema.TaggedClass<StructTypeTag>()('StructTypeTag', {
  struct: SuiStructTag,
}) {
  toString(): string {
    return this.struct.toString();
  }
}

export const SuiTypeTag: Schema.Schema<SuiTypeTag> = Schema.Union([
  PrimitiveTypeTag,
  VectorTypeTag,
  StructTypeTag,
]);

export function typeTagToString(typeTag: SuiTypeTag): string {
  switch (typeTag._tag) {
    case 'PrimitiveTypeTag':
      return typeTag.name;
    case 'VectorTypeTag':
      return `vector<${typeTagToString(typeTag.element)}>`;
    case 'StructTypeTag':
      return typeTag.struct.toString();
  }
}

export function parseSuiTypeTag(value: string): SuiTypeTag {
  const normalized = normalizeSuiTypeTag(value);
  if (primitiveTypeTags.has(normalized)) {
    return new PrimitiveTypeTag({ name: normalized as PrimitiveTypeTagName });
  }

  if (normalized.startsWith('vector<')) {
    return new VectorTypeTag({
      element: parseSuiTypeTag(normalized.slice('vector<'.length, -1)),
    });
  }

  const parsed = parseStructTag(normalized);
  return new StructTypeTag({
    struct: new SuiStructTag({
      address: Schema.decodeUnknownSync(SuiAddress)(parsed.address),
      module: Schema.decodeUnknownSync(MoveIdentifier)(parsed.module),
      name: Schema.decodeUnknownSync(MoveIdentifier)(parsed.name),
      typeParams: parsed.typeParams.map((param) =>
        typeof param === 'string' ? parseSuiTypeTag(param) : parseSuiTypeTag(normalizeStructTag(param)),
      ),
    }),
  });
}

// ─── Object refs / object args ───────────────────────────────────────────────

export class SuiObjectRef extends Schema.Class<SuiObjectRef>('SuiObjectRef')({
  objectId: SuiObjectId,
  version: SuiObjectVersion,
  digest: SuiObjectDigest,
}) {
  get key(): string {
    return `${this.objectId}@${this.version}:${this.digest}`;
  }

  toMysten(): { readonly objectId: string; readonly version: string; readonly digest: string } {
    return {
      objectId: this.objectId,
      version: this.version,
      digest: this.digest,
    };
  }
}

export class SharedObjectRef extends Schema.Class<SharedObjectRef>('SharedObjectRef')({
  objectId: SuiObjectId,
  initialSharedVersion: SuiObjectVersion,
  mutable: Schema.Boolean,
}) {
  toMysten(): {
    readonly objectId: string;
    readonly initialSharedVersion: string;
    readonly mutable: boolean;
  } {
    return {
      objectId: this.objectId,
      initialSharedVersion: this.initialSharedVersion,
      mutable: this.mutable,
    };
  }
}

export const SuiObjectArg = Schema.Union([
  Schema.TaggedStruct('ImmOrOwnedObject', { ref: SuiObjectRef }),
  Schema.TaggedStruct('SharedObject', { ref: SharedObjectRef }),
  Schema.TaggedStruct('Receiving', { ref: SuiObjectRef }),
]);
export type SuiObjectArg = typeof SuiObjectArg.Type;

// ─── Typed errors ────────────────────────────────────────────────────────────

export const SuiObjectErrorCode = Schema.Literals([
  'notExists',
  'dynamicFieldNotFound',
  'deleted',
  'displayError',
  'unknown',
] as const);
export type SuiObjectErrorCode = typeof SuiObjectErrorCode.Type;

export class SuiSchemaDecodeError extends Schema.TaggedErrorClass<SuiSchemaDecodeError>(
  '@tmnl/effect-sui/SuiSchemaDecodeError',
)('Sui/SchemaDecode', {
  schema: Schema.String,
  message: Schema.String,
  input: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiObjectLoadError extends Schema.TaggedErrorClass<SuiObjectLoadError>(
  '@tmnl/effect-sui/SuiObjectLoadError',
)('Sui/ObjectLoad', {
  code: SuiObjectErrorCode,
  message: Schema.String,
  objectId: Schema.optional(SuiObjectId),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiTransportError extends Schema.TaggedErrorClass<SuiTransportError>(
  '@tmnl/effect-sui/SuiTransportError',
)('Sui/Transport', {
  transport: Schema.Literals(['json-rpc', 'grpc', 'graphql', 'faucet', 'unknown'] as const),
  message: Schema.String,
  endpoint: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiExecutionError extends Schema.TaggedErrorClass<SuiExecutionError>(
  '@tmnl/effect-sui/SuiExecutionError',
)('Sui/Execution', {
  message: Schema.String,
  digest: Schema.optional(SuiTransactionDigest),
  command: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiInvariantViolation extends Schema.TaggedErrorClass<SuiInvariantViolation>(
  '@tmnl/effect-sui/SuiInvariantViolation',
)('Sui/InvariantViolation', {
  invariant: Schema.String,
  message: Schema.String,
  context: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
}) {}

export type SuiError =
  | SuiSchemaDecodeError
  | SuiObjectLoadError
  | SuiTransportError
  | SuiExecutionError
  | SuiInvariantViolation;

// ─── Transaction policy schemas ──────────────────────────────────────────────

export const SuiBuildMode = Schema.Literals(['build-only', 'dry-run', 'execute'] as const);
export type SuiBuildMode = typeof SuiBuildMode.Type;

export class AutoGasPolicy extends Schema.TaggedClass<AutoGasPolicy>()('AutoGasPolicy', {
  budget: Schema.optional(Schema.String),
  price: Schema.optional(Schema.String),
}) {}

export class ExplicitGasPolicy extends Schema.TaggedClass<ExplicitGasPolicy>()('ExplicitGasPolicy', {
  budget: Schema.String,
  price: Schema.optional(Schema.String),
}) {}

export const SuiGasPolicy = Schema.Union([AutoGasPolicy, ExplicitGasPolicy]);
export type SuiGasPolicy = typeof SuiGasPolicy.Type;

export class AutoPaymentPolicy extends Schema.TaggedClass<AutoPaymentPolicy>()('AutoPaymentPolicy', {
  addressBalance: Schema.Boolean,
}) {}

export class ExplicitPaymentPolicy extends Schema.TaggedClass<ExplicitPaymentPolicy>()(
  'ExplicitPaymentPolicy',
  {
    gasOwner: Schema.optional(SuiAddress),
    gasPayment: Schema.Array(SuiObjectRef),
  },
) {}

export class SponsoredPaymentPolicy extends Schema.TaggedClass<SponsoredPaymentPolicy>()(
  'SponsoredPaymentPolicy',
  {
    sponsor: SuiAddress,
    gasPayment: Schema.Array(SuiObjectRef),
  },
) {}

export const SuiPaymentPolicy = Schema.Union([
  AutoPaymentPolicy,
  ExplicitPaymentPolicy,
  SponsoredPaymentPolicy,
]);
export type SuiPaymentPolicy = typeof SuiPaymentPolicy.Type;

export class KeypairAuthPolicy extends Schema.TaggedClass<KeypairAuthPolicy>()('KeypairAuthPolicy', {
  signer: Schema.Unknown,
  sender: Schema.optional(SuiAddress),
}) {}

export class OfflineAuthPolicy extends Schema.TaggedClass<OfflineAuthPolicy>()('OfflineAuthPolicy', {
  sender: SuiAddress,
}) {}

export class SponsoredAuthPolicy extends Schema.TaggedClass<SponsoredAuthPolicy>()('SponsoredAuthPolicy', {
  sender: SuiAddress,
  sponsor: SuiAddress,
  signer: Schema.Unknown,
  sponsorSigner: Schema.optional(Schema.Unknown),
}) {}

export const SuiAuthPolicy = Schema.Union([
  KeypairAuthPolicy,
  OfflineAuthPolicy,
  SponsoredAuthPolicy,
]);
export type SuiAuthPolicy = typeof SuiAuthPolicy.Type;

// ─── Decode helpers ──────────────────────────────────────────────────────────

export const decodeSuiAddress = Schema.decodeUnknownSync(SuiAddress);
export const decodeSuiObjectId = Schema.decodeUnknownSync(SuiObjectId);
export const decodeSuiObjectDigest = Schema.decodeUnknownSync(SuiObjectDigest);
export const decodeSuiTransactionDigest = Schema.decodeUnknownSync(SuiTransactionDigest);
export const decodeSuiObjectRef = Schema.decodeUnknownSync(SuiObjectRef);
export const decodeSuiTypeTagString = Schema.decodeUnknownSync(SuiTypeTagString);

export const encodeSuiObjectRef = Schema.encodeUnknownSync(SuiObjectRef);
