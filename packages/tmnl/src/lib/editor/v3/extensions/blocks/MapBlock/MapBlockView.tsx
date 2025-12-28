/**
 * MapBlockView Component
 *
 * React node view for MapBlock in TipTap editor.
 * Uses EmbeddedBlockWrapper for foldable, badged UI.
 * Embeds Mapbox + deck.gl with controlled viewState.
 *
 * @module editor/v3/extensions/blocks/MapBlock/MapBlockView
 */

import { useRef, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { type NodeViewProps } from '@tiptap/react';
import { useAtom } from '@effect-atom/atom-react';
import { Map } from 'react-map-gl/mapbox';
import { DeckGL } from '@deck.gl/react';
import type { MapViewState, PickingInfo } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import { MapPin, Palette, Layers, Trash2 } from 'lucide-react';

import { VANTA_COLORS, VANTA_BORDERS, VANTA_SPACING } from '@/components/portal/tokens';
import { EmbeddedBlockWrapper, type SettingsTab, type BlockBadge } from '../EmbeddedBlockWrapper';
import {
  getMapBlockAtoms,
  disposeMapBlockAtoms,
  DEFAULT_VIEW_STATE,
  DEFAULT_MAP_STYLE,
} from './atoms';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: VANTA_SPACING['2'] }}>
      <label style={{ color: VANTA_COLORS.text.muted, fontSize: '12px' }}>Map Style</label>
      <div style={{ display: 'flex', gap: VANTA_SPACING['1'], flexWrap: 'wrap' }}>
        {styles.map((style) => (
          <button
            key={style.id}
            onClick={() => onStyleChange(style.id)}
            style={{
              padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
              background: mapStyle === style.id ? VANTA_COLORS.accent.cyanGlow : 'transparent',
              border: `1px solid ${mapStyle === style.id ? VANTA_COLORS.accent.cyanMuted : VANTA_COLORS.surface.border}`,
              color: mapStyle === style.id ? VANTA_COLORS.accent.cyan : VANTA_COLORS.text.secondary,
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
  onResetView: () => void;
  onClearMarkers: () => void;
}

function MarkersSettings({ markerCount, onResetView, onClearMarkers }: MarkersSettingsProps) {
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
        {markerCount} marker{markerCount !== 1 ? 's' : ''} • Click map to add
      </div>
      <div style={{ display: 'flex', gap: VANTA_SPACING['2'] }}>
        <button onClick={onResetView} style={buttonStyle}>
          <MapPin size={12} /> Reset View
        </button>
        <button onClick={onClearMarkers} style={buttonStyle}>
          <Trash2 size={12} /> Clear Markers
        </button>
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
  const deckRef = useRef<DeckGL>(null);

  return (
    <div
      style={{
        height: '100%',
        position: 'relative',
        background: VANTA_COLORS.surface.void,
      }}
    >
      {/* Loading overlay */}
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
            Loading map...
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
            <span style={{ color: VANTA_COLORS.text.muted }}>Add to .env.local to enable maps.</span>
          </span>
        </div>
      )}

      {MAPBOX_TOKEN && (
        <DeckGL
          ref={deckRef}
          viewState={viewState}
          onViewStateChange={onViewStateChange}
          controller={true}
          layers={layers}
          onClick={onMapClick}
          style={{ width: '100%', height: '100%' }}
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
  const atoms = useMemo(() => getMapBlockAtoms(blockId), [blockId]);

  const [viewState, setViewState] = useAtom(atoms.viewStateAtom);
  const [isLoading, setIsLoading] = useAtom(atoms.isLoadingAtom);

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

  // Demo layer - scatter plot
  const layers = useMemo(() => {
    const demoData = node.attrs.markers || [
      { position: [-122.4194, 37.7749], color: [34, 211, 238] },
      { position: [-122.4094, 37.7849], color: [147, 51, 234] },
      { position: [-122.4294, 37.7649], color: [236, 72, 153] },
    ];

    return [
      new ScatterplotLayer({
        id: 'markers',
        data: demoData,
        getPosition: (d: { position: [number, number] }) => d.position,
        getFillColor: (d: { color: [number, number, number] }) => [...d.color, 200],
        getRadius: 100,
        radiusMinPixels: 8,
        radiusMaxPixels: 50,
        pickable: true,
      }),
    ];
  }, [node.attrs.markers]);

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

  // Settings tabs
  const tabs: SettingsTab[] = useMemo(
    () => [
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
            onResetView={handleResetView}
            onClearMarkers={handleClearMarkers}
          />
        ),
      },
    ],
    [node.attrs.mapStyle, node.attrs.markers?.length, handleStyleChange, handleResetView, handleClearMarkers]
  );

  return (
    <EmbeddedBlockWrapper
      nodeViewProps={nodeViewProps}
      badge={MAP_BADGE}
      tabs={tabs}
      expandedHeight={400}
      collapsedHeight={100}
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
}

export default MapBlockView;
