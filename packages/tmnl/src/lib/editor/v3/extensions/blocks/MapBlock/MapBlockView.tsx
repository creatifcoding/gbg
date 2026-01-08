/**
 * MapBlockView Component
 *
 * React node view for MapBlock in TipTap editor.
 * Uses EmbeddedBlockWrapper for foldable, badged UI.
 * Embeds Mapbox + deck.gl with controlled viewState.
 *
 * @module editor/v3/extensions/blocks/MapBlock/MapBlockView
 */

import {
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useState,
  type ReactNode,
  type MouseEvent,
} from 'react';
import { type NodeViewProps } from '@tiptap/react';
import { useAtom, useAtomValue } from '@effect-atom/atom-react';
import { Map } from 'react-map-gl/mapbox';
import { DeckGL } from '@deck.gl/react';
import type { MapViewState, PickingInfo } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import {
  MapPin,
  Palette,
  Layers,
  Trash2,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';

import {
  VANTA_COLORS,
  VANTA_BORDERS,
  VANTA_SPACING,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';
import { StreamBinding } from '@/lib/connection-ports';
import {
  EmbeddedBlockWrapper,
  type SettingsTab,
  type BlockBadge,
  type DataplaneConfig,
} from '../EmbeddedBlockWrapper';
import {
  createMapBlockAtoms,
  getMapBlockAtoms,
  disposeMapBlockAtoms,
  DEFAULT_VIEW_STATE,
  DEFAULT_MAP_STYLE,
  type MarkerData,
} from './atoms';
import { useMapStreamBinding } from './useStreamBinding';
import { AvaMapContent, tryDecodeViewId } from './AvaMapContent';

// =============================================================================
// Mapbox Token
// =============================================================================

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

// =============================================================================
// Badge Config
// =============================================================================

const MAP_BADGE: BlockBadge = {
  tag: 'map',
  label: 'Map',
  icon: MapPin,
};

const MAP_DATAPLANE_CONFIG: DataplaneConfig = {
  enabled: true,
  ports: [
    { direction: 'in', dataType: 'json', position: 'left', label: 'GeoJSON In' },
    { direction: 'out', dataType: 'json', position: 'right', label: 'GeoJSON Out' },
  ],
  showIndicators: true,
};

interface ActionButtonProps {
  onClick: () => void;
  children: ReactNode;
  variant?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
}

function ActionButton({
  onClick,
  children,
  variant = 'default',
  disabled = false,
}: ActionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = (e: MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsPressed(true);
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (isPressed) {
      onClick();
    }
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPressed(false);
  };

  const colors = {
    default: {
      text: VANTA_COLORS.text.secondary,
      textHover: VANTA_COLORS.text.primary,
      textPressed: VANTA_COLORS.accent.cyan,
      border: VANTA_COLORS.surface.border,
      borderHover: VANTA_COLORS.text.muted,
      borderPressed: VANTA_COLORS.accent.cyan,
      bgPressed: VANTA_COLORS.accent.cyanGlow,
    },
    danger: {
      text: VANTA_COLORS.text.secondary,
      textHover: VANTA_COLORS.accent.rose,
      textPressed: VANTA_COLORS.accent.rose,
      border: VANTA_COLORS.surface.border,
      borderHover: VANTA_COLORS.accent.roseMuted,
      borderPressed: VANTA_COLORS.accent.rose,
      bgPressed: VANTA_COLORS.accent.roseGlow,
    },
    primary: {
      text: VANTA_COLORS.accent.cyan,
      textHover: VANTA_COLORS.accent.cyan,
      textPressed: VANTA_COLORS.text.primary,
      border: VANTA_COLORS.accent.cyanMuted,
      borderHover: VANTA_COLORS.accent.cyan,
      borderPressed: VANTA_COLORS.accent.cyan,
      bgPressed: VANTA_COLORS.accent.cyanGlow,
    },
  };

  const c = colors[variant];

  let currentColor: string = c.text;
  let currentBorder: string = c.border;
  let currentBg: string = 'transparent';
  let currentTransform = 'scale(1)';
  let currentBoxShadow = 'none';

  if (disabled) {
    currentColor = VANTA_COLORS.text.muted;
    currentBorder = VANTA_COLORS.surface.border;
  } else if (isPressed) {
    currentColor = c.textPressed;
    currentBorder = c.borderPressed;
    currentBg = c.bgPressed;
    currentTransform = 'scale(0.96)';
    currentBoxShadow = `0 0 0 2px ${c.borderPressed}`;
  } else if (isHovered) {
    currentColor = c.textHover;
    currentBorder = c.borderHover;
    currentBoxShadow = `0 0 0 1px ${c.borderHover}`;
  }

  return (
    <button
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      disabled={disabled}
      style={{
        padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
        background: currentBg,
        border: `1px solid ${currentBorder}`,
        color: currentColor,
        borderRadius: VANTA_BORDERS.radius.sm,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '12px',
        fontFamily: 'var(--tmnl-font-mono)',
        display: 'flex',
        alignItems: 'center',
        gap: VANTA_SPACING['1'],
        transition: `all ${VANTA_ANIMATION.duration.fast} ${VANTA_ANIMATION.easing.default}`,
        transform: currentTransform,
        boxShadow: currentBoxShadow,
        outline: 'none',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

// =============================================================================
// Settings Components
// =============================================================================

interface StyleSettingsProps {
  mapStyle: string;
  onStyleChange: (style: string) => void;
}

function StyleSettings({ mapStyle, onStyleChange }: StyleSettingsProps) {
  const styles = [
    { id: 'mapbox://styles/mapbox/dark-v11', label: 'Dark' },
    { id: 'mapbox://styles/mapbox/light-v11', label: 'Light' },
    { id: 'mapbox://styles/mapbox/satellite-v9', label: 'Satellite' },
    { id: 'mapbox://styles/mapbox/streets-v12', label: 'Streets' },
    { id: 'mapbox://styles/mapbox/outdoors-v12', label: 'Outdoors' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: VANTA_SPACING['2'],
      }}
    >
      <label style={{ color: VANTA_COLORS.text.muted, fontSize: '12px' }}>
        Map Style
      </label>
      <div
        style={{ display: 'flex', gap: VANTA_SPACING['1'], flexWrap: 'wrap' }}
      >
        {styles.map((style) => (
          <button
            key={style.id}
            onClick={() => onStyleChange(style.id)}
            style={{
              padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
              background:
                mapStyle === style.id
                  ? VANTA_COLORS.accent.cyanGlow
                  : 'transparent',
              border: `1px solid ${
                mapStyle === style.id
                  ? VANTA_COLORS.accent.cyanMuted
                  : VANTA_COLORS.surface.border
              }`,
              color:
                mapStyle === style.id
                  ? VANTA_COLORS.accent.cyan
                  : VANTA_COLORS.text.secondary,
              borderRadius: VANTA_BORDERS.radius.sm,
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--tmnl-font-mono)',
            }}
          >
            {style.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface MarkersSettingsProps {
  markerCount: number;
  streamMarkerCount: number;
  onResetView: () => void;
  onClearMarkers: () => void;
}

function MarkersSettings({
  markerCount,
  streamMarkerCount,
  onResetView,
  onClearMarkers,
}: MarkersSettingsProps) {
  const totalMarkers = streamMarkerCount > 0 ? streamMarkerCount : markerCount;
  const source = streamMarkerCount > 0 ? 'stream' : 'local';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: VANTA_SPACING['3'],
      }}
    >
      <div style={{ color: VANTA_COLORS.text.muted, fontSize: '12px' }}>
        {totalMarkers} marker{totalMarkers !== 1 ? 's' : ''} ({source})
        {streamMarkerCount === 0 && ' • Click map to add'}
      </div>
      <div style={{ display: 'flex', gap: VANTA_SPACING['2'] }}>
        <ActionButton onClick={onResetView} variant="default">
          <MapPin size={12} /> Reset View
        </ActionButton>
        {streamMarkerCount === 0 && (
          <ActionButton onClick={onClearMarkers} variant="danger">
            <Trash2 size={12} /> Clear Markers
          </ActionButton>
        )}
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
  error: string | null;
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

  if (!streamId) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: VANTA_SPACING['2'],
        }}
      >
        <div style={{ color: VANTA_COLORS.text.muted, fontSize: '12px' }}>
          No stream configured
        </div>
        <div
          style={{
            color: VANTA_COLORS.text.muted,
            fontSize: '11px',
            opacity: 0.7,
          }}
        >
          Add{' '}
          <code
            style={{
              background: VANTA_COLORS.surface.elevated,
              padding: '2px 4px',
              borderRadius: '2px',
            }}
          >
            streamViewId
          </code>{' '}
          or{' '}
          <code
            style={{
              background: VANTA_COLORS.surface.elevated,
              padding: '2px 4px',
              borderRadius: '2px',
            }}
          >
            streamBinding
          </code>{' '}
          to node attrs
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: VANTA_SPACING['3'],
      }}
    >
      {/* Status indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['2'],
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isConnected
              ? VANTA_COLORS.accent.emerald
              : error
              ? VANTA_COLORS.accent.rose
              : isLoading
              ? VANTA_COLORS.accent.amber
              : VANTA_COLORS.text.muted,
            boxShadow: isConnected
              ? `0 0 6px ${VANTA_COLORS.accent.emeraldGlow}`
              : error
              ? `0 0 6px ${VANTA_COLORS.accent.roseGlow}`
              : 'none',
          }}
        />
        <span style={{ color: VANTA_COLORS.text.secondary, fontSize: '12px' }}>
          {isConnected
            ? 'Connected'
            : error
            ? 'Error'
            : isLoading
            ? 'Connecting...'
            : 'Disconnected'}
        </span>
      </div>

      {/* Stream ID */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: VANTA_SPACING['1'],
        }}
      >
        <label style={{ color: VANTA_COLORS.text.muted, fontSize: '11px' }}>
          Stream
        </label>
        <code
          style={{
            fontSize: '11px',
            fontFamily: 'var(--tmnl-font-mono)',
            color: VANTA_COLORS.text.secondary,
            background: VANTA_COLORS.surface.elevated,
            padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
            borderRadius: VANTA_BORDERS.radius.sm,
            wordBreak: 'break-all',
          }}
        >
          {streamId}
        </code>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            color: VANTA_COLORS.accent.rose,
            fontSize: '11px',
            padding: VANTA_SPACING['2'],
            background: VANTA_COLORS.accent.roseGlow,
            borderRadius: VANTA_BORDERS.radius.sm,
          }}
        >
          {error}
        </div>
      )}

      {/* Connect/Disconnect buttons */}
      <div style={{ display: 'flex', gap: VANTA_SPACING['2'] }}>
        {isConnected ? (
          <button
            onClick={onDisconnect}
            style={{
              ...buttonStyle,
              borderColor: VANTA_COLORS.accent.roseMuted,
              color: VANTA_COLORS.accent.rose,
            }}
          >
            <WifiOff size={12} /> Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={isLoading}
            style={{
              ...buttonStyle,
              borderColor: isLoading
                ? VANTA_COLORS.surface.border
                : VANTA_COLORS.accent.cyanMuted,
              color: isLoading
                ? VANTA_COLORS.text.muted
                : VANTA_COLORS.accent.cyan,
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <Wifi size={12} /> {isLoading ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Map Content Component
// =============================================================================

interface MapContentProps {
  viewState: MapViewState;
  onViewStateChange: (params: { viewState: MapViewState }) => void;
  layers: ScatterplotLayer[];
  onMapClick: (info: PickingInfo) => void;
  onLoad: () => void;
  mapStyle: string;
  isLoading: boolean;
}

function MapContent({
  viewState,
  onViewStateChange,
  layers,
  onMapClick,
  onLoad,
  mapStyle,
  isLoading,
}: MapContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [webGLError, setWebGLError] = useState<string | null>(null);

  // WORKAROUND: Measure container and pass explicit dimensions to DeckGL
  // luma.gl's ResizeObserver fires before WebGL device ready if we use percentage-based sizing
  // Use ResizeObserver to handle dynamic container size changes (e.g., focus mode)
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

    let rafId1: number;
    let rafId2: number;

    const measureAndInit = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth > 0 && clientHeight > 0) {
        setDimensions({ width: clientWidth, height: clientHeight });
      }
    };

    // Initial measure with double RAF to ensure layout is stable
    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(measureAndInit);
    });

    // ResizeObserver for dynamic size changes (focus mode, window resize, etc.)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.floor(width),
            height: Math.floor(height),
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(rafId1);
      cancelAnimationFrame(rafId2);
      resizeObserver.disconnect();
    };
  }, []);

  const handleWebGLError = useCallback((error: Error) => {
    console.error('[MapBlockView] WebGL error:', error);
    setWebGLError(error.message);
  }, []);

  const guardedViewStateChange = useCallback(
    (params: { viewState: MapViewState }) => {
      if (!dimensions) return;
      onViewStateChange(params);
    },
    [dimensions, onViewStateChange]
  );

  const guardedMapClick = useCallback(
    (info: PickingInfo) => {
      if (!dimensions) return;
      onMapClick(info);
    },
    [dimensions, onMapClick]
  );

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        position: 'relative',
        background: VANTA_COLORS.surface.void,
      }}
    >
      {/* Loading overlay */}
      {(isLoading || !dimensions) && !webGLError && (
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
            {dimensions ? 'Loading map...' : 'Initializing WebGL...'}
          </span>
        </div>
      )}

      {/* WebGL error overlay */}
      {webGLError && (
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
              color: VANTA_COLORS.accent.rose,
              fontFamily: 'var(--tmnl-font-mono)',
              fontSize: '12px',
              textAlign: 'center',
              padding: VANTA_SPACING['4'],
            }}
          >
            WebGL Error: {webGLError}
            <br />
            <span style={{ color: VANTA_COLORS.text.muted }}>
              Try refreshing the page.
            </span>
          </span>
        </div>
      )}

      {/* No token warning */}
      {!MAPBOX_TOKEN && (
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
              color: VANTA_COLORS.accent.rose,
              fontFamily: 'var(--tmnl-font-mono)',
              fontSize: '12px',
              textAlign: 'center',
              padding: VANTA_SPACING['4'],
            }}
          >
            VITE_MAPBOX_TOKEN not configured.
            <br />
            <span style={{ color: VANTA_COLORS.text.muted }}>
              Add to .env.local to enable maps.
            </span>
          </span>
        </div>
      )}

      {MAPBOX_TOKEN && dimensions && !webGLError && (
        <DeckGL
          viewState={viewState}
          onViewStateChange={guardedViewStateChange}
          controller={true}
          layers={layers}
          onClick={guardedMapClick}
          onError={handleWebGLError}
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
          }}
        >
          <Map
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={mapStyle}
            onLoad={onLoad}
            style={{ width: '100%', height: '100%' }}
            attributionControl={false}
            logoPosition="bottom-right"
          />
        </DeckGL>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function MapBlockView(nodeViewProps: NodeViewProps) {
  const { node, updateAttributes, editor } = nodeViewProps;
  const blockId = node.attrs.id || 'default';

  // Parse AVA v2 channel binding from node attrs
  const avaViewId = useMemo(
    () => tryDecodeViewId(node.attrs.avaViewId),
    [node.attrs.avaViewId]
  );
  const avaChannelId = node.attrs.avaChannelId || 'geojson';

  // Parse legacy stream binding from node attrs if present (used when no AVA config)
  const streamBinding = useMemo(() => {
    // Skip legacy binding if AVA is configured
    if (avaViewId) return null;

    if (node.attrs.streamBinding) {
      // Already a StreamBinding object or raw config
      const binding = node.attrs.streamBinding;
      return {
        streamId: binding.streamId,
        replay: binding.replay ?? true,
        fromOffset: binding.fromOffset,
        autoSubscribe: binding.autoSubscribe ?? true,
      };
    }
    // Check for stream view ID shorthand
    if (node.attrs.streamViewId) {
      return {
        streamId: `tmnl.ava.artifacts.${node.attrs.streamViewId}`,
        replay: true,
        autoSubscribe: true,
      };
    }
    return null;
  }, [node.attrs.streamBinding, node.attrs.streamViewId, avaViewId]);

  // Create atoms with stream config if binding exists
  const atoms = useMemo(() => {
    if (streamBinding) {
      return createMapBlockAtoms(blockId, {
        binding: new StreamBinding(streamBinding),
      });
    }
    return getMapBlockAtoms(blockId);
  }, [blockId, streamBinding]);

  const [viewState, setViewState] = useAtom(atoms.viewStateAtom);
  const [isLoading, setIsLoading] = useAtom(atoms.isLoadingAtom);

  // Stream binding hook (only active when streamBinding is configured)
  const stream = useMapStreamBinding({ atoms });
  const streamMarkers = useAtomValue(atoms.markersAtom);

  // Cleanup on unmount
  useEffect(() => {
    return () => disposeMapBlockAtoms(blockId);
  }, [blockId]);

  // Hide Mapbox watermark/logo via CSS injection
  useEffect(() => {
    const styleId = `mapblock-hide-logo-${blockId}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .mapboxgl-ctrl-logo { display: none !important; }
        .mapboxgl-ctrl-attrib { display: none !important; }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const style = document.getElementById(styleId);
      if (style) style.remove();
    };
  }, [blockId]);

  // Load saved viewState from node attrs
  useEffect(() => {
    if (node.attrs.viewState) {
      setViewState(node.attrs.viewState);
    }
  }, []);

  // Handle view state changes
  const handleViewStateChange = useCallback(
    (params: { viewState: MapViewState }) => {
      setViewState(params.viewState);
      updateAttributes({ viewState: params.viewState });
    },
    [setViewState, updateAttributes]
  );

  // Handle map load
  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  // Markers layer - merges stream markers with local markers
  const layers = useMemo(() => {
    // Priority: stream markers > node.attrs.markers > demo data
    const hasStreamMarkers = streamMarkers.length > 0;
    const hasLocalMarkers = node.attrs.markers && node.attrs.markers.length > 0;

    let markerData: Array<{
      position: [number, number];
      color: [number, number, number];
      id?: string;
    }>;

    if (hasStreamMarkers) {
      // Use stream markers (from AVA)
      markerData = streamMarkers.map((m: MarkerData) => ({
        id: m.id,
        position: m.position,
        color: m.color,
      }));
    } else if (hasLocalMarkers) {
      // Use local markers from node attrs
      markerData = node.attrs.markers;
    } else {
      // Demo data fallback
      markerData = [
        { position: [-122.4194, 37.7749], color: [34, 211, 238] },
        { position: [-122.4094, 37.7849], color: [147, 51, 234] },
        { position: [-122.4294, 37.7649], color: [236, 72, 153] },
      ];
    }

    return [
      new ScatterplotLayer({
        id: 'markers',
        data: markerData,
        getPosition: (d: { position: [number, number] }) => d.position,
        getFillColor: (d: { color: [number, number, number] }) => [
          ...d.color,
          200,
        ],
        getRadius: 100,
        radiusMinPixels: 8,
        radiusMaxPixels: 50,
        pickable: true,
        updateTriggers: {
          getPosition: markerData,
          getFillColor: markerData,
        },
      }),
    ];
  }, [streamMarkers, node.attrs.markers]);

  // Add marker at click location
  const handleMapClick = useCallback(
    (info: PickingInfo) => {
      if (!editor.isEditable || !info.coordinate) return;

      const newMarker = {
        position: info.coordinate as [number, number],
        color: [34, 211, 238] as [number, number, number],
      };

      const currentMarkers = node.attrs.markers || [];
      updateAttributes({ markers: [...currentMarkers, newMarker] });
    },
    [editor.isEditable, node.attrs.markers, updateAttributes]
  );

  // Settings handlers
  const handleStyleChange = useCallback(
    (style: string) => {
      updateAttributes({ mapStyle: style });
    },
    [updateAttributes]
  );

  const handleResetView = useCallback(() => {
    setViewState(DEFAULT_VIEW_STATE);
    updateAttributes({ viewState: DEFAULT_VIEW_STATE });
  }, [setViewState, updateAttributes]);

  const handleClearMarkers = useCallback(() => {
    updateAttributes({ markers: [] });
  }, [updateAttributes]);

  // Render map content - wrapped with AvaMapContent if AVA is configured
  const renderMapContent = (avaState?: {
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
    subscribe: () => void;
    unsubscribe: () => void;
    invalidate: (reason?: string) => void;
  }) => {
    // Determine stream status (AVA or legacy)
    const effectiveStream = avaState ?? stream;

    // Build tabs with effective stream status
    const effectiveTabs: SettingsTab[] = [
      {
        id: 'style',
        label: 'Style',
        icon: Palette,
        content: (
          <StyleSettings
            mapStyle={node.attrs.mapStyle || DEFAULT_MAP_STYLE}
            onStyleChange={handleStyleChange}
          />
        ),
      },
      {
        id: 'markers',
        label: 'Markers',
        icon: Layers,
        content: (
          <MarkersSettings
            markerCount={node.attrs.markers?.length || 0}
            streamMarkerCount={streamMarkers.length}
            onResetView={handleResetView}
            onClearMarkers={handleClearMarkers}
          />
        ),
      },
      {
        id: 'stream',
        label: avaViewId ? 'AVA' : 'Stream',
        icon: Radio,
        content: (
          <StreamSettings
            isConnected={effectiveStream.isConnected}
            isLoading={effectiveStream.isLoading}
            error={effectiveStream.error}
            streamId={avaViewId ? node.attrs.avaViewId : streamBinding?.streamId ?? null}
            onConnect={effectiveStream.subscribe}
            onDisconnect={effectiveStream.unsubscribe}
          />
        ),
      },
    ];

    return (
      <EmbeddedBlockWrapper
        nodeViewProps={nodeViewProps}
        badge={MAP_BADGE}
        tabs={effectiveTabs}
        expandedHeight={400}
        collapsedHeight={100}
        dataplaneConfig={MAP_DATAPLANE_CONFIG}
      >
        <MapContent
          viewState={viewState}
          onViewStateChange={handleViewStateChange}
          layers={layers}
          onMapClick={handleMapClick}
          onLoad={handleLoad}
          mapStyle={node.attrs.mapStyle || DEFAULT_MAP_STYLE}
          isLoading={isLoading}
        />
      </EmbeddedBlockWrapper>
    );
  };

  // When AVA is configured, wrap with AvaMapContent for proper hook lifecycle
  if (avaViewId) {
    return (
      <AvaMapContent
        viewId={avaViewId}
        channelId={avaChannelId}
        atoms={atoms}
      >
        {(avaState) => renderMapContent(avaState)}
      </AvaMapContent>
    );
  }

  // Fallback to legacy stream or local markers
  return renderMapContent();
}

export default MapBlockView;
