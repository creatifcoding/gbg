/**
 * Layer Builder
 *
 * Converts RenderSpec layer configurations to deck.gl Layer instances.
 * Server-driven rendering: AVA defines the visualization, frontend renders.
 *
 * @module connection-ports/layers
 */

import { Layer } from '@deck.gl/core';
import {
  ScatterplotLayer,
  IconLayer,
  PathLayer,
  PolygonLayer,
  GeoJsonLayer,
} from '@deck.gl/layers';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { Effect, pipe } from 'effect';

import type {
  LayerConfig,
  ScatterplotLayerConfig,
  IconLayerConfig,
  PathLayerConfig,
  PolygonLayerConfig,
  HexagonLayerConfig,
  GeoJsonLayerConfig,
  MapRenderOptions,
  RGBAColor,
} from '../schemas/layers';

// =============================================================================
// Types
// =============================================================================

export interface LayerBuildContext {
  /** Data payload from artifact */
  readonly data: readonly unknown[];
  /** Optional icon atlas for IconLayer */
  readonly iconAtlas?: string;
  /** Optional icon mapping for IconLayer */
  readonly iconMapping?: Record<string, unknown>;
}

export interface LayerBuildResult {
  readonly layers: readonly Layer[];
  readonly errors: readonly LayerBuildError[];
}

export interface LayerBuildError {
  readonly layerId: string;
  readonly message: string;
  readonly cause?: unknown;
}

// =============================================================================
// Accessor Builders
// =============================================================================

/**
 * Creates an accessor function from a field name string or returns the value directly.
 * Supports dot notation for nested fields (e.g., "position.coordinates")
 */
function createAccessor<T>(
  spec: T | string | undefined,
  defaultValue: T
): T | ((d: unknown) => T) {
  if (spec === undefined) return defaultValue;
  if (typeof spec !== 'string') return spec;

  // Field accessor string - create a function
  const parts = spec.split('.');
  return (d: unknown) => {
    let value: unknown = d;
    for (const part of parts) {
      if (value === null || value === undefined) return defaultValue;
      value = (value as Record<string, unknown>)[part];
    }
    return (value as T) ?? defaultValue;
  };
}

/**
 * Parses a color spec into RGBA array
 */
function parseColor(color: RGBAColor | string | undefined): RGBAColor | undefined {
  if (!color) return undefined;
  if (Array.isArray(color)) return color as RGBAColor;

  // Hex color string
  if (typeof color === 'string' && color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
    if (hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        parseInt(hex.slice(6, 8), 16),
      ];
    }
  }

  return undefined;
}

// =============================================================================
// Layer Builders
// =============================================================================

function buildScatterplotLayer(
  config: ScatterplotLayerConfig,
  ctx: LayerBuildContext
): ScatterplotLayer {
  return new ScatterplotLayer({
    id: config.id,
    data: ctx.data,
    visible: config.visible ?? true,
    opacity: config.opacity ?? 1,
    pickable: config.pickable ?? true,
    autoHighlight: config.autoHighlight ?? false,
    highlightColor: config.highlightColor as [number, number, number, number] | undefined,

    getPosition: createAccessor(config.getPosition, [0, 0]) as (d: unknown) => [number, number],
    getRadius: createAccessor(config.getRadius, 10) as number | ((d: unknown) => number),
    getFillColor: config.getFillColor
      ? typeof config.getFillColor === 'string'
        ? createAccessor(config.getFillColor, [255, 0, 0]) as (d: unknown) => [number, number, number]
        : (parseColor(config.getFillColor) as [number, number, number])
      : [255, 140, 0],
    getLineColor: config.getLineColor
      ? typeof config.getLineColor === 'string'
        ? createAccessor(config.getLineColor, [0, 0, 0]) as (d: unknown) => [number, number, number]
        : (parseColor(config.getLineColor) as [number, number, number])
      : [0, 0, 0],
    getLineWidth: createAccessor(config.getLineWidth, 1) as number | ((d: unknown) => number),

    radiusUnits: config.radiusUnits ?? 'meters',
    radiusMinPixels: config.radiusMinPixels ?? 1,
    radiusMaxPixels: config.radiusMaxPixels ?? 100,
    radiusScale: config.radiusScale ?? 1,
    stroked: config.stroked ?? false,
    filled: config.filled ?? true,
    billboard: config.billboard ?? false,
    antialiasing: config.antialiasing ?? true,
  });
}

