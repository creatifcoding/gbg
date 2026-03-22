/**
 * Scene3DBlock Atoms
 *
 * Atoms-as-state for react-three-fiber + kori ECS block.
 * Manages camera state, entity registry, and simulation control.
 *
 * Supports ConnectionPorts integration for streaming entity updates
 * from AVA via NATS/Durable Streams.
 *
 * @module editor/v3/extensions/blocks/Scene3DBlock/atoms
 */

import { Atom, Result } from '@effect-atom/atom-react';
import type { Vector3Tuple } from 'three';
import type { StreamBinding, ViewArtifact } from '@/lib/connection-ports';

// =============================================================================
// Types
// =============================================================================

export interface CameraState {
  /** Camera position */
  position: Vector3Tuple;
  /** Camera look-at target */
  target: Vector3Tuple;
  /** Field of view (degrees) */
  fov: number;
  /** Near clipping plane */
  near: number;
  /** Far clipping plane */
  far: number;
}

export interface EntityData {
  /** Entity ID from kori */
  id: string;
  /** 3D position */
  position: Vector3Tuple;
  /** 3D velocity */
  velocity: Vector3Tuple;
  /** Entity color */
  color: string;
  /** Entity scale */
  scale: number;
  /** Entity type */
  type: 'sphere' | 'box' | 'torus';
}

export interface Scene3DBlockState {
  /** Camera configuration */
  camera: CameraState;
  /** Entities in the scene */
  entities: EntityData[];
  /** Whether simulation is running */
  isPlaying: boolean;
  /** Simulation speed multiplier */
  timeScale: number;
  /** Whether scene is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

export interface SceneConfig {
  /** Background color */
  background: string;
  /** Ambient light intensity */
  ambientIntensity: number;
  /** Grid visible */
  showGrid: boolean;
  /** Axes helper visible */
  showAxes: boolean;
}

// =============================================================================
// Stream Binding Types
// =============================================================================

/**
 * Stream source configuration for Scene3D entities.
 * When provided, entities are sourced from AVA streams instead of local state.
 */
export interface Scene3DStreamConfig {
  /** Stream binding configuration */
  binding: StreamBinding;

  /** Transform artifact payload to entities */
  payloadToEntities?: (payload: unknown) => EntityData[];
}

/**
 * Default payload transformer.
 * Expects artifact.payload to be { entities: EntityData[] }
 */
export function defaultPayloadToEntities(payload: unknown): EntityData[] {
  if (
    payload &&
    typeof payload === 'object' &&
    'entities' in payload &&
    Array.isArray((payload as { entities: unknown }).entities)
  ) {
    return (payload as { entities: EntityData[] }).entities;
  }
  return [];
}

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULT_CAMERA: CameraState = {
  position: [5, 5, 5],
  target: [0, 0, 0],
  fov: 50,
  near: 0.1,
  far: 1000,
};

export const DEFAULT_SCENE_CONFIG: SceneConfig = {
  background: '#0a0a0f',
  ambientIntensity: 0.4,
  showGrid: true,
  showAxes: true,
};

// Generate some demo entities
export function createDemoEntities(): EntityData[] {
  const entities: EntityData[] = [];
  const colors = ['#22d3ee', '#9333ea', '#ec4899', '#fbbf24', '#34d399'];
  const types: EntityData['type'][] = ['sphere', 'box', 'torus'];

  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const radius = 2 + Math.random() * 2;

    entities.push({
      id: `entity-${i}`,
      position: [
        Math.cos(angle) * radius,
        Math.random() * 2 - 1,
        Math.sin(angle) * radius,
      ],
      velocity: [
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
      ],
      color: colors[i % colors.length],
      scale: 0.2 + Math.random() * 0.3,
      type: types[i % types.length],
    });
  }

  return entities;
}

// =============================================================================
// Atoms
// =============================================================================

/**
 * Create scene block atoms for a specific block instance.
 * Using per-block state isolation pattern.
 *
 * @param blockId - Unique block identifier
 * @param streamConfig - Optional stream configuration for AVA integration
 */
export function createScene3DBlockAtoms(
  blockId: string,
  streamConfig?: Scene3DStreamConfig
) {
  const cameraAtom = Atom.make<CameraState>(DEFAULT_CAMERA);
  const entitiesAtom = Atom.make<EntityData[]>([]);
  const isPlayingAtom = Atom.make(false);
  const timeScaleAtom = Atom.make(1);
  const isLoadingAtom = Atom.make(true);
  const errorAtom = Atom.make<string | null>(null);
  const configAtom = Atom.make<SceneConfig>(DEFAULT_SCENE_CONFIG);

  // Stream state (when using ConnectionPorts)
  const streamBindingAtom = Atom.make<StreamBinding | null>(
    streamConfig?.binding ?? null
  );
  const streamResultAtom = Atom.make<Result.Result<ViewArtifact, Error>>(
    Result.initial(false)
  );

  // Derived: entity count
  const entityCountAtom = Atom.make((get) => get(entitiesAtom).length);

  // Derived: complete state snapshot
  const stateAtom = Atom.make((get) => ({
    camera: get(cameraAtom),
    entities: get(entitiesAtom),
    isPlaying: get(isPlayingAtom),
    timeScale: get(timeScaleAtom),
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
      // Extract error message from cause
      return 'Stream error occurred';
    }
    return null;
  });

  return {
    blockId,
    streamConfig,
    // Camera & scene
    cameraAtom,
    configAtom,
    // Entity state
    entitiesAtom,
    entityCountAtom,
    // Simulation controls
    isPlayingAtom,
    timeScaleAtom,
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

export type Scene3DBlockAtoms = ReturnType<typeof createScene3DBlockAtoms>;

// =============================================================================
// Atom Registry (per-block instances)
// =============================================================================

const atomRegistry = new Map<string, Scene3DBlockAtoms>();

export function getScene3DBlockAtoms(blockId: string): Scene3DBlockAtoms {
  let atoms = atomRegistry.get(blockId);
  if (!atoms) {
    atoms = createScene3DBlockAtoms(blockId);
    atomRegistry.set(blockId, atoms);
  }
  return atoms;
}

export function disposeScene3DBlockAtoms(blockId: string): void {
  atomRegistry.delete(blockId);
}
