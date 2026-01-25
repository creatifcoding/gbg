'use client'

/**
 * GeointDashboardPanel
 *
 * Self-contained GEOINT dashboard wrapped in a panel container for json-render.
 * Includes all connected components: map, search, entity details, timeline.
 *
 * @module geoint/components/GeointDashboardPanel
 */

import { type FC, useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'

import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
} from '@/components/portal/tokens'

import { GeointShell, useGeointShell } from './GeointShell'
import { GeointMap } from './GeointMap'
import { SearchPanelCompound } from './SearchPanelCompound'
import { SearchProvider } from './SearchProvider'
import { EntityPanelContent } from './EntityPanel'
import { TimelinePanel } from './TimelinePanel'
import { Minimap, type MinimapEntity } from './Minimap'
import { KeyboardShortcutsOverlay, GEOINT_SHORTCUTS } from './KeyboardShortcutsOverlay'
import type { LayoutMode } from '../atoms/layoutAtoms'
import {
  GeointPanelProvider,
  useGeointPanel,
  geointRegistry,
  createPanelIdentity,
  panelIdentityToId,
  type PanelIdentity,
} from '../atoms'
import { createGeointOperations } from '../atoms/operations'
import { useGeointPanelHotkeys } from '../hooks/useGeointPanelHotkeys'
import { useAtomValue } from '@effect-atom/atom-react'
import type { SearchResultItem } from '../schemas'

// =============================================================================
// Types
// =============================================================================

export interface GeointDashboardPanelProps {
  /** Unique ID for panel state isolation */
  panelId: string
  /** Display label in header */
  label: string
  /** Close callback */
  onClose?: () => void
  /** Initial layout mode */
  initialLayout?: LayoutMode
  /** Enable keyboard shortcuts */
  enableShortcuts?: boolean
  /** Custom class name */
  className?: string
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert SearchResultItem[] to MinimapEntity[]
 * Extracts position data from different result types
 */
const toMinimapEntities = (results: readonly SearchResultItem[]): MinimapEntity[] => {
  return results.map((result) => {
    // Extract longitude and latitude based on result type
    let longitude: number
    let latitude: number

    // All result types have a position field, but format differs
    if ('position' in result) {
      const pos = result.position as readonly number[]
      longitude = pos[0] // longitude is first
      latitude = pos[1] // latitude is second
    } else {
      // Fallback for unexpected types
      longitude = 0
      latitude = 0
    }

    return {
      id: result.id,
      longitude,
      latitude,
      source: result.source,
    }
  })
}

// =============================================================================
// Layout Controls (uses GeointShell context)
// =============================================================================

interface LayoutControlsProps {
  className?: string
}

const LayoutControls: FC<LayoutControlsProps> = ({ className }) => {
  const { layout, setLayout } = useGeointShell()

  const layouts: { mode: LayoutMode; label: string; shortcut: string }[] = [
    { mode: 'command', label: 'CMD', shortcut: '1' },
    { mode: 'focus', label: 'FOC', shortcut: '2' },
    { mode: 'analytics', label: 'ANA', shortcut: '3' },
  ]

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: VANTA_SPACING['1'],
        background: VANTA_COLORS.surface.base,
        borderRadius: VANTA_BORDERS.radius.sm,
        padding: '2px',
      }}
    >
      {layouts.map(({ mode, label, shortcut }) => (
        <button
          key={mode}
          onClick={() => setLayout(mode)}
          style={{
            padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
            borderRadius: VANTA_BORDERS.radius.sm,
            border: 'none',
            background:
              layout === mode
                ? VANTA_COLORS.accent.cyanGlow
                : 'transparent',
            color:
              layout === mode
                ? VANTA_COLORS.accent.cyan
                : VANTA_COLORS.text.muted,
            cursor: 'pointer',
            transition: VANTA_ANIMATION.transition.colors,
            ...VANTA_TYPOGRAPHY.preset.label,
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['1'],
          }}
          title={`${label} layout (Ctrl+${shortcut})`}
        >
          {label}
          <span style={{ opacity: 0.5, fontSize: 8 }}>{shortcut}</span>
        </button>
      ))}
    </div>
  )
}