function buildIconLayer(
  config: IconLayerConfig,
  ctx: LayerBuildContext
): IconLayer {
  return new IconLayer({
    id: config.id,
    data: ctx.data,
    visible: config.visible ?? true,
    opacity: config.opacity ?? 1,
    pickable: config.pickable ?? true,
    autoHighlight: config.autoHighlight ?? false,
    highlightColor: config.highlightColor as [number, number, number, number] | undefined,

    getPosition: createAccessor(config.getPosition, [0, 0]) as (d: unknown) => [number, number],
    getIcon: createAccessor(config.getIcon, 'marker') as string | ((d: unknown) => string),
    getSize: createAccessor(config.getSize, 32) as number | ((d: unknown) => number),
    getColor: config.getColor
      ? typeof config.getColor === 'string'
        ? createAccessor(config.getColor, [255, 255, 255]) as (d: unknown) => [number, number, number]
        : (parseColor(config.getColor) as [number, number, number])
      : [255, 255, 255],
    getAngle: createAccessor(config.getAngle, 0) as number | ((d: unknown) => number),

    sizeUnits: config.sizeUnits ?? 'pixels',
    sizeScale: config.sizeScale ?? 1,
    sizeMinPixels: config.sizeMinPixels ?? 0,
    sizeMaxPixels: config.sizeMaxPixels ?? Number.MAX_SAFE_INTEGER,
    billboard: config.billboard ?? true,
    iconAtlas: config.iconAtlas ?? ctx.iconAtlas,
    iconMapping: config.iconMapping ?? ctx.iconMapping,
  });
}

function buildPathLayer(
  config: PathLayerConfig,
  ctx: LayerBuildContext
): PathLayer {
  return new PathLayer({
    id: config.id,
    data: ctx.data,
    visible: config.visible ?? true,
    opacity: config.opacity ?? 1,
    pickable: config.pickable ?? true,
    autoHighlight: config.autoHighlight ?? false,
    highlightColor: config.highlightColor as [number, number, number, number] | undefined,

    getPath: createAccessor(config.getPath, []) as (d: unknown) => [number, number][],
    getColor: config.getColor
      ? typeof config.getColor === 'string'
        ? createAccessor(config.getColor, [0, 0, 0]) as (d: unknown) => [number, number, number]
        : (parseColor(config.getColor) as [number, number, number])
      : [0, 0, 0],
    getWidth: createAccessor(config.getWidth, 1) as number | ((d: unknown) => number),

    widthUnits: config.widthUnits ?? 'meters',
    widthScale: config.widthScale ?? 1,
    widthMinPixels: config.widthMinPixels ?? 0,
    widthMaxPixels: config.widthMaxPixels ?? Number.MAX_SAFE_INTEGER,
    capRounded: config.capRounded ?? false,
    jointRounded: config.jointRounded ?? false,
    billboard: config.billboard ?? false,
    miterLimit: config.miterLimit ?? 4,
  });
}

