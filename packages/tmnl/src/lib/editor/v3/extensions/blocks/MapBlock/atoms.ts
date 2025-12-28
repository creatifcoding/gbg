/**
 * MapBlock Atoms
 *
 * Atoms-as-state for Mapbox + deck.gl block.
 * Controlled viewState pattern for document sync.
 *
 * @module editor/v3/extensions/blocks/MapBlock/atoms
 */

import { Atom } from '@effect-atom/atom-react';
import type { MapViewState, FlyToInterpolator } from '@deck.gl/core';
import type { LayerProps } from '@deck.gl/core';

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
 */
export function createMapBlockAtoms(blockId: string) {
  const viewStateAtom = Atom.make<MapViewState>(DEFAULT_VIEW_STATE);
  const layersAtom = Atom.make<LayerProps[]>([]);
  const isLoadingAtom = Atom.make(true);
  const errorAtom = Atom.make<string | null>(null);
  const configAtom = Atom.make<MapConfig>(DEFAULT_MAP_CONFIG);

  // Derived: complete state snapshot
  const stateAtom = Atom.make((get) => ({
    viewState: get(viewStateAtom),
    layers: get(layersAtom),
    isLoading: get(isLoadingAtom),
    error: get(errorAtom),
  }));

  return {
    blockId,
    viewStateAtom,
    layersAtom,
    isLoadingAtom,
    errorAtom,
    configAtom,
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
