import { normalizeStructTag, parseStructTag } from '@mysten/sui/utils';
import * as Schema from 'effect-v4/Schema';
import { MoveIdentifier } from './move-identifiers';
import { SuiAddress } from './strings';
import { normalizeSuiTypeTag, primitiveTypeTags, PrimitiveTypeTagName } from './type-tag-string';

export type SuiTypeTag = PrimitiveTypeTag | VectorTypeTag | StructTypeTag;

export class SuiStructTag extends Schema.Class<SuiStructTag>('SuiStructTag')({
  address: SuiAddress,
  module: MoveIdentifier,
  name: MoveIdentifier,
  typeParams: Schema.Array(Schema.suspend((): Schema.Schema<SuiTypeTag> => SuiTypeTag)),
}) {
  toString(): string {
    const typeParams = this.typeParams.map((param) => typeTagToString(param));
    return normalizeStructTag({ address: this.address, module: this.module, name: this.name, typeParams });
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

export const typeTagToString = (typeTag: SuiTypeTag): string => {
  switch (typeTag._tag) {
    case 'PrimitiveTypeTag':
      return typeTag.name;
    case 'VectorTypeTag':
      return `vector<${typeTagToString(typeTag.element)}>`;
    case 'StructTypeTag':
      return typeTag.struct.toString();
  }
};

export const parseSuiTypeTag = (value: string): SuiTypeTag => {
  const normalized = normalizeSuiTypeTag(value);
  if (primitiveTypeTags.has(normalized)) return new PrimitiveTypeTag({ name: normalized as PrimitiveTypeTagName });

  if (normalized.startsWith('vector<')) {
    return new VectorTypeTag({ element: parseSuiTypeTag(normalized.slice('vector<'.length, -1)) });
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
};
