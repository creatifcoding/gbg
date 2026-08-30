import type { Geom3 } from '@jscad/modeling/src/geometries/types.js';

import { cuboidFromOrigin, measureBox, type BoundingBox, type Vec3 } from './modeling.ts';
import { ENCLOSURE_PARAMS } from './params.ts';

export const B05_PARAM_ROWS = [
  'panel.stock_thickness',
  'animal.clear.width',
  'animal.clear.height',
  'cassette seat (stock + 0.20 mm TARGET)',
  'animal_volume.metal_allowed',
] as const;

export type ViewCassette = {
  readonly kind: 'B05-view-cassette';
  readonly bomId: 'B05';
  readonly maturity: 'draft';
  readonly printed: false;
  readonly metal: false;
  readonly paramsRows: typeof B05_PARAM_ROWS;
  readonly sizeMm: Vec3;
  readonly worldPlacement: 'unverified';
  readonly solid: Geom3;
};

export const buildViewCassette = (): ViewCassette => {
  const sizeMm: Vec3 = [
    ENCLOSURE_PARAMS.clear.width.value,
    ENCLOSURE_PARAMS.stock.value,
    ENCLOSURE_PARAMS.clear.height.value,
  ];
  return {
    kind: 'B05-view-cassette',
    bomId: 'B05',
    maturity: 'draft',
    printed: false,
    metal: false,
    paramsRows: B05_PARAM_ROWS,
    sizeMm,
    worldPlacement: 'unverified',
    solid: cuboidFromOrigin(sizeMm),
  };
};

export const measureCassetteBox = (solid: Geom3): BoundingBox => measureBox(solid);
