/**
 * Fusion View Component
 *
 * Multi-source intelligence fusion visualization:
 * - Correlation matrix between sources
 * - Fused entity list
 * - Fusion rules management
 * - Source reliability indicators
 *
 * ASCII Layout:
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ ┌─ HEADER ───────────────────────────────────────────────────────────────┐ │
 * │ │ Multi-Source Fusion │ Sources: 4 active │ Entities: 247 │ [Compute]   │ │
 * │ └────────────────────────────────────────────────────────────────────────┘ │
 * │ ┌─ TABS ─────────────────────────────────────────────────────────────────┐ │
 * │ │ [Matrix] [Fused Entities] [Rules]                                      │ │
 * │ └────────────────────────────────────────────────────────────────────────┘ │
 * │ ┌─ MATRIX VIEW ──────────────────────────────────────────────────────────┐ │
 * │ │        │ Track │ OSM   │ AIS   │ SIGINT│                               │ │
 * │ │ ───────┼───────┼───────┼───────┼───────│                               │ │
 * │ │ Track  │   -   │ ████  │ ██░░  │ █░░░  │     Legend:                   │ │
 * │ │ OSM    │ ████  │   -   │ ███░  │ ██░░  │     ████ Strong (>80%)        │ │
 * │ │ AIS    │ ██░░  │ ███░  │   -   │ █░░░  │     ███░ Moderate (50-80%)    │ │
 * │ │ SIGINT │ █░░░  │ ██░░  │ █░░░  │   -   │     ██░░ Weak (20-50%)        │ │
 * │ │                                        │     █░░░ None (<20%)          │ │
 * │ └────────────────────────────────────────────────────────────────────────┘ │
 * │ ┌─ SELECTED PAIR DETAIL ─────────────────────────────────────────────────┐ │
 * │ │ Track ↔ OSM: 156 matches, 87% confidence                               │ │
 * │ │ Top Correlations: [Spatial: 92%] [Identity: 85%] [Temporal: 78%]       │ │
 * │ └────────────────────────────────────────────────────────────────────────┘ │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * @module geoint/components/FusionView
 */

import * as React from 'react'
import { createContext, useContext, useMemo } from 'react'
import { useMachine } from '@xstate/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import {
  fusionViewMachine,
  SOURCE_COLORS,
  SOURCE_NAMES,
  type FusionViewContext as FusionViewState,
  type FusionViewEvent,
  type FusionSource,
  type CorrelationPair,
  type FusedEntity,
  type FusionRule,
  type FusionViewInput,
} from '../machines/fusionViewMachine'

// =============================================================================
// CONTEXT
// =============================================================================

interface FusionViewContextValue {
  state: FusionViewState
  send: (event: FusionViewEvent) => void
  // Computed values
  filteredCorrelations: CorrelationPair[]
  sortedEntities: FusedEntity[]
  selectedPairData: CorrelationPair | null
  selectedEntity: FusedEntity | null
  activeRules: FusionRule[]
  sourceStats: Record<FusionSource, { matches: number; avgConfidence: number }>
}

const FusionViewContext = createContext<FusionViewContextValue | null>(null)

