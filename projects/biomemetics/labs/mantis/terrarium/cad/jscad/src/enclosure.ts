import type { Geom3 } from '@jscad/modeling/src/geometries/types.js';

import { cuboidFromOrigin, measureBox, type BoundingBox } from './modeling.ts';
import { ENCLOSURE_PARAMS, type EnclosureParams } from './params.ts';

export type EnclosureKeepOut = {
  readonly kind: 'animal-clear';
  readonly sizeMm: readonly [202, 202, 427];
  readonly status: 'calculated';
  readonly subtracted: false;
  readonly reason: 'z-origin unverified before gasket closure';
};

export type EnclosureModel = {
  readonly kind: 'enclosure-envelope';
  readonly maturity: 'draft';
  readonly params: EnclosureParams;
  readonly solid: Geom3;
  readonly keepOut: EnclosureKeepOut;
};

export const ANIMAL_CLEAR_KEEP_OUT: EnclosureKeepOut = {
  kind: 'animal-clear',
  sizeMm: [202, 202, 427],
  status: 'calculated',
  subtracted: false,
  reason: 'z-origin unverified before gasket closure',
};

export const buildEnclosure = (): EnclosureModel => {
  const { width, depth, height } = ENCLOSURE_PARAMS.exterior;
  // 500-427 leftover is 73 mm, not 2*band, so the animal-clear void has no locked Z origin.
  return {
    kind: 'enclosure-envelope',
    maturity: 'draft',
    params: ENCLOSURE_PARAMS,
    solid: cuboidFromOrigin([width.value, depth.value, height.value]),
    keepOut: ANIMAL_CLEAR_KEEP_OUT,
  };
};

export const measureEnclosureBox = (solid: Geom3): BoundingBox => measureBox(solid);
