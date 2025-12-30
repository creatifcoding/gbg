/**
 * Scene3DBlockView Component
 *
 * React node view for Scene3DBlock in TipTap editor.
 * Uses EmbeddedBlockWrapper for foldable, badged UI.
 * Embeds react-three-fiber Canvas with kori-style entities.
 *
 * @module editor/v3/extensions/blocks/Scene3DBlock/Scene3DBlockView
 */

import { useRef, useCallback, useMemo, useEffect, Suspense } from 'react';
import { type NodeViewProps } from '@tiptap/react';
import { useAtom, useAtomValue } from '@effect-atom/atom-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Box, Sphere, Torus } from '@react-three/drei';
import * as THREE from 'three';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Box as BoxIcon,
  Settings2,
  Layers,
  Timer,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { VANTA_COLORS, VANTA_BORDERS, VANTA_SPACING } from '@/components/portal/tokens';
import { StreamBinding } from '@/lib/connection-ports';
import { EmbeddedBlockWrapper, type SettingsTab, type BlockBadge, type DataplaneConfig } from '../EmbeddedBlockWrapper';
import {
  createScene3DBlockAtoms,
  getScene3DBlockAtoms,
  disposeScene3DBlockAtoms,
  createDemoEntities,
  DEFAULT_CAMERA,
  DEFAULT_SCENE_CONFIG,
  type EntityData,
  type Scene3DBlockAtoms,
} from './atoms';
import { useScene3DStreamBinding } from './useStreamBinding';

// =============================================================================
// Badge Config
// =============================================================================

const SCENE3D_BADGE: BlockBadge = {
  tag: '3d',
  label: '3D Scene',
  icon: BoxIcon,
};

const SCENE3D_DATAPLANE_CONFIG: DataplaneConfig = {
  enabled: true,
  ports: [
    { direction: 'in', dataType: 'json', position: 'left', label: 'Entities In' },
    { direction: 'out', dataType: 'json', position: 'right', label: 'Entities Out' },
  ],
  showIndicators: true,
};

// =============================================================================
// Entity Component
// =============================================================================

interface EntityMeshProps {
  entity: EntityData;
  isPlaying: boolean;
  timeScale: number;
}

function EntityMesh({ entity, isPlaying, timeScale }: EntityMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current || !isPlaying) return;

    const scaledDelta = delta * timeScale;

    meshRef.current.position.x += entity.velocity[0] * scaledDelta * 60;
    meshRef.current.position.y += entity.velocity[1] * scaledDelta * 60;
    meshRef.current.position.z += entity.velocity[2] * scaledDelta * 60;

    meshRef.current.rotation.x += 0.5 * scaledDelta;
    meshRef.current.rotation.y += 0.3 * scaledDelta;
  });

  const material = (
    <meshStandardMaterial
      color={entity.color}
      emissive={entity.color}
      emissiveIntensity={0.2}
      roughness={0.3}
      metalness={0.7}
    />
  );

  switch (entity.type) {
    case 'box':
      return (
        <Box ref={meshRef} args={[entity.scale, entity.scale, entity.scale]} position={entity.position}>
          {material}
        </Box>
      );
    case 'torus':
      return (
        <Torus ref={meshRef} args={[entity.scale * 0.6, entity.scale * 0.25, 16, 32]} position={entity.position}>
          {material}
        </Torus>
      );
    case 'sphere':
    default:
      return (
        <Sphere ref={meshRef} args={[entity.scale, 32, 32]} position={entity.position}>
          {material}
        </Sphere>
      );
  }
}

// =============================================================================
// Scene Content
// =============================================================================

interface SceneContentProps {
  atoms: Scene3DBlockAtoms;
  showGrid: boolean;
  showAxes: boolean;
}

function SceneContent({ atoms, showGrid, showAxes }: SceneContentProps) {
  const entities = useAtomValue(atoms.entitiesAtom);
  const isPlaying = useAtomValue(atoms.isPlayingAtom);
  const timeScale = useAtomValue(atoms.timeScaleAtom);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#9333ea" />
      <pointLight position={[10, -10, 5]} intensity={0.3} color="#22d3ee" />

      {showGrid && (
        <Grid
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#1a1a2e"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#2a2a4e"
          fadeDistance={30}
          fadeStrength={1}
          followCamera={false}
          position={[0, -0.01, 0]}
        />
      )}

      {showAxes && (
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#ec4899', '#34d399', '#22d3ee']} labelColor="white" />
        </GizmoHelper>
      )}

      {entities.map((entity) => (
        <EntityMesh key={entity.id} entity={entity} isPlaying={isPlaying} timeScale={timeScale} />
      ))}
    </>
  );
}

