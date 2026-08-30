import type { Geom3 } from '@jscad/modeling/src/geometries/types.js';

import { cuboidFromOrigin, measureBox, type BoundingBox, type Vec3 } from './modeling.ts';
import { ENCLOSURE_PARAMS } from './params.ts';

export const B06_PARAM_ROWS = [
  'panel.stock_thickness',
  'animal.clear.width',
  'animal.clear.height',
  'animal_volume.metal_allowed',
] as const;

export type FrontDoor = {
  readonly kind: 'B06-front-door';
  readonly bomId: 'B06';
  readonly maturity: 'draft';
  readonly printed: false;
  readonly metal: false;
  readonly paramsRows: typeof B06_PARAM_ROWS;
  readonly sizeMm: Vec3;
  readonly worldPlacement: 'unverified';
  readonly solid: Geom3;
};

export const buildFrontDoor = (): FrontDoor => {
  const sizeMm: Vec3 = [
    ENCLOSURE_PARAMS.clear.width.value,
    ENCLOSURE_PARAMS.stock.value,
    ENCLOSURE_PARAMS.clear.height.value,
  ];
  return {
    kind: 'B06-front-door',
    bomId: 'B06',
    maturity: 'draft',
    printed: false,
    metal: false,
    paramsRows: B06_PARAM_ROWS,
    sizeMm,
    worldPlacement: 'unverified',
    solid: cuboidFromOrigin(sizeMm),
  };
};

export const measureDoorBox = (solid: Geom3): BoundingBox => measureBox(solid);
