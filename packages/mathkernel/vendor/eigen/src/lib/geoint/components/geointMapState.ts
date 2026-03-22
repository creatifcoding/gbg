import type { MapViewState } from '@deck.gl/core'
import { Atom } from '@effect-atom/atom'
import type { Track, ThreatVolume } from '../schemas'
import type { FlyToTarget as ControllerFlyToTarget } from '../map/schemas'

/**
 * Layer visibility model used by GeointMap rendering.
 */
export interface GeointLayerVisibility {
  paths: boolean
  positions: boolean
  headings: boolean
  heatmap: boolean
  trips: boolean
  labels: boolean
  /** Enable Kori ECS positioned entities layer */
  positionedEntities: boolean
}

export const DEFAULT_VIEW_STATE: MapViewState = {
  longitude: -122.42,
  latitude: 37.78,
  zoom: 12,
  pitch: 0,
  bearing: 0,
}

export const DEFAULT_VISIBILITY: GeointLayerVisibility = {
  paths: true,
  positions: true,
  headings: false,
  heatmap: false,
  trips: false,
  labels: true,
  positionedEntities: true,
}

const viewStateFamily = Atom.family((_id: string) =>
  Atom.make<MapViewState>(DEFAULT_VIEW_STATE)
)
const tracksFamily = Atom.family((_id: string) =>
  Atom.make<readonly Track[]>([])
)
const threatsFamily = Atom.family((_id: string) =>
  Atom.make<readonly ThreatVolume[]>([])
)
const visibilityFamily = Atom.family((_id: string) =>
  Atom.make<GeointLayerVisibility>(DEFAULT_VISIBILITY)
)
const selectedTrackFamily = Atom.family((_id: string) =>
  Atom.make<Track | null>(null)
)
const dimensionsFamily = Atom.family((_id: string) =>
  Atom.make<{ width: number; height: number } | null>(null)
)
const mapLoadedFamily = Atom.family((_id: string) => Atom.make<boolean>(false))
const errorFamily = Atom.family((_id: string) => Atom.make<string | null>(null))
const flyToTargetFamilyLocal = Atom.family((_id: string) =>
  Atom.make<ControllerFlyToTarget | null>(null)
)
const isAnimatingFamilyLocal = Atom.family((_id: string) =>
  Atom.make<boolean>(false)
)

export function createGeointInstanceAtoms(instanceId: string) {
  return {
    viewStateAtom: viewStateFamily(instanceId),
    tracksAtom: tracksFamily(instanceId),
    threatsAtom: threatsFamily(instanceId),
    visibilityAtom: visibilityFamily(instanceId),
    selectedTrackAtom: selectedTrackFamily(instanceId),
    dimensionsAtom: dimensionsFamily(instanceId),
    mapLoadedAtom: mapLoadedFamily(instanceId),
    errorAtom: errorFamily(instanceId),
    flyToTargetAtom: flyToTargetFamilyLocal(instanceId),
    isAnimatingAtom: isAnimatingFamilyLocal(instanceId),
  }
}

export function disposeGeointInstanceAtoms(_instanceId: string): void {
  // Atom.family uses WeakRef, atoms are GC'd when no subscribers
}
