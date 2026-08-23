import { createRequire } from 'node:module';

import type { Geom2 } from '@jscad/modeling/src/geometries/types.js';

type SvgSerializer = {
  readonly serialize: (options: { readonly unit: 'mm' }, geometry: Geom2) => unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSvgSerializer = (value: unknown): value is SvgSerializer =>
  isRecord(value) && typeof value.serialize === 'function';

const svgSerializer = ((): SvgSerializer => {
  const loaded: unknown = createRequire(import.meta.url)('@jscad/svg-serializer');
  if (!isSvgSerializer(loaded)) {
    throw new Error('@jscad/svg-serializer missing serialize');
  }
  return loaded;
})();

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((chunk) => typeof chunk === 'string');

export const serializeSvg = (geometry: Geom2): string => {
  const chunks = svgSerializer.serialize({ unit: 'mm' }, geometry);
  if (!isStringArray(chunks) || chunks.length === 0) {
    throw new Error('@jscad/svg-serializer.serialize did not return SVG strings');
  }
  return chunks.join('');
};
