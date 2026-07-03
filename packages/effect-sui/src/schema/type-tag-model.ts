import { normalizeStructTag } from '@mysten/sui/utils';
import * as Schema from 'effect/Schema';

import { MoveIdentifier } from './move-identifiers';
import { SuiAddress } from './strings';
import { PrimitiveTypeTagName } from './type-tag-primitives';

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
