/** Move identifiers and Sui type-tag schemas. */

import {
  isValidStructTag,
  normalizeStructTag,
  parseStructTag,
} from '@mysten/sui/utils';
import * as Schema from 'effect-v4/Schema';

import { SuiAddress, normalizeStringOrFail } from './strings';

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

function normalizeSuiTypeTagOption(value: string): string | undefined {
  const type = value.trim();
  if (primitiveTypeTags.has(type)) return type;

  if (type.startsWith('vector<')) {
    if (!type.endsWith('>')) return undefined;
    const inner = normalizeSuiTypeTagOption(type.slice('vector<'.length, -1));
    return inner ? `vector<${inner}>` : undefined;
  }

  if (!type.includes('::')) return undefined;

  try {
    const parsed = parseStructTag(type);
    const normalizedParams: string[] = [];
    for (const param of parsed.typeParams) {
      const normalized = typeof param === 'string'
        ? normalizeSuiTypeTagOption(param)
        : normalizeSuiTypeTagOption(normalizeStructTag(param));
      if (!normalized) return undefined;
      normalizedParams.push(normalized);
    }

    return normalizeStructTag({
      ...parsed,
      typeParams: normalizedParams,
    });
  } catch {
    return undefined;
  }
}

export function normalizeSuiTypeTag(value: string): string {
  return normalizeSuiTypeTagOption(value) ?? value.trim();
}

const validSuiTypeTag = Schema.makeFilter<string>(
  (value) => normalizeSuiTypeTagOption(value) !== undefined,
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
