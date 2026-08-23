import { createRequire } from 'node:module';

import type { Geom2, Geom3 } from '@jscad/modeling/src/geometries/types.js';

export type ViewName = 'front' | 'side' | 'top';

export type ViewSpec = {
  readonly name: ViewName;
  readonly axis: readonly [number, number, number];
  readonly origin: readonly [number, number, number];
  readonly plane: 'XZ' | 'YZ' | 'XY';
};

type ModelingViews = {
  readonly extrusions: {
    readonly project: (
      options: {
        readonly axis: readonly [number, number, number];
        readonly origin: readonly [number, number, number];
      },
      geometry: Geom3,
    ) => Geom2;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isModelingViews = (value: unknown): value is ModelingViews => {
  if (!isRecord(value) || !isRecord(value.extrusions)) {
    return false;
  }
  return typeof value.extrusions.project === 'function';
};

const modeling = ((): ModelingViews => {
  const loaded: unknown = createRequire(import.meta.url)('@jscad/modeling');
  if (!isModelingViews(loaded)) {
    throw new Error('@jscad/modeling missing extrusions.project');
  }
  return loaded;
})();

// Origin is front-left-bottom. X right, Y back, Z up.
// axis is the official project() plane normal, not a camera look vector.
export const ENCLOSURE_VIEWS: readonly [ViewSpec, ViewSpec, ViewSpec] = [
  { name: 'front', axis: [0, 1, 0], origin: [0, 0, 0], plane: 'XZ' },
  { name: 'side', axis: [1, 0, 0], origin: [0, 0, 0], plane: 'YZ' },
  { name: 'top', axis: [0, 0, 1], origin: [0, 0, 0], plane: 'XY' },
];

export const projectView = (view: ViewSpec, solid: Geom3): Geom2 =>
  modeling.extrusions.project({ axis: view.axis, origin: view.origin }, solid);
