import { createRequire } from 'node:module';

import type { Geom2, Geom3, Path2 } from '@jscad/modeling/src/geometries/types.js';

export type Vec2 = readonly [number, number];

export type Vec3 = readonly [number, number, number];

export type BoundingBox = readonly [Vec3, Vec3];

export type { Path2 };

type Modeling = {
  readonly primitives: {
    readonly cuboid: (options: { readonly size: Vec3; readonly center: Vec3 }) => Geom3;
  };
  readonly measurements: {
    readonly measureBoundingBox: (geometry: Geom3) => [[number, number, number], [number, number, number]];
  };
  readonly transforms: {
    readonly translate: (offset: Vec3, geometry: Geom3) => Geom3;
  };
  readonly extrusions: {
    readonly project: (
      options: { readonly axis: Vec3; readonly origin: Vec3 },
      geometry: Geom3,
    ) => Geom2;
  };
  readonly geometries: {
    readonly geom2: {
      readonly isA: (value: unknown) => value is Geom2;
      readonly toOutlines: (geometry: Geom2) => Array<Array<[number, number]>>;
    };
    readonly path2: {
      readonly fromPoints: (options: { readonly closed: boolean }, points: ReadonlyArray<Vec2>) => Path2;
    };
  };
  readonly colors: {
    readonly colorize: (color: readonly [number, number, number, number], object: Path2) => Path2;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isModeling = (value: unknown): value is Modeling => {
  if (
    !isRecord(value) ||
    !isRecord(value.primitives) ||
    !isRecord(value.measurements) ||
    !isRecord(value.transforms) ||
    !isRecord(value.extrusions) ||
    !isRecord(value.geometries) ||
    !isRecord(value.colors) ||
    !isRecord(value.geometries.geom2) ||
    !isRecord(value.geometries.path2)
  ) {
    return false;
  }
  return (
    typeof value.primitives.cuboid === 'function' &&
    typeof value.measurements.measureBoundingBox === 'function' &&
    typeof value.transforms.translate === 'function' &&
    typeof value.extrusions.project === 'function' &&
    typeof value.geometries.geom2.isA === 'function' &&
    typeof value.geometries.geom2.toOutlines === 'function' &&
    typeof value.geometries.path2.fromPoints === 'function' &&
    typeof value.colors.colorize === 'function'
  );
};

const modeling = ((): Modeling => {
  // @jscad/modeling is CJS; NodeNext named imports fail at runtime.
  const loaded: unknown = createRequire(import.meta.url)('@jscad/modeling');
  if (!isModeling(loaded)) {
    throw new Error(
      '@jscad/modeling missing cuboid, measureBoundingBox, translate, project, toOutlines, fromPoints, or colorize',
    );
  }
  return loaded;
})();

export const cuboidFromOrigin = (size: Vec3): Geom3 =>
  modeling.primitives.cuboid({
    size,
    center: [size[0] / 2, size[1] / 2, size[2] / 2],
  });

export const measureBox = (solid: Geom3): BoundingBox =>
  modeling.measurements.measureBoundingBox(solid);

export const translateSolid = (offset: Vec3, solid: Geom3): Geom3 =>
  modeling.transforms.translate(offset, solid);

export const projectSolid = (options: { readonly axis: Vec3; readonly origin: Vec3 }, solid: Geom3): Geom2 =>
  modeling.extrusions.project(options, solid);

export const isGeom2 = (value: unknown): value is Geom2 => modeling.geometries.geom2.isA(value);

export const outlinesFromGeom2 = (geometry: Geom2): Array<Array<[number, number]>> =>
  modeling.geometries.geom2.toOutlines(geometry);

export const closedPathFromPoints = (points: ReadonlyArray<Vec2>): Path2 =>
  modeling.geometries.path2.fromPoints({ closed: true }, points);

export const strokePath = (path: Path2): Path2 => modeling.colors.colorize([0, 0, 0, 1], path);
