/**
 * Entity UI Atoms Testbed
 *
 * Demonstrates the GEOINT entity-atoms.ts patterns:
 * - Atom.family for per-entity UI state (entityUIStateFamily)
 * - HashSet-based selection management (selectedEntityIds)
 * - entityOps operations object for synchronous mutations
 * - registry.get()/set() for React callbacks
 * - Option for single-value nullable state (hoveredEntityId)
 *
 * Route: /testbed/entity-ui-atoms
 *
 * HYPOTHESES:
 * - H1: Atom.family creates unique atoms per entity
 * - H2: HashSet selection supports multi-select
 * - H3: entityOps mutations update atoms reactively
 * - H4: Cleanup disposes atoms correctly
 *
 * @module testbed/entity-ui-atoms
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Plus,
  Trash2,
  MousePointer2,
  Pin,
  PinOff,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  RefreshCw,
  MapPin,
  Plane,
  Cloud,
} from 'lucide-react'
import { HashSet, Option } from 'effect'
import { useAtomValue } from '@effect-atom/atom-react'

import { SectionLabel } from '@/components/testbed/shared'

// Import from entity-atoms
import {
  GeointRegistryProvider,
  entityUIStateFamily,
  entityLiveDataFamily,
  selectedEntityIds,
  hoveredEntityId,
  pinnedEntityIds,
  liveEntityIds,
  entityOps,
  type EntityLiveData,
} from '@/lib/geoint/kori/entity-atoms'

import type { GeointEntityType } from '@/lib/geoint/kori/search-result-mapper'

// =============================================================================
// Hypotheses Tracking
// =============================================================================

interface Hypotheses {
  h1_atomFamily: boolean
  h2_multiSelect: boolean
  h3_reactiveOps: boolean
  h4_cleanup: boolean
}

const initialHypotheses: Hypotheses = {
  h1_atomFamily: false,
  h2_multiSelect: false,
  h3_reactiveOps: false,
  h4_cleanup: false,
}

// =============================================================================
// Mock Entity Generator
// =============================================================================

const ENTITY_TYPES: GeointEntityType[] = ['flight', 'poi', 'weather', 'track', 'feature', 'imagery']

function generateMockEntity(): EntityLiveData {
  const entityType = ENTITY_TYPES[Math.floor(Math.random() * ENTITY_TYPES.length)]
  const id = `${entityType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  return {
    entityId: id,
    entityType,
    position: {
      lon: -122.4 + Math.random() * 0.2,
      lat: 37.7 + Math.random() * 0.2,
      altitudeM: entityType === 'flight' ? 10000 + Math.random() * 20000 : undefined,
    },
    heading: entityType === 'flight' ? Math.random() * 360 : undefined,
    speed: entityType === 'flight' ? 200 + Math.random() * 300 : undefined,
    label: `${entityType.toUpperCase()}-${id.slice(-5)}`,
    lastUpdated: new Date(),
    isLive: false,
  }
}

// =============================================================================
// Entity Card Component
// =============================================================================

const ENTITY_ICONS: Record<GeointEntityType, React.ReactNode> = {
  flight: <Plane size={14} />,
  poi: <MapPin size={14} />,
  weather: <Cloud size={14} />,
  track: <Eye size={14} />,
  feature: <MapPin size={14} />,
  imagery: <Eye size={14} />,
}

const ENTITY_COLORS: Record<GeointEntityType, string> = {
  flight: 'var(--tmnl-accent-cyan)',
  poi: 'var(--tmnl-accent-emerald)',
  weather: 'var(--tmnl-accent-amber)',
  track: 'var(--tmnl-accent-rose)',
  feature: 'var(--tmnl-status-info)',
  imagery: 'var(--tmnl-accent-rose)',
}

interface EntityCardProps {
  entityId: string
  onRemove: (id: string) => void
}

function EntityCard({ entityId, onRemove }: EntityCardProps) {
  // Subscribe to entity-specific atoms via family
  const uiAtom = useMemo(() => entityUIStateFamily(entityId), [entityId])
  const liveAtom = useMemo(() => entityLiveDataFamily(entityId), [entityId])

  const uiState = useAtomValue(uiAtom)
  const liveData = useAtomValue(liveAtom)

  if (!liveData) return null

  const isSelected = uiState.selected
  const isHovered = uiState.hovered
  const isPinned = uiState.pinned
  const isExpanded = uiState.expanded

  return (
    <div
      className={`
        rounded p-3 transition-all duration-200 cursor-pointer
        ${isSelected ? 'ring-2 ring-[var(--tmnl-accent-cyan)]' : ''}
        ${isHovered ? 'bg-[var(--tmnl-surface-base)]' : 'bg-[var(--tmnl-surface-sunken)]'}
      `}
      onClick={() => entityOps.toggleSelect(entityId)}
      onMouseEnter={() => entityOps.hover(entityId)}
      onMouseLeave={() => entityOps.unhover(entityId)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ color: ENTITY_COLORS[liveData.entityType] }}>
            {ENTITY_ICONS[liveData.entityType]}
          </span>
          <span
            className="font-mono text-[var(--tmnl-text-primary)]"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {liveData.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isPinned && <Pin size={12} className="text-[var(--tmnl-accent-amber)]" />}
          {liveData.isLive && (
            <div className="w-2 h-2 rounded-full bg-[var(--tmnl-status-success)] animate-pulse" />
          )}
        </div>
      </div>

      <div
        className="text-[var(--tmnl-text-muted)] mb-2"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {liveData.position.lat.toFixed(4)}, {liveData.position.lon.toFixed(4)}
        {liveData.position.altitudeM && ` @ ${Math.round(liveData.position.altitudeM)}m`}
      </div>

      {isExpanded && (
        <div
          className="text-[var(--tmnl-text-muted)] border-t border-[var(--tmnl-surface-base)] pt-2 mt-2"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {liveData.heading && <div>Heading: {liveData.heading.toFixed(0)}°</div>}
          {liveData.speed && <div>Speed: {liveData.speed.toFixed(0)} kts</div>}
          <div>Updated: {liveData.lastUpdated.toLocaleTimeString()}</div>
        </div>
      )}

      <div className="flex gap-1 mt-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            entityOps.togglePin(entityId)
          }}
          className={`p-1.5 rounded transition-colors ${
            isPinned
              ? 'bg-[var(--tmnl-accent-amber)]/20 text-[var(--tmnl-accent-amber)]'
              : 'bg-[var(--tmnl-surface-base)] text-[var(--tmnl-text-muted)]'
          }`}
          title={isPinned ? 'Unpin' : 'Pin'}
        >
          {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            entityOps.toggleExpand(entityId)
          }}
          className="p-1.5 rounded bg-[var(--tmnl-surface-base)] text-[var(--tmnl-text-muted)] hover:text-[var(--tmnl-text-primary)] transition-colors"
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(entityId)
          }}
          className="p-1.5 rounded bg-[var(--tmnl-status-error)]/20 text-[var(--tmnl-status-error)] hover:bg-[var(--tmnl-status-error)]/30 transition-colors"
          title="Remove"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

function EntityUIAtomsTestbedInner() {
  // Hypotheses state
  const [hypotheses, setHypotheses] = useState<Hypotheses>(initialHypotheses)

  // Track entity IDs
  const [entityIds, setEntityIds] = useState<string[]>([])

  // Subscribe to global atoms
  const selectedIds = useAtomValue(selectedEntityIds)
  const hoveredId = useAtomValue(hoveredEntityId)
  const pinnedIds = useAtomValue(pinnedEntityIds)
  const liveIds = useAtomValue(liveEntityIds)

  // Logs
  const [logs, setLogs] = useState<string[]>([])
  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-14), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Add entity
  const handleAddEntity = useCallback(() => {
    const entity = generateMockEntity()
    entityOps.initializeLiveData(entity)
    setEntityIds((prev) => [...prev, entity.entityId])
    log(`Added entity: ${entity.label}`)

    // Verify H1: Atom.family creates unique atoms
    const uiAtom1 = entityUIStateFamily(entity.entityId)
    const uiAtom2 = entityUIStateFamily(entity.entityId)
    if (uiAtom1 === uiAtom2) {
      setHypotheses((h) => ({ ...h, h1_atomFamily: true }))
    }
  }, [log])

  // Remove entity
  const handleRemoveEntity = useCallback(
    (entityId: string) => {
      entityOps.disposeEntity(entityId)
      setEntityIds((prev) => prev.filter((id) => id !== entityId))
      log(`Removed entity: ${entityId.slice(-10)}`)
      setHypotheses((h) => ({ ...h, h4_cleanup: true }))
    },
    [log]
  )

  // Select all
  const handleSelectAll = useCallback(() => {
    entityIds.forEach((id) => entityOps.select(id))
    log(`Selected all ${entityIds.length} entities`)
  }, [entityIds, log])

  // Clear selection
  const handleClearSelection = useCallback(() => {
    entityOps.clearSelection()
    log('Cleared selection')
  }, [log])

  // Toggle live status for random entity
  const handleToggleLive = useCallback(() => {
    if (entityIds.length === 0) return
    const randomId = entityIds[Math.floor(Math.random() * entityIds.length)]
    const isLive = entityOps.isLive(randomId)
    if (isLive) {
      entityOps.markStale(randomId)
      log(`Marked ${randomId.slice(-10)} as stale`)
    } else {
      entityOps.markLive(randomId)
      log(`Marked ${randomId.slice(-10)} as live`)
    }
    setHypotheses((h) => ({ ...h, h3_reactiveOps: true }))
  }, [entityIds, log])

  // Clear all
  const handleClearAll = useCallback(() => {
    entityOps.clearAll()
    setEntityIds([])
    log('Cleared all entities')
    setHypotheses((h) => ({ ...h, h4_cleanup: true }))
  }, [log])

  // Check H2: Multi-select
  useEffect(() => {
    if (HashSet.size(selectedIds) >= 2) {
      setHypotheses((h) => ({ ...h, h2_multiSelect: true }))
    }
  }, [selectedIds])

  return (
    <div className="min-h-screen bg-[var(--tmnl-surface-base)] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/testbed"
          className="flex items-center gap-2 text-[var(--tmnl-text-secondary)] hover:text-[var(--tmnl-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Back to Testbeds</span>
        </Link>
        <h1
          className="font-mono font-bold text-[var(--tmnl-text-primary)]"
          style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
        >
          Entity UI Atoms Testbed
        </h1>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Column 1: Controls */}
        <div className="space-y-4">
          <SectionLabel>Entity Controls</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <button
              onClick={handleAddEntity}
              className="w-full flex items-center justify-center gap-2 p-3 rounded bg-[var(--tmnl-accent-cyan)] text-black font-semibold hover:opacity-90 transition-opacity"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <Plus size={16} />
              Add Random Entity
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                disabled={entityIds.length === 0}
                className="flex-1 flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-secondary)] disabled:opacity-50 hover:bg-[var(--tmnl-surface-base)] transition-colors"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <MousePointer2 size={14} />
                Select All
              </button>
              <button
                onClick={handleClearSelection}
                disabled={HashSet.size(selectedIds) === 0}
                className="flex-1 flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-secondary)] disabled:opacity-50 hover:bg-[var(--tmnl-surface-base)] transition-colors"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <EyeOff size={14} />
                Clear Select
              </button>
            </div>

            <button
              onClick={handleToggleLive}
              disabled={entityIds.length === 0}
              className="w-full flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-secondary)] disabled:opacity-50 hover:bg-[var(--tmnl-surface-base)] transition-colors"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <RefreshCw size={14} />
              Toggle Random Live
            </button>

            <button
              onClick={handleClearAll}
              disabled={entityIds.length === 0}
              className="w-full flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-status-error)]/20 text-[var(--tmnl-status-error)] disabled:opacity-50 hover:bg-[var(--tmnl-status-error)]/30 transition-colors"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <Trash2 size={14} />
              Clear All
            </button>
          </div>

          {/* Global State */}
          <SectionLabel>Global Atom State</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <div>
              <div
                className="text-[var(--tmnl-text-muted)]"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Selected
              </div>
              <div
                className="font-mono text-[var(--tmnl-accent-cyan)]"
                style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
              >
                {HashSet.size(selectedIds)}
              </div>
            </div>
            <div>
              <div
                className="text-[var(--tmnl-text-muted)]"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Hovered
              </div>
              <div
                className="font-mono text-[var(--tmnl-text-primary)] truncate"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                {Option.isSome(hoveredId) ? hoveredId.value.slice(-10) : 'None'}
              </div>
            </div>
            <div>
              <div
                className="text-[var(--tmnl-text-muted)]"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Pinned
              </div>
              <div
                className="font-mono text-[var(--tmnl-accent-amber)]"
                style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
              >
                {HashSet.size(pinnedIds)}
              </div>
            </div>
            <div>
              <div
                className="text-[var(--tmnl-text-muted)]"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Live
              </div>
              <div
                className="font-mono text-[var(--tmnl-status-success)]"
                style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
              >
                {HashSet.size(liveIds)}
              </div>
            </div>
          </div>
        </div>

        {/* Column 2-3: Entity Grid */}
        <div className="col-span-2 space-y-4">
          <SectionLabel>Entities ({entityIds.length})</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 max-h-[600px] overflow-y-auto">
            {entityIds.length === 0 ? (
              <div
                className="text-center text-[var(--tmnl-text-muted)] py-12"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                No entities. Click "Add Random Entity" to create some.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {entityIds.map((id) => (
                  <EntityCard key={id} entityId={id} onRemove={handleRemoveEntity} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column 4: Hypotheses & Logs */}
        <div className="space-y-4">
          <SectionLabel>Hypotheses</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2">
            {[
              { key: 'h1_atomFamily', label: 'H1: Atom.family returns same atom' },
              { key: 'h2_multiSelect', label: 'H2: HashSet multi-select works' },
              { key: 'h3_reactiveOps', label: 'H3: entityOps updates reactively' },
              { key: 'h4_cleanup', label: 'H4: disposeEntity cleans up atoms' },
            ].map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center gap-2"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    hypotheses[key as keyof Hypotheses]
                      ? 'bg-[var(--tmnl-status-success)]'
                      : 'bg-[var(--tmnl-surface-sunken)]'
                  }`}
                />
                <span
                  className={
                    hypotheses[key as keyof Hypotheses]
                      ? 'text-[var(--tmnl-text-primary)]'
                      : 'text-[var(--tmnl-text-muted)]'
                  }
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          <SectionLabel>Logs</SectionLabel>
          <div
            className="bg-[var(--tmnl-surface-sunken)] rounded-lg p-3 h-48 overflow-y-auto font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {logs.map((log, i) => (
              <div key={i} className="text-[var(--tmnl-text-muted)]">
                {log}
              </div>
            ))}
          </div>

          <SectionLabel>Pattern Notes</SectionLabel>
          <div
            className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 text-[var(--tmnl-text-muted)] space-y-2"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <p>
              <strong className="text-[var(--tmnl-text-primary)]">Atom.family:</strong> entityUIStateFamily(id) returns the same atom for the same ID.
            </p>
            <p>
              <strong className="text-[var(--tmnl-text-primary)]">HashSet:</strong> Immutable collections for selection, pinned, live entity IDs.
            </p>
            <p>
              <strong className="text-[var(--tmnl-text-primary)]">Option:</strong> hoveredEntityId uses Option.none/some for single nullable value.
            </p>
            <p>
              <strong className="text-[var(--tmnl-text-primary)]">registry.get/set:</strong> Synchronous access in React callbacks via geointRegistry.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Wrap with provider
export function EntityUIAtomsTestbed() {
  return (
    <GeointRegistryProvider>
      <EntityUIAtomsTestbedInner />
    </GeointRegistryProvider>
  )
}

export default EntityUIAtomsTestbed
