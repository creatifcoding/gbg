import { createRequire } from 'node:module';

import type { Geom2, Path2 } from '@jscad/modeling/src/geometries/types.js';

import { closedPathFromPoints, isGeom2, outlinesFromGeom2, strokePath } from './modeling.ts';

type SvgSerializer = {
  readonly serialize: (options: { readonly unit: 'mm' }, ...objects: Path2[]) => unknown;
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

export const strokedPathsFromGeom2 = (geometry: Geom2): Path2[] => {
  const outlines = outlinesFromGeom2(geometry);
  if (outlines.length === 0) {
    throw new Error('project() returned a geom2 with no outlines');
  }
  return outlines.map((points) => strokePath(closedPathFromPoints(points)));
};

const asPathList = (objects: Geom2 | Path2 | ReadonlyArray<Geom2 | Path2>): Path2[] => {
  const list = Array.isArray(objects) ? objects : [objects];
  return list.flatMap((object) => (isGeom2(object) ? strokedPathsFromGeom2(object) : [object]));
};

export const serializeSvg = (objects: Geom2 | Path2 | ReadonlyArray<Geom2 | Path2>): string => {
  const paths = asPathList(objects);
  const chunks = svgSerializer.serialize({ unit: 'mm' }, ...paths);
  if (!isStringArray(chunks) || chunks.length === 0) {
    throw new Error('@jscad/svg-serializer.serialize did not return SVG strings');
  }
  return chunks.join('');
};
