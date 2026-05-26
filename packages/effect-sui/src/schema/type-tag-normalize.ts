import { normalizeStructTag, parseStructTag } from '@mysten/sui/utils';

import { primitiveTypeTags } from './type-tag-primitives';

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
