import { normalizeStructTag, parseStructTag } from '@mysten/sui/utils';
import * as Schema from 'effect-v4/Schema';

import { MoveIdentifier } from './move-identifiers';
import { SuiAddress } from './strings';
import { PrimitiveTypeTag, StructTypeTag, SuiStructTag, type SuiTypeTag, VectorTypeTag } from './type-tag-model';
import { normalizeSuiTypeTag } from './type-tag-normalize';
import { primitiveTypeTags, type PrimitiveTypeTagName } from './type-tag-primitives';

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
