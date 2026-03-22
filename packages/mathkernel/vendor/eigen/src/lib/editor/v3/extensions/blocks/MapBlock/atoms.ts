/**
 * MapBlock Atoms
 *
 * Atoms-as-state for Mapbox + deck.gl block.
 * Controlled viewState pattern for document sync.
 *
 * @module editor/v3/extensions/blocks/MapBlock/atoms
 */

import { Atom, Result } from '@effect-atom/atom-react';
import type { MapViewState, FlyToInterpolator } from '@deck.gl/core';
import type { LayerProps } from '@deck.gl/core';
import type { StreamBinding, ViewArtifact } from '@/lib/connection-ports';

// =============================================================================
// Types
// =============================================================================

export interface MapBlockState {
  /** View state (lng, lat, zoom, pitch, bearing) */
  viewState: MapViewState;
  /** Active deck.gl layers */
  layers: LayerProps[];
  /** Whether map is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

export interface MapConfig {
  /** Mapbox style URL */
  mapStyle: string;
  /** Initial view state */
  initialViewState: MapViewState;
  /** Mapbox access token */
  accessToken?: string;
}

// =============================================================================
// Stream Binding Types
// =============================================================================

/**
 * Marker data from stream payload.
 */
export interface MarkerData {
  /** Marker ID */
  id: string;
  /** Position [longitude, latitude] */
  position: [number, number];
  /** Color [r, g, b] */
  color: [number, number, number];
  /** Optional label */
  label?: string;
  /** Optional size */
  size?: number;
}

/**
 * Stream source configuration for MapBlock markers.
 * When provided, markers are sourced from AVA streams instead of local state.
 */
export interface MapStreamConfig {
  /** Stream binding configuration */
  binding: StreamBinding;

  /** Transform artifact payload to markers */
  payloadToMarkers?: (payload: unknown) => MarkerData[];
}

/**
 * Default payload transformer.
 * Expects artifact.payload to be { markers: MarkerData[] }
 */
export function defaultPayloadToMarkers(payload: unknown): MarkerData[] {
  if (
    payload &&
    typeof payload === 'object' &&
    'markers' in payload &&
    Array.isArray((payload as { markers: unknown }).markers)
  ) {
    return (payload as { markers: MarkerData[] }).markers;
  }
  return [];
}

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULT_VIEW_STATE: MapViewState = {
  longitude: -122.4194,
  latitude: 37.7749,
  zoom: 11,
  pitch: 0,
  bearing: 0,
};

export const DEFAULT_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

export const DEFAULT_MAP_CONFIG: MapConfig = {
  mapStyle: DEFAULT_MAP_STYLE,
  initialViewState: DEFAULT_VIEW_STATE,
};

// =============================================================================
// Atoms
// =============================================================================

/**
 * Create map block atoms for a specific block instance.
 * Using Atom.family pattern for per-block state isolation.
 *
 * @param blockId - Unique block identifier
 * @param streamConfig - Optional stream configuration for AVA integration
 */
export function createMapBlockAtoms(
  blockId: string,
  streamConfig?: MapStreamConfig
) {
  const viewStateAtom = Atom.make<MapViewState>(DEFAULT_VIEW_STATE);
  const layersAtom = Atom.make<LayerProps[]>([]);
  const markersAtom = Atom.make<MarkerData[]>([]);
  const isLoadingAtom = Atom.make(true);
  const errorAtom = Atom.make<string | null>(null);
  const configAtom = Atom.make<MapConfig>(DEFAULT_MAP_CONFIG);

  // Stream state (when using ConnectionPorts)
  const streamBindingAtom = Atom.make<StreamBinding | null>(
    streamConfig?.binding ?? null
  );
  const streamResultAtom = Atom.make<Result.Result<ViewArtifact, Error>>(
    Result.initial(false)
  );

  // Derived: marker count
  const markerCountAtom = Atom.make((get) => get(markersAtom).length);

  // Derived: complete state snapshot
  const stateAtom = Atom.make((get) => ({
    viewState: get(viewStateAtom),
    layers: get(layersAtom),
    markers: get(markersAtom),
    isLoading: get(isLoadingAtom),
    error: get(errorAtom),
  }));

  // Derived: stream status
  const isStreamConnectedAtom = Atom.make((get) => {
    const result = get(streamResultAtom);
    return Result.isSuccess(result);
  });

  // Derived: stream error message
  const streamErrorAtom = Atom.make((get) => {
    const result = get(streamResultAtom);
    if (Result.isFailure(result)) {
      return 'Stream error occurred';
    }
    return null;
  });

  return {
    blockId,
    streamConfig,
    // View & config
    viewStateAtom,
    configAtom,
    // Marker state
    markersAtom,
    markerCountAtom,
    // Layer state
    layersAtom,
    // Loading/error
    isLoadingAtom,
    errorAtom,
    // Stream binding
    streamBindingAtom,
    streamResultAtom,
    isStreamConnectedAtom,
    streamErrorAtom,
    // Snapshot
    stateAtom,
  };
}

export type MapBlockAtoms = ReturnType<typeof createMapBlockAtoms>;

// =============================================================================
// Atom Registry (per-block instances)
// =============================================================================

const atomRegistry = new Map<string, MapBlockAtoms>();

export function getMapBlockAtoms(blockId: string): MapBlockAtoms {
  let atoms = atomRegistry.get(blockId);
  if (!atoms) {
    atoms = createMapBlockAtoms(blockId);
    atomRegistry.set(blockId, atoms);
  }
  return atoms;
}

export function disposeMapBlockAtoms(blockId: string): void {
  atomRegistry.delete(blockId);
}
