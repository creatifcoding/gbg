import type { Geom3 } from '@jscad/modeling/src/geometries/types.js';

import { cuboidFromOrigin, measureBox, translateSolid, type BoundingBox, type Vec3 } from './modeling.ts';
import { ENCLOSURE_PARAMS } from './params.ts';

export const B01_PARAM_ROWS = [
  'frame.band',
  'frame.exterior.width',
  'frame.exterior.depth',
  'frame.exterior.height',
  'frame.module_pitch',
  'frame.first_span',
  'animal_volume.metal_allowed',
] as const;

export type CornerBlock = {
  readonly kind: 'B01-corner-block';
  readonly bomId: 'B01';
  readonly maturity: 'draft';
  readonly printed: true;
  readonly metal: false;
  readonly paramsRows: typeof B01_PARAM_ROWS;
  readonly sizeMm: Vec3;
  readonly solid: Geom3;
};

export type CornerInstance = {
  readonly kind: 'B01-corner-instance';
  readonly solidId: string;
  readonly origin: Vec3;
  readonly solid: Geom3;
};

const band = ENCLOSURE_PARAMS.band.value;
const width = ENCLOSURE_PARAMS.exterior.width.value;
const depth = ENCLOSURE_PARAMS.exterior.depth.value;
const height = ENCLOSURE_PARAMS.exterior.height.value;

export const CORNER_ORIGINS: readonly [
  Vec3,
  Vec3,
  Vec3,
  Vec3,
  Vec3,
  Vec3,
  Vec3,
  Vec3,
] = [
  [0, 0, 0],
  [width - band, 0, 0],
  [0, depth - band, 0],
  [width - band, depth - band, 0],
  [0, 0, height - band],
  [width - band, 0, height - band],
  [0, depth - band, height - band],
  [width - band, depth - band, height - band],
];

export const buildCornerBlock = (): CornerBlock => ({
  kind: 'B01-corner-block',
  bomId: 'B01',
  maturity: 'draft',
  printed: true,
  metal: false,
  paramsRows: B01_PARAM_ROWS,
  sizeMm: [band, band, band],
  solid: cuboidFromOrigin([band, band, band]),
});

export const buildCornerInstances = (): readonly CornerInstance[] => {
  const unique = buildCornerBlock();
  return CORNER_ORIGINS.map((origin, index) => ({
    kind: 'B01-corner-instance',
    solidId: `B01-corner-0${index + 1}`,
    origin,
    solid: translateSolid(origin, unique.solid),
  }));
};

export const measureCornerBox = (solid: Geom3): BoundingBox => measureBox(solid);