// =============================================================================
// Header Content (rendered inside GeointShell to access context)
// =============================================================================

interface HeaderContentProps {
  label: string
  onClose?: () => void
}

const HeaderContent: FC<HeaderContentProps> = ({ label, onClose }) => {
  return (
    <>
      {/* Left: Status + Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: VANTA_SPACING['2'] }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: VANTA_COLORS.accent.emerald,
            boxShadow: VANTA_BORDERS.shadow.glowEmerald,
          }}
        />
        <span style={{ ...VANTA_TYPOGRAPHY.preset.label, color: VANTA_COLORS.text.secondary }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 9,
            padding: '1px 4px',
            borderRadius: 3,
            backgroundColor: VANTA_COLORS.accent.cyanGlow,
            color: VANTA_COLORS.accent.cyan,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          GEOINT
        </span>
      </div>

      {/* Center: Layout Controls */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <LayoutControls />
      </div>

      {/* Right: Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: VANTA_COLORS.text.muted,
            cursor: 'pointer',
            padding: VANTA_SPACING['1'],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: VANTA_BORDERS.radius.sm,
            transition: VANTA_ANIMATION.transition.colors,
          }}
          title="Close panel"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </>
  )
}

// =============================================================================
// Inner Content Component (uses panel context)
// =============================================================================

interface GeointDashboardPanelContentProps {
  label: string
  onClose?: () => void
  initialLayout: LayoutMode
  className?: string
  identity: PanelIdentity
}

/**
 * GeointDashboardPanelContent
 *
 * Inner component that accesses panel-scoped state via useGeointPanel().
 * Must be rendered inside GeointPanelProvider.
 */
const GeointDashboardPanelContent: FC<GeointDashboardPanelContentProps> = ({
  label,
  onClose,
  initialLayout,
  className,
  identity,
}) => {
  // Access panel-scoped atoms (safe because we're inside GeointPanelProvider)
  const { atoms, panelId } = useGeointPanel()

  // Create panel-scoped operations
  const operations = useMemo(
    () => createGeointOperations(panelId),
    [panelId]
  )

  // Wire panel-scoped hotkeys with focus/blur management
  const { containerRef } = useGeointPanelHotkeys(identity, operations)

  // Subscribe to panel-scoped atoms
  const viewport = useAtomValue(atoms.viewportAtom)
  const results = useAtomValue(atoms.resultsAtom)
  const filters = useAtomValue(atoms.activeFiltersAtom)

  // Filter results (derived computation - TODO: move to derived atom family)
  const filteredResults = useMemo(() => {
    let filtered = [...results]

    // Filter by sources
    if (filters.sources.length > 0) {
      filtered = filtered.filter((r) => filters.sources.includes(r.source))
    }

    // TODO: Add text query filtering when we have a proper derived atom family
    // For now, only source filtering is applied

    return filtered
  }, [results, filters])

  // Convert search results to minimap entities
  const minimapEntities = toMinimapEntities(filteredResults)

  // Viewport change handler for Minimap
  const handleViewportChange = useCallback(
    (newViewport: { longitude: number; latitude: number; zoom: number; pitch?: number; bearing?: number }) => {
      const current = geointRegistry.get(atoms.viewportAtom)
      geointRegistry.set(atoms.viewportAtom, {
        ...current,
        ...newViewport,
        pitch: newViewport.pitch ?? current.pitch,
        bearing: newViewport.bearing ?? current.bearing,
      })
    },
    [atoms]
  )

  // Keyboard shortcuts overlay state
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Handle ? key to toggle shortcuts overlay
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Check if we're in an input field
      const target = event.target as HTMLElement
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (!isInputField) {
        event.preventDefault()
        setShowShortcuts((prev) => !prev)
      }
    }
  }, [])

  // Add keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  return (
    <motion.div
      ref={containerRef}
      tabIndex={-1}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: VANTA_COLORS.gradient.surface,
        borderRadius: VANTA_BORDERS.radius.md,
        overflow: 'hidden',
        position: 'relative',
        fontFamily: VANTA_TYPOGRAPHY.family.sans,
        outline: 'none', // Remove focus outline since we handle via hotkey system
      }}
      className={className}
      data-panel-id={panelId}
    >
      <GeointShell layout={initialLayout}>
        {/* Header - label, layout controls, close button */}
        <GeointShell.Header>
          <HeaderContent label={label} onClose={onClose} />
        </GeointShell.Header>

        {/* Sidebar - search panel */}
        <GeointShell.Sidebar>
          <SearchProvider>
            <SearchPanelCompound>
              <SearchPanelCompound.Input placeholder="Search entities, locations..." />
              <SearchPanelCompound.SourceToggles />
              <SearchPanelCompound.TimeRange />
              <SearchPanelCompound.Results />
            </SearchPanelCompound>
          </SearchProvider>
        </GeointShell.Sidebar>

        {/* Map - the main map with minimap overlay */}
        <GeointShell.Map>
          <GeointMap instanceId={`${panelId}-map`} />

          {/* Minimap - floating navigation overview */}
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              zIndex: 10,
              pointerEvents: 'auto',
            }}
          >
            <Minimap
              viewport={viewport}
              onViewportChange={handleViewportChange}
              entities={minimapEntities}
              width={220}
              height={160}
              showCompass={true}
              showZoomControls={true}
              showZoomLevel={true}
              collapsible={true}
              defaultCollapsed={false}
            />
          </div>
        </GeointShell.Map>

        {/* Intel - entity details panel (connected to selection) */}
        <GeointShell.Intel>
          <EntityPanelContent panelId={`${panelId}-intel`} />
        </GeointShell.Intel>

        {/* Timeline - playback controls */}
        <GeointShell.Timeline>
          <TimelinePanel>
            <TimelinePanel.PlaybackControls />
            <TimelinePanel.BrushSelector />
            <TimelinePanel.RangeDisplay />
          </TimelinePanel>
        </GeointShell.Timeline>
      </GeointShell>

      {/* Keyboard Shortcuts Overlay - shows when ? key is pressed */}
      {showShortcuts && (
        <KeyboardShortcutsOverlay
          isVisible={showShortcuts}
          onClose={() => setShowShortcuts(false)}
          bindings={GEOINT_SHORTCUTS}
          showSearch={true}
          compact={false}
        />
      )}
    </motion.div>
  )
}