function useFusionView() {
  const context = useContext(FusionViewContext)
  if (!context) {
    throw new Error('useFusionView must be used within FusionView.Root')
  }
  return context
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

interface RootProps {
  children: React.ReactNode
  input?: FusionViewInput
  className?: string
}

function Root({ children, input = {}, className }: RootProps) {
  const [snapshot, send] = useMachine(fusionViewMachine, { input })
  const state = snapshot.context

  // Filtered correlations
  const filteredCorrelations = useMemo(() => {
    let filtered = state.correlations

    // Filter by type
    if (state.correlationTypeFilter !== 'all') {
      filtered = filtered.filter(c => c.correlationType === state.correlationTypeFilter)
    }

    // Filter by confidence
    filtered = filtered.filter(c => c.confidence >= state.minConfidenceThreshold)

    // Filter strong only
    if (state.showStrongOnly) {
      filtered = filtered.filter(c => c.strength === 'strong')
    }

    // Filter by active sources
    filtered = filtered.filter(c =>
      state.activeSources.includes(c.sourceA) &&
      state.activeSources.includes(c.sourceB)
    )

    return filtered
  }, [state.correlations, state.correlationTypeFilter, state.minConfidenceThreshold, state.showStrongOnly, state.activeSources])

  // Sorted entities
  const sortedEntities = useMemo(() => {
    const entities = [...state.fusedEntities]
    switch (state.sortBy) {
      case 'confidence':
        return entities.sort((a, b) => b.score - a.score)
      case 'sources':
        return entities.sort((a, b) => b.sources.length - a.sources.length)
      case 'updated':
        return entities.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      default:
        return entities
    }
  }, [state.fusedEntities, state.sortBy])

  // Selected pair data
  const selectedPairData = useMemo(() => {
    if (!state.selectedPair) return null
    return state.correlations.find(c =>
      (c.sourceA === state.selectedPair!.sourceA && c.sourceB === state.selectedPair!.sourceB) ||
      (c.sourceA === state.selectedPair!.sourceB && c.sourceB === state.selectedPair!.sourceA)
    ) ?? null
  }, [state.selectedPair, state.correlations])

  // Selected entity
  const selectedEntity = useMemo(() =>
    state.fusedEntities.find(e => e.id === state.selectedEntityId) ?? null,
    [state.fusedEntities, state.selectedEntityId]
  )

  // Active rules
  const activeRules = useMemo(() =>
    state.rules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority),
    [state.rules]
  )

  // Source stats
  const sourceStats = useMemo(() => {
    const stats: Record<FusionSource, { matches: number; avgConfidence: number }> = {} as Record<FusionSource, { matches: number; avgConfidence: number }>

    state.activeSources.forEach(source => {
      const relevantCorrelations = state.correlations.filter(c =>
        c.sourceA === source || c.sourceB === source
      )
      const totalMatches = relevantCorrelations.reduce((sum, c) => sum + c.matchCount, 0)
      const avgConf = relevantCorrelations.length > 0
        ? relevantCorrelations.reduce((sum, c) => sum + c.confidence, 0) / relevantCorrelations.length
        : 0

      stats[source] = { matches: totalMatches, avgConfidence: avgConf }
    })

    return stats
  }, [state.activeSources, state.correlations])

  const contextValue: FusionViewContextValue = {
    state,
    send,
    filteredCorrelations,
    sortedEntities,
    selectedPairData,
    selectedEntity,
    activeRules,
    sourceStats,
  }

  return (
    <FusionViewContext.Provider value={contextValue}>
      <div className={cn('flex flex-col h-full bg-surface-0', className)}>
        {children}
      </div>
    </FusionViewContext.Provider>
  )
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

interface HeaderProps {
  className?: string
}

function Header({ className }: HeaderProps) {
  const { state, send } = useFusionView()

  return (
    <header className={cn(
      'flex items-center justify-between px-4 py-3',
      'border-b border-white/10 bg-surface-1/50 backdrop-blur-sm',
      className
    )}>
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-medium text-white">Multi-Source Fusion</h1>

        {/* Source count */}
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span>{state.activeSources.length} sources active</span>
          <span className="text-white/20">•</span>
          <span>{state.fusedEntities.length} fused entities</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Progress indicator */}
        {state.isComputing && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-cyan transition-all"
                style={{ width: `${state.computeProgress}%` }}
              />
            </div>
            <span className="text-xs text-white/40">{state.computeProgress}%</span>
          </div>
        )}

        {/* Last computed */}
        {state.lastComputedAt && !state.isComputing && (
          <span className="text-xs text-white/40">
            Last: {state.lastComputedAt.toLocaleTimeString()}
          </span>
        )}

        {/* Compute button */}
        <button
          onClick={() => send({ type: 'COMPUTE_CORRELATIONS' })}
          disabled={state.isComputing}
          className={cn(
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            state.isComputing
              ? 'bg-white/5 text-white/40 cursor-not-allowed'
              : 'bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30'
          )}
        >
          {state.isComputing ? 'Computing...' : 'Compute Correlations'}
        </button>
      </div>
    </header>
  )
}