// =============================================================================
// Settings Components
// =============================================================================

interface PlaybackSettingsProps {
  isPlaying: boolean;
  timeScale: number;
  onTogglePlay: () => void;
  onTimeScaleChange: (scale: number) => void;
  onReset: () => void;
}

function PlaybackSettings({ isPlaying, timeScale, onTogglePlay, onTimeScaleChange, onReset }: PlaybackSettingsProps) {
  const buttonStyle = {
    padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
    background: 'transparent',
    border: `1px solid ${VANTA_COLORS.surface.border}`,
    color: VANTA_COLORS.text.secondary,
    borderRadius: VANTA_BORDERS.radius.sm,
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'var(--tmnl-font-mono)',
    display: 'flex',
    alignItems: 'center',
    gap: VANTA_SPACING['1'],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['3'] }}>
      <div style={{ display: 'flex', gap: VANTA_SPACING['2'] }}>
        <button
          onClick={onTogglePlay}
          style={{
            ...buttonStyle,
            borderColor: isPlaying ? VANTA_COLORS.accent.cyanMuted : VANTA_COLORS.surface.border,
            color: isPlaying ? VANTA_COLORS.accent.cyan : VANTA_COLORS.text.secondary,
          }}
        >
          {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={onReset} style={buttonStyle}>
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['1'] }}>
        <label style={{ color: VANTA_COLORS.text.muted, fontSize: '12px' }}>Time Scale: {timeScale}x</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: VANTA_SPACING['2'] }}>
          <button
            onClick={() => onTimeScaleChange(Math.max(0.25, timeScale - 0.25))}
            style={{ ...buttonStyle, padding: VANTA_SPACING['1'] }}
            disabled={timeScale <= 0.25}
          >
            <Minus size={12} />
          </button>
          <input
            type="range"
            min="0.25"
            max="4"
            step="0.25"
            value={timeScale}
            onChange={(e) => onTimeScaleChange(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <button
            onClick={() => onTimeScaleChange(Math.min(4, timeScale + 0.25))}
            style={{ ...buttonStyle, padding: VANTA_SPACING['1'] }}
            disabled={timeScale >= 4}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface EntitiesSettingsProps {
  entityCount: number;
  streamEntityCount: number;
  onAddEntity: () => void;
  onClearEntities: () => void;
}

function EntitiesSettings({ entityCount, streamEntityCount, onAddEntity, onClearEntities }: EntitiesSettingsProps) {
  const buttonStyle = {
    padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
    background: 'transparent',
    border: `1px solid ${VANTA_COLORS.surface.border}`,
    color: VANTA_COLORS.text.secondary,
    borderRadius: VANTA_BORDERS.radius.sm,
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'var(--tmnl-font-mono)',
    display: 'flex',
    alignItems: 'center',
    gap: VANTA_SPACING['1'],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['3'] }}>
      <div style={{ color: VANTA_COLORS.text.muted, fontSize: '12px' }}>
        {entityCount} entities in scene
        {streamEntityCount > 0 && (
          <span style={{ color: VANTA_COLORS.accent.cyan, marginLeft: VANTA_SPACING['2'] }}>
            ({streamEntityCount} from stream)
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: VANTA_SPACING['2'] }}>
        <button onClick={onAddEntity} style={buttonStyle}>
          <Plus size={12} /> Add Entity
        </button>
        <button onClick={onClearEntities} style={buttonStyle}>
          <RotateCcw size={12} /> Clear All
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Stream Settings
// =============================================================================

interface StreamSettingsProps {
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  streamId: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

function StreamSettings({
  isConnected,
  isLoading,
  error,
  streamId,
  onConnect,
  onDisconnect,
}: StreamSettingsProps) {
  const buttonStyle = {
    padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
    background: 'transparent',
    border: `1px solid ${VANTA_COLORS.surface.border}`,
    color: VANTA_COLORS.text.secondary,
    borderRadius: VANTA_BORDERS.radius.sm,
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'var(--tmnl-font-mono)',
    display: 'flex',
    alignItems: 'center',
    gap: VANTA_SPACING['1'],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['3'] }}>
      {/* Status Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: VANTA_SPACING['2'] }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected
              ? VANTA_COLORS.accent.cyan
              : error
                ? VANTA_COLORS.accent.magenta
                : VANTA_COLORS.text.muted,
            boxShadow: isConnected ? `0 0 8px ${VANTA_COLORS.accent.cyanMuted}` : 'none',
          }}
        />
        <span style={{ color: VANTA_COLORS.text.secondary, fontSize: '12px' }}>
          {isLoading ? 'Connecting...' : isConnected ? 'Connected' : error ? 'Error' : 'Disconnected'}
        </span>
      </div>

      {/* Stream ID */}
      {streamId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['1'] }}>
          <label style={{ color: VANTA_COLORS.text.muted, fontSize: '12px' }}>Stream ID</label>
          <code
            style={{
              fontSize: '11px',
              fontFamily: 'var(--tmnl-font-mono)',
              color: VANTA_COLORS.text.secondary,
              background: VANTA_COLORS.surface.void,
              padding: VANTA_SPACING['2'],
              borderRadius: VANTA_BORDERS.radius.sm,
              wordBreak: 'break-all',
            }}
          >
            {streamId}
          </code>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            fontSize: '12px',
            color: VANTA_COLORS.accent.magenta,
            background: `${VANTA_COLORS.accent.magenta}10`,
            padding: VANTA_SPACING['2'],
            borderRadius: VANTA_BORDERS.radius.sm,
          }}
        >
          {error.message}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: VANTA_SPACING['2'] }}>
        {isConnected ? (
          <button
            onClick={onDisconnect}
            style={{
              ...buttonStyle,
              borderColor: VANTA_COLORS.accent.magenta,
              color: VANTA_COLORS.accent.magenta,
            }}
          >
            <WifiOff size={12} /> Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={isLoading || !streamId}
            style={{
              ...buttonStyle,
              borderColor: streamId ? VANTA_COLORS.accent.cyan : VANTA_COLORS.surface.border,
              color: streamId ? VANTA_COLORS.accent.cyan : VANTA_COLORS.text.muted,
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            <Wifi size={12} /> {isLoading ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>

      {/* No binding hint */}
      {!streamId && (
        <div style={{ color: VANTA_COLORS.text.muted, fontSize: '12px', fontStyle: 'italic' }}>
          No stream binding configured. Add a streamBinding or streamViewId attribute to enable.
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Canvas Container
// =============================================================================

interface Scene3DContentProps {
  atoms: Scene3DBlockAtoms;
  config: typeof DEFAULT_SCENE_CONFIG;
  isPlaying: boolean;
  isLoading: boolean;
}

function Scene3DContent({ atoms, config, isPlaying, isLoading }: Scene3DContentProps) {
  return (
    <div
      style={{
        height: '100%',
        position: 'relative',
        background: config.background,
      }}
    >
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: VANTA_COLORS.surface.void,
            zIndex: 10,
          }}
        >
          <span
            style={{
              color: VANTA_COLORS.text.muted,
              fontFamily: 'var(--tmnl-font-mono)',
              fontSize: '12px',
            }}
          >
            Loading scene...
          </span>
        </div>
      )}

      <Canvas
        frameloop={isPlaying ? 'always' : 'demand'}
        camera={{
          position: DEFAULT_CAMERA.position,
          fov: DEFAULT_CAMERA.fov,
          near: DEFAULT_CAMERA.near,
          far: DEFAULT_CAMERA.far,
        }}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <SceneContent atoms={atoms} showGrid={config.showGrid} showAxes={config.showAxes} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.05} minDistance={2} maxDistance={20} />
        </Suspense>
      </Canvas>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function Scene3DBlockView(nodeViewProps: NodeViewProps) {
  const { node, updateAttributes, editor } = nodeViewProps;
  const blockId = node.attrs.id || 'default';

  // Parse stream binding from node attrs if present
  const streamBinding = useMemo(() => {
    if (node.attrs.streamBinding) {
      const binding = node.attrs.streamBinding;
      return {
        streamId: binding.streamId,
        replay: binding.replay ?? true,
        fromOffset: binding.fromOffset,
        autoSubscribe: binding.autoSubscribe ?? true,
      };
    }
    if (node.attrs.streamViewId) {
      return {
        streamId: `tmnl.ava.artifacts.${node.attrs.streamViewId}`,
        replay: true,
        autoSubscribe: true,
      };
    }
    return null;
  }, [node.attrs.streamBinding, node.attrs.streamViewId]);

  // Create atoms with stream config if binding exists
  const atoms = useMemo(() => {
    if (streamBinding) {
      return createScene3DBlockAtoms(blockId, {
        binding: new StreamBinding(streamBinding),
      });
    }
    return getScene3DBlockAtoms(blockId);
  }, [blockId, streamBinding]);

  const [isPlaying, setIsPlaying] = useAtom(atoms.isPlayingAtom);
  const [entities, setEntities] = useAtom(atoms.entitiesAtom);
  const [timeScale, setTimeScale] = useAtom(atoms.timeScaleAtom);
  const [isLoading, setIsLoading] = useAtom(atoms.isLoadingAtom);

  // Stream binding hook (only active when streamBinding is configured)
  const stream = useScene3DStreamBinding({ atoms });
  const streamEntities = useAtomValue(atoms.entitiesAtom);

  const config = node.attrs.config || DEFAULT_SCENE_CONFIG;
  const entityCount = useAtomValue(atoms.entityCountAtom);

  // Initialize entities
  useEffect(() => {
    if (node.attrs.entities && node.attrs.entities.length > 0) {
      setEntities(node.attrs.entities);
    } else {
      const demoEntities = createDemoEntities();
      setEntities(demoEntities);
      updateAttributes({ entities: demoEntities });
    }
    setIsLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => disposeScene3DBlockAtoms(blockId);
  }, [blockId]);

  // Handlers
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, [setIsPlaying]);

  const handleTimeScaleChange = useCallback(
    (scale: number) => {
      setTimeScale(scale);
    },
    [setTimeScale]
  );

  const resetScene = useCallback(() => {
    const demoEntities = createDemoEntities();
    setEntities(demoEntities);
    setIsPlaying(false);
    updateAttributes({ entities: demoEntities });
  }, [setEntities, setIsPlaying, updateAttributes]);

  const addEntity = useCallback(() => {
    const types: EntityData['type'][] = ['sphere', 'box', 'torus'];
    const colors = ['#22d3ee', '#9333ea', '#ec4899', '#fbbf24', '#34d399'];

    const newEntity: EntityData = {
      id: `entity-${Date.now()}`,
      position: [(Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 4],
      velocity: [(Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02],
      color: colors[Math.floor(Math.random() * colors.length)],
      scale: 0.2 + Math.random() * 0.3,
      type: types[Math.floor(Math.random() * types.length)],
    };

    const newEntities = [...entities, newEntity];
    setEntities(newEntities);
    updateAttributes({ entities: newEntities });
  }, [setEntities, entities, updateAttributes]);

  const clearEntities = useCallback(() => {
    setEntities([]);
    updateAttributes({ entities: [] });
  }, [setEntities, updateAttributes]);

  // Compute stream entity count
  const streamEntityCount = stream.isConnected ? streamEntities.length : 0;

  // Settings tabs
  const tabs: SettingsTab[] = useMemo(
    () => [
      {
        id: 'playback',
        label: 'Playback',
        icon: Timer,
        content: (
          <PlaybackSettings
            isPlaying={isPlaying}
            timeScale={timeScale}
            onTogglePlay={togglePlay}
            onTimeScaleChange={handleTimeScaleChange}
            onReset={resetScene}
          />
        ),
      },
      {
        id: 'entities',
        label: 'Entities',
        icon: Layers,
        content: (
          <EntitiesSettings
            entityCount={entityCount}
            streamEntityCount={streamEntityCount}
            onAddEntity={addEntity}
            onClearEntities={clearEntities}
          />
        ),
      },
      {
        id: 'stream',
        label: 'Stream',
        icon: Radio,
        content: (
          <StreamSettings
            isConnected={stream.isConnected}
            isLoading={stream.isLoading}
            error={stream.error}
            streamId={streamBinding?.streamId ?? null}
            onConnect={stream.subscribe}
            onDisconnect={stream.unsubscribe}
          />
        ),
      },
    ],
    [
      isPlaying,
      timeScale,
      entityCount,
      streamEntityCount,
      togglePlay,
      handleTimeScaleChange,
      resetScene,
      addEntity,
      clearEntities,
      stream.isConnected,
      stream.isLoading,
      stream.error,
      stream.subscribe,
      stream.unsubscribe,
      streamBinding,
    ]
  );

  return (
    <EmbeddedBlockWrapper
      nodeViewProps={nodeViewProps}
      badge={SCENE3D_BADGE}
      tabs={tabs}
      expandedHeight={450}
      collapsedHeight={120}
      dataplaneConfig={SCENE3D_DATAPLANE_CONFIG}
    >
      <Scene3DContent atoms={atoms} config={config} isPlaying={isPlaying} isLoading={isLoading} />
    </EmbeddedBlockWrapper>
  );
}

export default Scene3DBlockView;