function buildPolygonLayer(
  config: PolygonLayerConfig,
  ctx: LayerBuildContext
): PolygonLayer {
  return new PolygonLayer({
    id: config.id,
    data: ctx.data,
    visible: config.visible ?? true,
    opacity: config.opacity ?? 1,
    pickable: config.pickable ?? true,
    autoHighlight: config.autoHighlight ?? false,
    highlightColor: config.highlightColor as [number, number, number, number] | undefined,

    getPolygon: createAccessor(config.getPolygon, []) as (d: unknown) => [number, number][],
    getFillColor: config.getFillColor
      ? typeof config.getFillColor === 'string'
        ? createAccessor(config.getFillColor, [0, 0, 0]) as (d: unknown) => [number, number, number]
        : (parseColor(config.getFillColor) as [number, number, number])
      : [0, 0, 0, 128],
    getLineColor: config.getLineColor
      ? typeof config.getLineColor === 'string'
        ? createAccessor(config.getLineColor, [0, 0, 0]) as (d: unknown) => [number, number, number]
        : (parseColor(config.getLineColor) as [number, number, number])
      : [0, 0, 0],
    getLineWidth: createAccessor(config.getLineWidth, 1) as number | ((d: unknown) => number),
    getElevation: createAccessor(config.getElevation, 0) as number | ((d: unknown) => number),

    filled: config.filled ?? true,
    stroked: config.stroked ?? true,
    extruded: config.extruded ?? false,
    wireframe: config.wireframe ?? false,
    elevationScale: config.elevationScale ?? 1,
    lineWidthUnits: config.lineWidthUnits ?? 'meters',
    lineWidthScale: config.lineWidthScale ?? 1,
    lineWidthMinPixels: config.lineWidthMinPixels ?? 0,
    lineWidthMaxPixels: config.lineWidthMaxPixels ?? Number.MAX_SAFE_INTEGER,
    lineJointRounded: config.lineJointRounded ?? false,
  });
}

function buildHexagonLayer(
  config: HexagonLayerConfig,
  ctx: LayerBuildContext
): HexagonLayer {
  return new HexagonLayer({
    id: config.id,
    data: ctx.data,
    visible: config.visible ?? true,
    opacity: config.opacity ?? 1,
    pickable: config.pickable ?? true,
    autoHighlight: config.autoHighlight ?? false,
    highlightColor: config.highlightColor as [number, number, number, number] | undefined,

    getPosition: createAccessor(config.getPosition, [0, 0]) as (d: unknown) => [number, number],
    radius: config.radius ?? 1000,
    colorRange: config.colorRange as [number, number, number][] | undefined,
    coverage: config.coverage ?? 1,
    elevationRange: config.elevationRange ?? [0, 1000],
    elevationScale: config.elevationScale ?? 1,
    extruded: config.extruded ?? false,
    colorAggregation: config.colorAggregation ?? 'SUM',
    elevationAggregation: config.elevationAggregation ?? 'SUM',
    getColorWeight: createAccessor(config.getColorWeight, 1) as number | ((d: unknown) => number),
    getElevationWeight: createAccessor(config.getElevationWeight, 1) as number | ((d: unknown) => number),
    upperPercentile: config.upperPercentile ?? 100,
    lowerPercentile: config.lowerPercentile ?? 0,
  });
}

function buildGeoJsonLayer(
  config: GeoJsonLayerConfig,
  ctx: LayerBuildContext
): GeoJsonLayer {
  return new GeoJsonLayer({
    id: config.id,
    data: ctx.data as unknown,
    visible: config.visible ?? true,
    opacity: config.opacity ?? 1,
    pickable: config.pickable ?? true,
    autoHighlight: config.autoHighlight ?? false,
    highlightColor: config.highlightColor as [number, number, number, number] | undefined,

    getFillColor: config.getFillColor
      ? typeof config.getFillColor === 'string'
        ? createAccessor(config.getFillColor, [0, 0, 0]) as (d: unknown) => [number, number, number]
        : (parseColor(config.getFillColor) as [number, number, number])
      : [160, 160, 180, 200],
    getLineColor: config.getLineColor
      ? typeof config.getLineColor === 'string'
        ? createAccessor(config.getLineColor, [0, 0, 0]) as (d: unknown) => [number, number, number]
        : (parseColor(config.getLineColor) as [number, number, number])
      : [0, 0, 0],
    getLineWidth: createAccessor(config.getLineWidth, 1) as number | ((d: unknown) => number),
    getPointRadius: createAccessor(config.getPointRadius, 10) as number | ((d: unknown) => number),
    getElevation: createAccessor(config.getElevation, 0) as number | ((d: unknown) => number),

    filled: config.filled ?? true,
    stroked: config.stroked ?? true,
    extruded: config.extruded ?? false,
    wireframe: config.wireframe ?? false,
    pointType: config.pointType ?? 'circle',
    lineWidthUnits: config.lineWidthUnits ?? 'meters',
    lineWidthScale: config.lineWidthScale ?? 1,
    lineWidthMinPixels: config.lineWidthMinPixels ?? 0,
    lineWidthMaxPixels: config.lineWidthMaxPixels ?? Number.MAX_SAFE_INTEGER,
    pointRadiusUnits: config.pointRadiusUnits ?? 'meters',
    pointRadiusScale: config.pointRadiusScale ?? 1,
    pointRadiusMinPixels: config.pointRadiusMinPixels ?? 0,
    pointRadiusMaxPixels: config.pointRadiusMaxPixels ?? Number.MAX_SAFE_INTEGER,
    elevationScale: config.elevationScale ?? 1,
  });
}