// =============================================================================
// TAB NAV COMPONENT
// =============================================================================

interface TabNavProps {
  className?: string
}

function TabNav({ className }: TabNavProps) {
  const { state, send } = useFusionView()

  const tabs: Array<{ id: typeof state.activePanel; label: string; count?: number }> = [
    { id: 'matrix', label: 'Correlation Matrix' },
    { id: 'entities', label: 'Fused Entities', count: state.fusedEntities.length },
    { id: 'rules', label: 'Fusion Rules', count: state.rules.filter(r => r.enabled).length },
  ]

  return (
    <nav className={cn('flex border-b border-white/10 px-4', className)}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => send({ type: 'SET_ACTIVE_PANEL', panel: tab.id })}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            state.activePanel === tab.id
              ? 'text-accent-cyan border-accent-cyan'
              : 'text-white/60 border-transparent hover:text-white/80'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-2 text-xs opacity-60">({tab.count})</span>
          )}
        </button>
      ))}
    </nav>
  )
}

// =============================================================================
// SOURCE TOGGLES COMPONENT
// =============================================================================

interface SourceTogglesProps {
  className?: string
}

function SourceToggles({ className }: SourceTogglesProps) {
  const { state, send } = useFusionView()

  return (
    <div className={cn('flex flex-wrap gap-2 p-4 border-b border-white/5', className)}>
      <span className="text-xs text-white/40 mr-2 self-center">Sources:</span>
      {state.sources.map(source => {
        const isActive = state.activeSources.includes(source.id)
        return (
          <button
            key={source.id}
            onClick={() => send({ type: 'TOGGLE_SOURCE', source: source.id })}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-all',
              'border flex items-center gap-1.5',
              isActive
                ? 'border-current bg-current/10'
                : 'border-white/10 text-white/40 hover:border-white/20'
            )}
            style={isActive ? { color: source.color } : undefined}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: isActive ? source.color : 'rgba(255,255,255,0.2)' }}
            />
            {source.name}
            <span className="opacity-50">({source.entityCount})</span>
          </button>
        )
      })}
    </div>
  )
}

// =============================================================================
// CORRELATION MATRIX COMPONENT
// =============================================================================

interface CorrelationMatrixProps {
  className?: string
}

