import { isValidStructTag, normalizeStructTag, parseStructTag } from '@mysten/sui/utils';
import * as Schema from 'effect-v4/Schema';
import { normalizeStringOrFail } from './strings';

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

export const primitiveTypeTags = new Set<string>(PrimitiveTypeTagName.literals);

export const normalizeSuiTypeTagOption = (value: string): string | undefined => {
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
    return normalizeStructTag({ ...parsed, typeParams: normalizedParams });
  } catch {
    return undefined;
  }
};

export const normalizeSuiTypeTag = (value: string): string => normalizeSuiTypeTagOption(value) ?? value.trim();

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
  Schema.check(Schema.makeFilter<string>(isValidStructTag, { expected: 'a Sui struct tag' })),
  Schema.brand('SuiStructTagString'),
);
export type SuiStructTagString = typeof SuiStructTagString.Type;
