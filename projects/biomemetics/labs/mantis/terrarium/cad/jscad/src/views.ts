import type { Geom2, Geom3 } from '@jscad/modeling/src/geometries/types.js';

import { projectSolid, type Vec3 } from './modeling.ts';

export type ViewName = 'front' | 'side' | 'top';

export type ViewSpec = {
  readonly name: ViewName;
  readonly axis: Vec3;
  readonly origin: Vec3;
  readonly plane: 'XZ' | 'YZ' | 'XY';
};

// Origin is front-left-bottom. X right, Y back, Z up.
// axis is the official project() plane normal, not a camera look vector.
export const ENCLOSURE_VIEWS: readonly [ViewSpec, ViewSpec, ViewSpec] = [
  { name: 'front', axis: [0, 1, 0], origin: [0, 0, 0], plane: 'XZ' },
  { name: 'side', axis: [1, 0, 0], origin: [0, 0, 0], plane: 'YZ' },
  { name: 'top', axis: [0, 0, 1], origin: [0, 0, 0], plane: 'XY' },
];

export const projectView = (view: ViewSpec, solid: Geom3): Geom2 =>
  projectSolid({ axis: view.axis, origin: view.origin }, solid);
