import { createRequire } from 'node:module';

import type { Geom3 } from '@jscad/modeling/src/geometries/types.js';

import { ENCLOSURE_PARAMS, type EnclosureParams } from './params.ts';

type Modeling = {
  readonly primitives: {
    readonly cuboid: (options: {
      readonly size: readonly [number, number, number];
      readonly center: readonly [number, number, number];
    }) => Geom3;
  };
  readonly measurements: {
    readonly measureBoundingBox: (
      geometry: Geom3,
    ) => [[number, number, number], [number, number, number]];
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isModeling = (value: unknown): value is Modeling => {
  if (!isRecord(value) || !isRecord(value.primitives) || !isRecord(value.measurements)) {
    return false;
  }
  return (
    typeof value.primitives.cuboid === 'function' &&
    typeof value.measurements.measureBoundingBox === 'function'
  );
};

const modeling = ((): Modeling => {
  // @jscad/modeling is CJS; NodeNext named imports fail at runtime.
  const loaded: unknown = createRequire(import.meta.url)('@jscad/modeling');
  if (!isModeling(loaded)) {
    throw new Error('@jscad/modeling missing cuboid or measureBoundingBox');
  }
  return loaded;
})();

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
  const solid = modeling.primitives.cuboid({
    size: [width.value, depth.value, height.value],
    center: [width.value / 2, depth.value / 2, height.value / 2],
  });
  return {
    kind: 'enclosure-envelope',
    maturity: 'draft',
    params: ENCLOSURE_PARAMS,
    solid,
    keepOut: ANIMAL_CLEAR_KEEP_OUT,
  };
};

export const measureEnclosureBox = (
  solid: Geom3,
): readonly [readonly [number, number, number], readonly [number, number, number]] =>
  modeling.measurements.measureBoundingBox(solid);
