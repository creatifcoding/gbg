import * as Schema from 'effect/Schema';

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