// =============================================================================
// Main Builder
// =============================================================================

/**
 * Builds a single layer from config
 */
function buildLayer(
  config: LayerConfig,
  ctx: LayerBuildContext
): Effect.Effect<Layer, LayerBuildError> {
  return Effect.try({
    try: () => {
      switch (config._tag) {
        case 'ScatterplotLayerConfig':
          return buildScatterplotLayer(config, ctx);
        case 'IconLayerConfig':
          return buildIconLayer(config, ctx);
        case 'PathLayerConfig':
          return buildPathLayer(config, ctx);
        case 'PolygonLayerConfig':
          return buildPolygonLayer(config, ctx);
        case 'HexagonLayerConfig':
          return buildHexagonLayer(config, ctx);
        case 'GeoJsonLayerConfig':
          return buildGeoJsonLayer(config, ctx);
        default:
          throw new Error(`Unknown layer type: ${(config as { _tag: string })._tag}`);
      }
    },
    catch: (error) => ({
      layerId: config.id,
      message: error instanceof Error ? error.message : 'Unknown error building layer',
      cause: error,
    }),
  });
}

/**
 * Builds all layers from RenderSpec options
 */
export function buildLayersFromSpec(
  options: MapRenderOptions,
  ctx: LayerBuildContext
): Effect.Effect<LayerBuildResult> {
  const configs = options.layers ?? [];

  return Effect.gen(function* () {
    const results = yield* Effect.all(
      configs.map((config) =>
        pipe(
          buildLayer(config, ctx),
          Effect.map((layer) => ({ success: true as const, layer })),
          Effect.catchAll((error) =>
            Effect.succeed({ success: false as const, error })
          )
        )
      ),
      { concurrency: 'unbounded' }
    );

    const layers: Layer[] = [];
    const errors: LayerBuildError[] = [];

    for (const result of results) {
      if (result.success) {
        layers.push(result.layer);
      } else {
        errors.push(result.error);
      }
    }

    return { layers, errors };
  });
}

/**
 * Synchronous layer builder (for simple cases)
 */
export function buildLayersFromSpecSync(
  options: MapRenderOptions,
  ctx: LayerBuildContext
): LayerBuildResult {
  const configs = options.layers ?? [];
  const layers: Layer[] = [];
  const errors: LayerBuildError[] = [];

  for (const config of configs) {
    try {
      switch (config._tag) {
        case 'ScatterplotLayerConfig':
          layers.push(buildScatterplotLayer(config, ctx));
          break;
        case 'IconLayerConfig':
          layers.push(buildIconLayer(config, ctx));
          break;
        case 'PathLayerConfig':
          layers.push(buildPathLayer(config, ctx));
          break;
        case 'PolygonLayerConfig':
          layers.push(buildPolygonLayer(config, ctx));
          break;
        case 'HexagonLayerConfig':
          layers.push(buildHexagonLayer(config, ctx));
          break;
        case 'GeoJsonLayerConfig':
          layers.push(buildGeoJsonLayer(config, ctx));
          break;
        default:
          errors.push({
            layerId: config.id,
            message: `Unknown layer type: ${(config as { _tag: string })._tag}`,
          });
      }
    } catch (error) {
      errors.push({
        layerId: config.id,
        message: error instanceof Error ? error.message : 'Unknown error',
        cause: error,
      });
    }
  }

  return { layers, errors };
}

// =============================================================================
// Exports
// =============================================================================

export type { LayerConfig, MapRenderOptions } from '../schemas/layers';