// =============================================================================
// Main Component (provides panel context)
// =============================================================================

/**
 * GeointDashboardPanel
 *
 * Self-contained GEOINT dashboard with all connected components:
 * - Interactive map (DeckGL + Mapbox)
 * - Search panel with source toggles, time range, results
 * - Entity detail panel (connected to selection)
 * - Timeline controls with playback
 *
 * Supports 3 layout modes via header controls or keyboard shortcuts:
 * - command: 3-column command center (Ctrl+1)
 * - focus: Full-screen map with floating panels (Ctrl+2)
 * - analytics: Grid-based analytics dashboard (Ctrl+3)
 *
 * @example
 * ```tsx
 * <div style={{ width: 1200, height: 800 }}>
 *   <GeointDashboardPanel
 *     panelId="geoint-main"
 *     label="Operations Center"
 *     initialLayout="command"
 *     onClose={() => closePanel()}
 *   />
 * </div>
 * ```
 */
export const GeointDashboardPanel: FC<GeointDashboardPanelProps> = ({
  panelId,
  label,
  onClose,
  initialLayout = 'command',
  enableShortcuts: _enableShortcuts = true,
  className,
}) => {
  // Create stable panel identity from slug (panelId prop)
  // UUID is generated once and remains stable for component lifetime
  const identity = useMemo(
    () => createPanelIdentity(panelId),
    [panelId]
  )

  // Convert identity to panel ID for atom family keys
  const atomPanelId = useMemo(
    () => panelIdentityToId(identity),
    [identity]
  )

  return (
    <GeointPanelProvider panelId={atomPanelId}>
      <GeointDashboardPanelContent
        label={label}
        onClose={onClose}
        initialLayout={initialLayout}
        className={className}
        identity={identity}
      />
    </GeointPanelProvider>
  )
}

export default GeointDashboardPanel