function CorrelationMatrix({ className }: CorrelationMatrixProps) {
  const { state, send, filteredCorrelations } = useFusionView()

  if (state.activePanel !== 'matrix') return null

  const activeSources = state.sources.filter(s => state.activeSources.includes(s.id))

  // Build matrix data
  const getMatrixValue = (sourceA: FusionSource, sourceB: FusionSource) => {
    if (sourceA === sourceB) return null
    const pair = filteredCorrelations.find(c =>
      (c.sourceA === sourceA && c.sourceB === sourceB) ||
      (c.sourceA === sourceB && c.sourceB === sourceA)
    )
    return pair ?? null
  }

  const getCellContent = (pair: CorrelationPair | null) => {
    if (!pair) return { display: '-', bars: 0 }

    switch (state.matrixMode) {
      case 'count':
        return { display: String(pair.matchCount), bars: Math.min(4, Math.ceil(pair.matchCount / 50)) }
      case 'confidence':
        return { display: `${Math.round(pair.confidence * 100)}%`, bars: Math.ceil(pair.confidence * 4) }
      case 'strength':
        const strengthMap = { strong: 4, moderate: 3, weak: 2, none: 1 }
        return { display: pair.strength[0].toUpperCase(), bars: strengthMap[pair.strength] }
      default:
        return { display: '-', bars: 0 }
    }
  }

  return (
    <div className={cn('flex-1 overflow-auto p-4', className)}>
      {/* Matrix Mode Toggle */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-xs text-white/40">Display:</span>
        {(['count', 'confidence', 'strength'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => send({ type: 'SET_MATRIX_MODE', mode })}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              state.matrixMode === mode
                ? 'bg-accent-cyan/20 text-accent-cyan'
                : 'text-white/40 hover:text-white/60'
            )}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* Matrix Grid */}
      <div className="inline-block min-w-full">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-xs text-white/40 font-normal" />
              {activeSources.map(source => (
                <th
                  key={source.id}
                  className="p-2 text-xs font-medium text-center min-w-[80px]"
                  style={{ color: source.color }}
                >
                  {source.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSources.map(rowSource => (
              <tr key={rowSource.id}>
                <td
                  className="p-2 text-xs font-medium text-right pr-4"
                  style={{ color: rowSource.color }}
                >
                  {rowSource.name}
                </td>
                {activeSources.map(colSource => {
                  const pair = getMatrixValue(rowSource.id, colSource.id)
                  const { display, bars } = getCellContent(pair)
                  const isSelected = state.selectedPair &&
                    ((state.selectedPair.sourceA === rowSource.id && state.selectedPair.sourceB === colSource.id) ||
                     (state.selectedPair.sourceA === colSource.id && state.selectedPair.sourceB === rowSource.id))

                  if (rowSource.id === colSource.id) {
                    return (
                      <td key={colSource.id} className="p-2 text-center">
                        <span className="text-white/20 text-xs">—</span>
                      </td>
                    )
                  }

                  return (
                    <td key={colSource.id} className="p-1">
                      <button
                        onClick={() => pair && send({
                          type: 'SELECT_PAIR',
                          sourceA: rowSource.id,
                          sourceB: colSource.id
                        })}
                        disabled={!pair}
                        className={cn(
                          'w-full p-2 rounded transition-all',
                          'flex flex-col items-center gap-1',
                          pair ? 'hover:bg-white/10 cursor-pointer' : 'cursor-default',
                          isSelected && 'ring-2 ring-accent-cyan bg-accent-cyan/10'
                        )}
                      >
                        <span className="text-xs text-white/80">{display}</span>
                        {/* Strength bars */}
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4].map(i => (
                            <div
                              key={i}
                              className={cn(
                                'w-1.5 h-3 rounded-sm transition-colors',
                                i <= bars ? 'bg-accent-cyan' : 'bg-white/10'
                              )}
                            />
                          ))}
                        </div>
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center gap-6 text-xs text-white/40">
        <span>Strength:</span>
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-1.5 h-3 rounded-sm bg-accent-cyan" />
            ))}
          </div>
          <span className="ml-1">Strong (&gt;80%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-1.5 h-3 rounded-sm bg-accent-cyan" />
            ))}
            <div className="w-1.5 h-3 rounded-sm bg-white/10" />
          </div>
          <span className="ml-1">Moderate</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5">
            {[1, 2].map(i => (
              <div key={i} className="w-1.5 h-3 rounded-sm bg-accent-cyan" />
            ))}
            {[3, 4].map(i => (
              <div key={i} className="w-1.5 h-3 rounded-sm bg-white/10" />
            ))}
          </div>
          <span className="ml-1">Weak</span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// PAIR DETAIL COMPONENT
// =============================================================================

interface PairDetailProps {
  className?: string
}

function PairDetail({ className }: PairDetailProps) {
  const { state, send, selectedPairData } = useFusionView()

  if (!selectedPairData || state.activePanel !== 'matrix') return null

  const sourceA = state.sources.find(s => s.id === selectedPairData.sourceA)
  const sourceB = state.sources.find(s => s.id === selectedPairData.sourceB)

  return (
    <div className={cn(
      'border-t border-white/10 p-4 bg-surface-1/30',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color: sourceA?.color }}>{sourceA?.name}</span>
          <span className="text-white/40">↔</span>
          <span style={{ color: sourceB?.color }}>{sourceB?.name}</span>
        </div>
        <button
          onClick={() => send({ type: 'CLEAR_PAIR_SELECTION' })}
          className="text-xs text-white/40 hover:text-white"
        >
          Clear
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-2xl font-medium text-white">{selectedPairData.matchCount}</div>
          <div className="text-xs text-white/40">Matches</div>
        </div>
        <div>
          <div className="text-2xl font-medium text-accent-cyan">
            {Math.round(selectedPairData.confidence * 100)}%
          </div>
          <div className="text-xs text-white/40">Confidence</div>
        </div>
        <div>
          <div className="text-2xl font-medium text-white capitalize">
            {selectedPairData.strength}
          </div>
          <div className="text-xs text-white/40">Strength</div>
        </div>
      </div>

      {/* Example matches */}
      {selectedPairData.examples.length > 0 && (
        <div>
          <div className="text-xs text-white/40 mb-2">Top Matches</div>
          <div className="space-y-1">
            {selectedPairData.examples.slice(0, 3).map((ex, i) => (
              <div key={i} className="flex items-center justify-between text-xs p-2 bg-white/5 rounded">
                <span className="text-white/60">{ex.entityA}</span>
                <span className="text-white/20">↔</span>
                <span className="text-white/60">{ex.entityB}</span>
                <span className="text-accent-cyan">{Math.round(ex.score * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// ENTITY LIST COMPONENT
// =============================================================================

interface EntityListProps {
  className?: string
}

function EntityList({ className }: EntityListProps) {
  const { state, send, sortedEntities, selectedEntity } = useFusionView()
  const parentRef = React.useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: sortedEntities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  })

  if (state.activePanel !== 'entities') return null

  const confidenceColors = {
    high: 'text-green-400',
    medium: 'text-amber-400',
    low: 'text-orange-400',
    uncertain: 'text-red-400'
  }

  return (
    <div className={cn('flex-1 flex flex-col', className)}>
      {/* Sort controls */}
      <div className="flex items-center gap-4 p-4 border-b border-white/5">
        <span className="text-xs text-white/40">Sort by:</span>
        {(['confidence', 'sources', 'updated'] as const).map(sort => (
          <button
            key={sort}
            onClick={() => send({ type: 'SET_SORT_BY', sortBy: sort })}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              state.sortBy === sort
                ? 'bg-accent-cyan/20 text-accent-cyan'
                : 'text-white/40 hover:text-white/60'
            )}
          >
            {sort.charAt(0).toUpperCase() + sort.slice(1)}
          </button>
        ))}
      </div>

      {/* Virtualized list */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const entity = sortedEntities[virtualRow.index]
            const isSelected = entity.id === state.selectedEntityId

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <button
                  onClick={() => send({ type: 'SELECT_ENTITY', id: entity.id })}
                  className={cn(
                    'w-full p-4 text-left transition-colors border-b border-white/5',
                    isSelected ? 'bg-accent-cyan/10' : 'hover:bg-white/5'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Entity ID */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-white font-mono truncate">
                          {entity.id.slice(0, 12)}...
                        </span>
                        {entity.manuallyVerified && (
                          <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                            Verified
                          </span>
                        )}
                      </div>

                      {/* Sources */}
                      <div className="flex items-center gap-1.5 mb-1">
                        {entity.sources.map(source => (
                          <span
                            key={source}
                            className="px-1.5 py-0.5 text-xs rounded"
                            style={{
                              backgroundColor: `${SOURCE_COLORS[source]}20`,
                              color: SOURCE_COLORS[source]
                            }}
                          >
                            {SOURCE_NAMES[source]}
                          </span>
                        ))}
                      </div>

                      {/* Meta */}
                      <div className="text-xs text-white/40">
                        Updated {entity.updatedAt.toLocaleTimeString()}
                      </div>
                    </div>

                    {/* Confidence */}
                    <div className="text-right">
                      <div className={cn('text-lg font-medium', confidenceColors[entity.confidence])}>
                        {Math.round(entity.score * 100)}%
                      </div>
                      <div className="text-xs text-white/40 capitalize">
                        {entity.confidence}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected entity detail */}
      {selectedEntity && (
        <div className="border-t border-white/10 p-4 bg-surface-1/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white">Entity Details</span>
            <div className="flex gap-2">
              <button
                onClick={() => send({ type: 'VERIFY_ENTITY', id: selectedEntity.id, verified: !selectedEntity.manuallyVerified })}
                className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
              >
                {selectedEntity.manuallyVerified ? 'Unverify' : 'Verify'}
              </button>
              <button
                onClick={() => send({ type: 'SPLIT_ENTITY', id: selectedEntity.id })}
                className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
              >
                Split
              </button>
            </div>
          </div>

          <div className="text-xs text-white/60">
            <pre className="bg-white/5 p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(selectedEntity.attributes, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// RULES LIST COMPONENT
// =============================================================================

interface RulesListProps {
  className?: string
}

function RulesList({ className }: RulesListProps) {
  const { state, send } = useFusionView()

  if (state.activePanel !== 'rules') return null

  return (
    <div className={cn('flex-1 overflow-auto p-4', className)}>
      {/* Add Rule Button */}
      <button
        onClick={() => send({
          type: 'ADD_RULE',
          rule: {
            name: `Rule ${state.rules.length + 1}`,
            enabled: true,
            priority: state.rules.length,
            sourceA: '*',
            sourceB: '*',
            correlationType: 'spatial',
            conditions: [],
            minConfidence: 0.5
          }
        })}
        className={cn(
          'w-full px-4 py-3 mb-4 rounded border-2 border-dashed border-white/10',
          'text-sm text-white/40 hover:border-white/20 hover:text-white/60 transition-colors'
        )}
      >
        + Add Fusion Rule
      </button>

      {/* Rules List */}
      <div className="space-y-2">
        {state.rules.map(rule => (
          <div
            key={rule.id}
            className={cn(
              'p-4 rounded-lg border transition-colors',
              rule.enabled
                ? 'bg-surface-1/50 border-white/10'
                : 'bg-white/5 border-white/5 opacity-50'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => send({ type: 'TOGGLE_RULE', id: rule.id })}
                  className={cn(
                    'w-4 h-4 rounded border transition-colors',
                    rule.enabled
                      ? 'bg-accent-cyan border-accent-cyan'
                      : 'border-white/20'
                  )}
                >
                  {rule.enabled && (
                    <svg className="w-full h-full text-black" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.5 4.5l-7 7L3 8" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  )}
                </button>
                <span className="text-sm font-medium text-white">{rule.name}</span>
              </div>
              <button
                onClick={() => send({ type: 'DELETE_RULE', id: rule.id })}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-white/40">Sources:</span>
                <div className="text-white/80 mt-0.5">
                  {rule.sourceA === '*' ? 'Any' : SOURCE_NAMES[rule.sourceA]} →{' '}
                  {rule.sourceB === '*' ? 'Any' : SOURCE_NAMES[rule.sourceB]}
                </div>
              </div>
              <div>
                <span className="text-white/40">Type:</span>
                <div className="text-white/80 mt-0.5 capitalize">{rule.correlationType}</div>
              </div>
              <div>
                <span className="text-white/40">Min Confidence:</span>
                <div className="text-white/80 mt-0.5">{Math.round(rule.minConfidence * 100)}%</div>
              </div>
            </div>

            {rule.conditions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/5">
                <span className="text-xs text-white/40">Conditions:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {rule.conditions.map((cond, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-xs bg-white/10 rounded">
                      {cond.field} {cond.operator} {cond.value}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// STATS OVERLAY COMPONENT
// =============================================================================

interface StatsOverlayProps {
  className?: string
}

function StatsOverlay({ className }: StatsOverlayProps) {
  const { state, sourceStats } = useFusionView()

  return (
    <div className={cn(
      'absolute top-4 right-4',
      'bg-surface-1/80 border border-white/10 rounded-lg p-3 backdrop-blur-sm',
      className
    )}>
      <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
        Source Stats
      </div>
      <div className="space-y-2">
        {state.activeSources.map(sourceId => {
          const source = state.sources.find(s => s.id === sourceId)
          const stats = sourceStats[sourceId]
          if (!source || !stats) return null

          return (
            <div key={sourceId} className="flex items-center justify-between gap-4 text-xs">
              <span style={{ color: source.color }}>{source.name}</span>
              <span className="text-white/60">{stats.matches} matches</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const FusionView = Object.assign(Root, {
  Header,
  TabNav,
  SourceToggles,
  CorrelationMatrix,
  PairDetail,
  EntityList,
  RulesList,
  StatsOverlay,
})

export { useFusionView }
