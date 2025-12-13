/**
 * Floating Panel Testbed v2
 *
 * Test cases for stx-powered floating panels with resize and mode switching.
 *
 * TC1: Basic Drag - Panel drags, original hidden during drag
 * TC2: Resize Edge - Resize from all 4 edges
 * TC3: Resize Corner - Resize from all 4 corners
 * TC4: Modifier Precision - Shift=0.1x, Ctrl+Shift=0.01x
 * TC5: Z-Index Stack - Click/drag brings to front
 * TC6: Persistence - Position + size survives reload
 * TC7: Float↔Modal - Double-click title OR dock button
 * TC8: Content Adapt - Container query + useFloatingDimensions
 * TC9: Min/Max Size - Respect dimension constraints
 * TC10: InteractiveCard - Mode switching (modal/floating/both)
 *
 * @module
 */

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import {
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import {
  FloatingPanelProvider,
  FloatingPanel,
  FloatingDragOverlay,
  useFloatingPanel,
  useFloatingDimensions,
  registerPanel,
  unregisterPanel,
  getFloatingStx,
  withDraggable,
} from '@/lib/floating'
import { useSelector } from '@/lib/stx'
import { InteractiveCard } from '@/components/primitives'
import { COLORS } from '@/lib/capabilities/tokens'
import type { VisitorContract, ModalActions } from '@/components/base/BaseModal/types'
import type { PanelConfig, DimensionConstraints } from '@/lib/floating/types'
import { TestCard } from './shared'

// Rich content imports
import {
  TmnlDataGrid,
  tmnlDenseDark,
  generateMockRows,
  useMockStream,
  type MockRow,
} from '@/lib/data-grid'
import { D3LineChart, type TimeseriesPoint } from '@/components/playground/streams/viz/D3LineChart'
import type { ColDef } from 'ag-grid-community'
import { useDataManager, type SearchResult } from '@/lib/data-manager/v1'

// =============================================================================
// Rich Content Components
// =============================================================================

/** Column definitions for DataGrid */
const GRID_COLUMN_DEFS: ColDef<MockRow>[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'name', headerName: 'Name', flex: 1 },
  { field: 'value', headerName: 'Value', width: 100, type: 'numericColumn' },
  {
    field: 'status',
    headerName: 'Status',
    width: 100,
    cellStyle: (params) => ({
      color: params.value === 'active' ? COLORS.accent.green.base
        : params.value === 'warning' ? COLORS.accent.amber.base
        : params.value === 'critical' ? COLORS.accent.red.base
        : COLORS.neutral[400],
    }),
  },
]

function MetricTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-neutral-800/50 rounded p-2 text-center">
      <div className="font-mono text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        {label}
      </div>
      <div className="font-mono font-bold" style={{ fontSize: 'var(--tmnl-text-lg, 18px)', color }}>
        {value}
      </div>
    </div>
  )
}

/** Sample data for search indexing */
interface SearchItem {
  id: string
  title: string
  category: string
  tags: string[]
}

const SAMPLE_SEARCH_DATA: SearchItem[] = [
  { id: '1', title: 'React Hooks Guide', category: 'docs', tags: ['react', 'hooks', 'frontend'] },
  { id: '2', title: 'Effect-TS Patterns', category: 'docs', tags: ['effect', 'typescript', 'fp'] },
  { id: '3', title: 'AG-Grid Integration', category: 'code', tags: ['grid', 'data', 'ui'] },
  { id: '4', title: 'D3 Visualization', category: 'code', tags: ['d3', 'charts', 'svg'] },
  { id: '5', title: 'State Management', category: 'docs', tags: ['state', 'atoms', 'legend'] },
  { id: '6', title: 'Floating Panels', category: 'ui', tags: ['panels', 'drag', 'resize'] },
  { id: '7', title: 'DataManager Service', category: 'code', tags: ['effect', 'search', 'streaming'] },
  { id: '8', title: 'Animation Library', category: 'code', tags: ['gsap', 'anime', 'motion'] },
  { id: '9', title: 'Slider System', category: 'ui', tags: ['slider', 'daw', 'precision'] },
  { id: '10', title: 'Layer Architecture', category: 'docs', tags: ['layers', 'z-index', 'adobe'] },
]

/** DataManager search content */
function SearchContent() {
  const { dimensions, layout } = useFloatingDimensions()
  const {
    results,
    isSearching,
    search,
    indexData,
    isIndexing,
    throughput,
    resultCount,
    stats,
  } = useDataManager<SearchItem>()

  const [searchQuery, setSearchQuery] = useState('')
  const [isIndexed, setIsIndexed] = useState(false)

  // Index sample data on mount
  useEffect(() => {
    const init = async () => {
      await indexData(SAMPLE_SEARCH_DATA, { fields: ['title', 'category', 'tags'] })
      setIsIndexed(true)
    }
    init()
  }, [indexData])

  // Search on query change (debounced)
  useEffect(() => {
    if (!isIndexed || !searchQuery.trim()) return
    const timeout = setTimeout(() => {
      search({ query: searchQuery, limit: 10 })
    }, 150)
    return () => clearTimeout(timeout)
  }, [searchQuery, isIndexed, search])

  const isCompact = layout === 'compact'

  return (
    <div className="p-3 h-full flex flex-col gap-2">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isIndexed ? 'Search...' : 'Indexing...'}
          disabled={!isIndexed}
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 font-mono placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        />
        {(isSearching || isIndexing) && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className={`flex gap-4 text-neutral-500 ${isCompact ? 'flex-col gap-1' : 'flex-row'}`} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        <span>Results: <span className="text-cyan-400">{resultCount}</span></span>
        <span>Throughput: <span className="text-green-400">{throughput.toFixed(1)}/s</span></span>
        {stats.ms > 0 && <span>Time: <span className="text-amber-400">{stats.ms.toFixed(0)}ms</span></span>}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-auto space-y-1">
        {results.length > 0 ? (
          results.map((result) => (
            <div
              key={result.item.id}
              className="bg-neutral-800/50 rounded px-2 py-1 flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span className="font-mono text-neutral-200" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                  {result.item.title}
                </span>
                <span className="font-mono text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  {result.item.category} • {result.item.tags.slice(0, 2).join(', ')}
                </span>
              </div>
              <span
                className="font-mono"
                style={{
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  color: result.score > 0.8 ? COLORS.accent.green.base
                    : result.score > 0.5 ? COLORS.accent.amber.base
                    : COLORS.neutral[500],
                }}
              >
                {(result.score * 100).toFixed(0)}%
              </span>
            </div>
          ))
        ) : searchQuery && isIndexed && !isSearching ? (
          <div className="text-center text-neutral-600 py-4" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            No results for "{searchQuery}"
          </div>
        ) : !searchQuery && isIndexed ? (
          <div className="text-center text-neutral-600 py-4" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            Type to search {SAMPLE_SEARCH_DATA.length} items
          </div>
        ) : null}
      </div>
    </div>
  )
}

// =============================================================================
// Draggable Cards (withDraggable HOC wrapping TestCard)
// =============================================================================

/** Draggable TestCard - uses shared TestCard component */
const DraggableTestCard = withDraggable(TestCard, {
  float: { enabled: true, title: 'Floating Card' },
  floatDimensions: { width: 450, height: 350 },
})

/** Card IDs for the draggable grid */
const CARD_IDS = ['card-grid', 'card-chart', 'card-metrics', 'card-search']

/** Card type definitions */
type CardType = 'grid' | 'chart' | 'metrics' | 'search'

interface CardConfig {
  title: string
  description: string
  type: CardType
  color: string
}

/** Card configurations */
const CARD_DATA: CardConfig[] = [
  { title: 'Data Grid', description: 'AG-Grid with mock data', type: 'grid', color: COLORS.accent.cyan.muted },
  { title: 'Live Chart', description: 'D3 real-time chart', type: 'chart', color: COLORS.accent.violet.muted },
  { title: 'Metrics', description: 'Animated metrics tiles', type: 'metrics', color: COLORS.accent.green.muted },
  { title: 'Search', description: 'DataManager search', type: 'search', color: COLORS.accent.amber.muted },
]

/** Wrapper that provides dimensions - uses hook when in FloatingPanel, defaults otherwise */
function useDimensions(defaultWidth: number, defaultHeight: number) {
  try {
    return useFloatingDimensions()
  } catch {
    // Not in a FloatingDimensionProvider - return defaults
    return {
      width: defaultWidth,
      height: defaultHeight,
      isResizing: false,
      layout: defaultWidth < 300 ? 'compact' as const : 'normal' as const,
    }
  }
}

/** DataGrid content - works in both grid and floating */
function DataGridContentInner({ width, height }: { width: number; height: number }) {
  const [rowData] = useState(() => generateMockRows(15))

  // Calculate grid height - account for padding
  const gridHeight = Math.max(height - 48, 120)

  return (
    <TmnlDataGrid
      variant={tmnlDenseDark}
      rowData={rowData}
      columnDefs={GRID_COLUMN_DEFS}
      getRowId={(params) => params.data.id}
      className="h-full"
      style={{ height: gridHeight, width: '100%' }}
    />
  )
}

/** Chart content - works in both grid and floating */
function ChartContentInner({ width, height }: { width: number; height: number }) {
  const [data, setData] = useState<TimeseriesPoint[]>(() => {
    const now = Date.now()
    return Array.from({ length: 30 }, (_, i) => ({
      timestamp: now - (29 - i) * 1000,
      value: 50 + Math.random() * 50,
    }))
  })

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const newPoint: TimeseriesPoint = {
          timestamp: Date.now(),
          value: Math.max(0, Math.min(100, prev[prev.length - 1].value + (Math.random() - 0.5) * 20)),
        }
        return [...prev.slice(1), newPoint]
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <D3LineChart
      data={data}
      width={Math.max(width - 24, 200)}
      height={Math.max(height - 60, 120)}
      yLabel="Throughput"
      color={COLORS.accent.cyan.base}
      showArea
    />
  )
}

/** Metrics content - works in both grid and floating */
function MetricsContentInner({ layout }: { layout: 'compact' | 'normal' | 'wide' }) {
  const [metrics, setMetrics] = useState({
    requests: 1247,
    latency: 42,
    errors: 3,
    uptime: 99.9,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) => ({
        requests: prev.requests + Math.floor(Math.random() * 10),
        latency: Math.max(10, prev.latency + (Math.random() - 0.5) * 5),
        errors: Math.max(0, prev.errors + (Math.random() > 0.9 ? 1 : 0)),
        uptime: Math.min(100, Math.max(99, prev.uptime + (Math.random() - 0.5) * 0.1)),
      }))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const isCompact = layout === 'compact'

  return (
    <div className={`grid gap-2 ${isCompact ? 'grid-cols-2' : 'grid-cols-4'}`}>
      <MetricTile label="Requests" value={metrics.requests.toLocaleString()} color={COLORS.accent.cyan.base} />
      <MetricTile label="Latency" value={`${metrics.latency.toFixed(1)}ms`} color={COLORS.accent.violet.base} />
      <MetricTile label="Errors" value={metrics.errors.toString()} color={COLORS.accent.red.base} />
      <MetricTile label="Uptime" value={`${metrics.uptime.toFixed(1)}%`} color={COLORS.accent.green.base} />
    </div>
  )
}

/** Search content - works in both grid and floating */
function SearchContentInner({ layout }: { layout: 'compact' | 'normal' | 'wide' }) {
  const {
    results,
    isSearching,
    search,
    indexData,
    isIndexing,
    throughput,
    resultCount,
    stats,
  } = useDataManager<SearchItem>()

  const [searchQuery, setSearchQuery] = useState('')
  const [isIndexed, setIsIndexed] = useState(false)

  // Index sample data on mount
  useEffect(() => {
    const init = async () => {
      await indexData(SAMPLE_SEARCH_DATA, { fields: ['title', 'category', 'tags'] })
      setIsIndexed(true)
    }
    init()
  }, [indexData])

  // Search on query change (debounced)
  useEffect(() => {
    if (!isIndexed || !searchQuery.trim()) return
    const timeout = setTimeout(() => {
      search({ query: searchQuery, limit: 10 })
    }, 150)
    return () => clearTimeout(timeout)
  }, [searchQuery, isIndexed, search])

  const isCompact = layout === 'compact'

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isIndexed ? 'Search...' : 'Indexing...'}
          disabled={!isIndexed}
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 font-mono placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        />
        {(isSearching || isIndexing) && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className={`flex gap-4 text-neutral-500 ${isCompact ? 'flex-col gap-1' : 'flex-row'}`} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        <span>Results: <span className="text-cyan-400">{resultCount}</span></span>
        <span>Throughput: <span className="text-green-400">{throughput.toFixed(1)}/s</span></span>
        {stats.ms > 0 && <span>Time: <span className="text-amber-400">{stats.ms.toFixed(0)}ms</span></span>}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-auto space-y-1" style={{ minHeight: 80 }}>
        {results.length > 0 ? (
          results.map((result) => (
            <div
              key={result.item.id}
              className="bg-neutral-800/50 rounded px-2 py-1 flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span className="font-mono text-neutral-200" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                  {result.item.title}
                </span>
                <span className="font-mono text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  {result.item.category} • {result.item.tags.slice(0, 2).join(', ')}
                </span>
              </div>
              <span
                className="font-mono"
                style={{
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  color: result.score > 0.8 ? COLORS.accent.green.base
                    : result.score > 0.5 ? COLORS.accent.amber.base
                    : COLORS.neutral[500],
                }}
              >
                {(result.score * 100).toFixed(0)}%
              </span>
            </div>
          ))
        ) : searchQuery && isIndexed && !isSearching ? (
          <div className="text-center text-neutral-600 py-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            No results
          </div>
        ) : !searchQuery && isIndexed ? (
          <div className="text-center text-neutral-600 py-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {SAMPLE_SEARCH_DATA.length} items indexed
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Card content renderer - renders same content in grid and floating */
function CardContentRenderer({ cardData }: { cardData: CardConfig }) {
  // Get dimensions - uses hook when floating, defaults when in grid
  const { width, height, layout } = useDimensions(350, 250)

  return (
    <div className="p-3 h-full">
      {cardData.type === 'grid' && <DataGridContentInner width={width} height={height} />}
      {cardData.type === 'chart' && <ChartContentInner width={width} height={height} />}
      {cardData.type === 'metrics' && <MetricsContentInner layout={layout} />}
      {cardData.type === 'search' && <SearchContentInner layout={layout} />}
    </div>
  )
}

/** Get card data by ID */
function getCardData(id: string) {
  const index = CARD_IDS.indexOf(id)
  return CARD_DATA[index % CARD_DATA.length]
}

/** Draggable Cards Grid - uses parent DndContext via FloatingPanelProvider */
function DraggableCardGrid({
  items,
  activeId,
}: {
  items: string[]
  activeId: string | null
}) {
  // Get panels map to filter floating items
  const stx = getFloatingStx()
  const panelsMap = useSelector(stx.data.panels, (p) => p)

  // Separate floating and grid items
  const gridItems = items.filter((id) => !panelsMap.has(id))
  const floatingItems = items.filter((id) => panelsMap.has(id))

  const activeCardData = activeId ? getCardData(activeId) : null

  return (
    <div
      className="mt-8 p-4 border border-dashed border-neutral-700 rounded-lg"
      style={{ backgroundColor: COLORS.neutral[925] }}
    >
      <div
        className="mb-4 font-mono text-neutral-600"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        DRAGGABLE GRID (CSS Grid + DragOverlay ghost, double-click to float)
        {floatingItems.length > 0 && (
          <span className="ml-2 text-cyan-500">
            ({floatingItems.length} floating)
          </span>
        )}
      </div>

      {/* SortableContext only includes non-floating grid items */}
      <SortableContext items={gridItems} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-4 gap-4">
          {gridItems.map((id) => {
            const cardData = getCardData(id)
            return (
              <DraggableTestCard
                key={id}
                id={id}
                title={cardData.title}
                description={cardData.description}
              >
                <CardContentRenderer cardData={cardData} />
              </DraggableTestCard>
            )
          })}

          {/* Placeholder slots for floating items */}
          {floatingItems.map((id) => {
            const cardData = getCardData(id)
            return (
              <div
                key={id}
                className="border-2 border-dashed border-cyan-500/30 rounded-lg p-4 flex items-center justify-center"
                style={{ minHeight: '160px', backgroundColor: 'rgba(0, 162, 255, 0.05)' }}
              >
                <span
                  className="font-mono text-cyan-500/50"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {cardData.title} (floating)
                </span>
              </div>
            )
          })}
        </div>
      </SortableContext>

      {/* Floating items render themselves via withDraggable → FloatingPanel */}
      {floatingItems.map((id) => {
        const cardData = getCardData(id)
        return (
          <DraggableTestCard
            key={`floating-${id}`}
            id={id}
            title={cardData.title}
            description={cardData.description}
          >
            <CardContentRenderer cardData={cardData} />
          </DraggableTestCard>
        )
      })}

      {/* Ghost overlay for sortable drags (not panels - they have their own blur) */}
      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeId && activeCardData && !panelsMap.has(activeId) ? (
          <TestCard
            title={activeCardData.title}
            description={activeCardData.description}
            className="shadow-2xl"
          >
            <CardContentRenderer cardData={activeCardData} />
          </TestCard>
        ) : null}
      </DragOverlay>
    </div>
  )
}

// =============================================================================
// Panel Wrapper - Handles registration lifecycle
// =============================================================================

interface ManagedPanelProps {
  id: string
  title: string
  initialPosition: { x: number; y: number }
  initialDimensions: { width: number; height: number }
  constraints?: DimensionConstraints
  show: boolean
  children: ReactNode
}

/**
 * Wrapper that handles panel registration/unregistration.
 * Panel is registered when show=true, unregistered when show=false.
 * Only renders FloatingPanel when panel exists in stx.
 */
function ManagedPanel({
  id,
  title,
  initialPosition,
  initialDimensions,
  constraints,
  show,
  children,
}: ManagedPanelProps) {
  const stx = getFloatingStx()
  const panelsMap = useSelector(stx.data.panels, (p) => p)
  const panel = panelsMap.get(id)

  // Register/unregister based on show prop
  // NOTE: initialPosition/initialDimensions are truly INITIAL — only used on first registration
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (show) {
      // Only register if panel doesn't exist yet (preserve resized dimensions)
      const existingPanel = getFloatingStx().data.panels.get().get(id)
      if (!existingPanel) {
        registerPanel({
          id,
          title,
          initialPosition,
          initialDimensions,
          constraints,
        })
      }
    } else {
      unregisterPanel(id)
    }

    return () => {
      // Cleanup on unmount
      if (show) {
        unregisterPanel(id)
      }
    }
  }, [show, id])

  // Only render if panel exists
  if (!show || !panel) {
    return null
  }

  return (
    <FloatingPanel id={id} title={title}>
      {children}
    </FloatingPanel>
  )
}

// =============================================================================
// Sample Content Components
// =============================================================================

function PanelContent({ title, color }: { title: string; color: string }) {
  return (
    <div className="p-4 space-y-3">
      <div
        className="w-full h-24 rounded flex items-center justify-center font-mono"
        style={{
          backgroundColor: color,
          fontSize: 'var(--tmnl-text-sm, 14px)',
        }}
      >
        {title} Content
      </div>
      <p
        className="text-neutral-400"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        This panel is draggable and resizable. Grab edges or corners to resize.
        Hold Shift for 0.1x precision, Ctrl+Shift for 0.01x.
      </p>
      <button
        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-mono transition-colors"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Sample Button
      </button>
    </div>
  )
}

// =============================================================================
// Adaptive Content (TC8)
// =============================================================================

function AdaptiveContent() {
  const { width, height, isResizing, layout } = useFloatingDimensions()

  return (
    <div className="p-4 space-y-3">
      <div className="space-y-2">
        <p
          className="font-mono text-neutral-300"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Dimensions: {Math.round(width)} × {Math.round(height)}
        </p>
        <p
          className="font-mono text-neutral-300"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Layout: <span className="text-cyan-400">{layout}</span>
        </p>
        <p
          className="font-mono text-neutral-300"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Resizing: <span className={isResizing ? 'text-amber-400' : 'text-green-400'}>
            {isResizing ? 'YES' : 'NO'}
          </span>
        </p>
      </div>

      {/* Adaptive layout based on width */}
      <div
        className={`grid gap-2 ${
          layout === 'compact' ? 'grid-cols-1' :
          layout === 'wide' ? 'grid-cols-3' :
          'grid-cols-2'
        }`}
      >
        <div className="bg-cyan-900/50 p-2 rounded text-center">
          <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Item 1</span>
        </div>
        <div className="bg-purple-900/50 p-2 rounded text-center">
          <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Item 2</span>
        </div>
        <div className="bg-green-900/50 p-2 rounded text-center">
          <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Item 3</span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Panel Controls Component
// =============================================================================

function PanelControls() {
  const { panels, bringToFront, sendToBack, closePanel, resizeSensitivity } = useFloatingPanel()

  return (
    <div
      className="fixed bottom-4 left-4 bg-neutral-900 border border-neutral-800 rounded p-4 space-y-3"
      style={{ zIndex: 10000 }}
    >
      <h3
        className="font-mono text-neutral-400 border-b border-neutral-800 pb-2"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        PANEL CONTROLS
      </h3>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span
            className="font-mono text-neutral-500"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Sensitivity:
          </span>
          <span
            className={`font-mono ${
              resizeSensitivity === 0.01 ? 'text-green-400' :
              resizeSensitivity === 0.1 ? 'text-amber-400' :
              'text-neutral-300'
            }`}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {resizeSensitivity}x
          </span>
        </div>

        <p
          className="font-mono text-neutral-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Active Panels: {panels.filter(p => p.visibility === 'visible').length}
        </p>

        {panels.map((panel) => (
          <div
            key={panel.id}
            className="flex items-center justify-between gap-2 px-2 py-1 bg-neutral-800/50 rounded"
          >
            <div className="flex flex-col">
              <span
                className="font-mono text-neutral-300 truncate"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {panel.title}
              </span>
              <span
                className="font-mono text-neutral-600"
                style={{ fontSize: '10px' }}
              >
                {Math.round(panel.dimensions.width)}×{Math.round(panel.dimensions.height)}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => bringToFront(panel.id)}
                className="px-1.5 py-0.5 text-cyan-500 hover:bg-cyan-500/20 rounded"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                title="Bring to front"
              >
                ↑
              </button>
              <button
                onClick={() => sendToBack(panel.id)}
                className="px-1.5 py-0.5 text-amber-500 hover:bg-amber-500/20 rounded"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                title="Send to back"
              >
                ↓
              </button>
              <button
                onClick={() => closePanel(panel.id)}
                className="px-1.5 py-0.5 text-red-500 hover:bg-red-500/20 rounded"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                title="Close"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Test Case: Interactive Card Demo
// =============================================================================

const sampleVisitor: VisitorContract<{ name: string }> = {
  id: 'sample-visitor',
  detachable: true,
  detachTitle: 'Sample Panel',
  render: (data: { name: string }, actions: ModalActions) => (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-mono text-neutral-200">{data.name}</h2>
      <p className="text-neutral-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        This content can be displayed in both modal and floating panel modes.
        Double-click the title bar to toggle dock/float.
      </p>
      <div className="flex gap-2">
        <button
          onClick={actions.close}
          className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded font-mono transition-colors"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Close
        </button>
        <button
          onClick={actions.detach}
          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-mono transition-colors"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Dock
        </button>
      </div>
    </div>
  ),
}

// =============================================================================
// Main Testbed Component
// =============================================================================

export function FloatingPanelTestbed() {
  const [showPanel1, setShowPanel1] = useState(true)
  const [showPanel2, setShowPanel2] = useState(true)
  const [showPanel3, setShowPanel3] = useState(true)
  const [showAdaptive, setShowAdaptive] = useState(true)
  const [showConstrained, setShowConstrained] = useState(true)

  // Sortable grid state (lifted from DraggableCardGrid for unified DndContext)
  const [sortableItems, setSortableItems] = useState(CARD_IDS)
  const [activeSortableId, setActiveSortableId] = useState<string | null>(null)

  // Sortable callbacks for FloatingPanelProvider
  const handleSortableDragStart = useCallback((event: DragStartEvent) => {
    setActiveSortableId(event.active.id as string)
  }, [])

  const handleSortableDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveSortableId(null)

    if (over && active.id !== over.id) {
      setSortableItems((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }, [])

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      {/* Header */}
      <header className="mb-8">
        <h1
          className="font-mono text-neutral-200 mb-2"
          style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
        >
          FLOATING PANEL TESTBED v2
        </h1>
        <p
          className="text-neutral-500"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          stx-powered draggable, resizable floating panels with modifier key precision.
        </p>
      </header>

      <FloatingPanelProvider
        onSortableDragStart={handleSortableDragStart}
        onSortableDragEnd={handleSortableDragEnd}
      >
        {/* Test Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* TC1: Basic Drag */}
          <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
            <h3
              className="font-mono text-cyan-400 mb-2"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              TC1: Basic Drag
            </h3>
            <p
              className="text-neutral-500 mb-3"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Original panel hidden during drag (visibility:hidden). Ghost overlay shows position.
            </p>
            <button
              onClick={() => setShowPanel1(!showPanel1)}
              className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded font-mono"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Toggle Panel 1
            </button>
          </div>

          {/* TC2+3: Resize */}
          <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
            <h3
              className="font-mono text-purple-400 mb-2"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              TC2+3: Resize
            </h3>
            <p
              className="text-neutral-500 mb-3"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Grab edges (n/s/e/w) or corners (ne/nw/se/sw) to resize.
            </p>
            <button
              onClick={() => setShowPanel2(!showPanel2)}
              className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded font-mono"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Toggle Panel 2
            </button>
          </div>

          {/* TC4: Modifier Precision */}
          <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
            <h3
              className="font-mono text-green-400 mb-2"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              TC4: Modifier Precision
            </h3>
            <p
              className="text-neutral-500 mb-3"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Hold <kbd className="bg-neutral-700 px-1 rounded">Shift</kbd> for 0.1x,{' '}
              <kbd className="bg-neutral-700 px-1 rounded">Ctrl+Shift</kbd> for 0.01x precision.
            </p>
          </div>

          {/* TC5: Z-Index Stack */}
          <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
            <h3
              className="font-mono text-amber-400 mb-2"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              TC5: Z-Index Stack
            </h3>
            <p
              className="text-neutral-500 mb-3"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Click or drag a panel to bring it to front.
            </p>
            <button
              onClick={() => setShowPanel3(!showPanel3)}
              className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded font-mono"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Toggle Panel 3
            </button>
          </div>

          {/* TC6: Persistence */}
          <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
            <h3
              className="font-mono text-red-400 mb-2"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              TC6: Persistence
            </h3>
            <p
              className="text-neutral-500"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Refresh the page — positions AND sizes are restored from localStorage.
            </p>
          </div>

          {/* TC7: Float↔Modal */}
          <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
            <h3
              className="font-mono text-pink-400 mb-2"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              TC7: Float↔Dock
            </h3>
            <p
              className="text-neutral-500"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Double-click title bar OR click dock button to toggle mode.
            </p>
          </div>

          {/* TC8: Content Adapt */}
          <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
            <h3
              className="font-mono text-blue-400 mb-2"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              TC8: Content Adapt
            </h3>
            <p
              className="text-neutral-500 mb-3"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Content adapts to panel dimensions via useFloatingDimensions.
            </p>
            <button
              onClick={() => setShowAdaptive(!showAdaptive)}
              className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded font-mono"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Toggle Adaptive
            </button>
          </div>

          {/* TC9: Min/Max Size */}
          <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
            <h3
              className="font-mono text-orange-400 mb-2"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              TC9: Min/Max Size
            </h3>
            <p
              className="text-neutral-500 mb-3"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Panel respects min 200×150, max 500×400 constraints.
            </p>
            <button
              onClick={() => setShowConstrained(!showConstrained)}
              className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 rounded font-mono"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Toggle Constrained
            </button>
          </div>

          {/* TC10: InteractiveCard */}
          <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
            <h3
              className="font-mono text-neutral-400 mb-2"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              TC10: InteractiveCard
            </h3>
            <p
              className="text-neutral-500 mb-3"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Card in floating mode renders directly as a panel.
            </p>
            <InteractiveCard
              id="interactive-demo"
              mode="floating"
              visitor={sampleVisitor}
              visitorData={{ name: 'Interactive Demo' }}
              initialPosition={{ x: 700, y: 200 }}
              initialDimensions={{ width: 350, height: 250 }}
              className="bg-neutral-800 p-2 cursor-default"
            >
              <span
                className="font-mono text-neutral-300"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Floating Card
              </span>
            </InteractiveCard>
          </div>
        </div>

        {/* Floating Panels - Using ManagedPanel for proper registration */}
        <ManagedPanel
          id="panel-1"
          title="Panel 1 - Cyan"
          initialPosition={{ x: 100, y: 200 }}
          initialDimensions={{ width: 320, height: 280 }}
          show={showPanel1}
        >
          <PanelContent title="Panel 1" color={COLORS.accent.cyan.muted} />
        </ManagedPanel>

        <ManagedPanel
          id="panel-2"
          title="Panel 2 - Purple"
          initialPosition={{ x: 250, y: 280 }}
          initialDimensions={{ width: 350, height: 300 }}
          show={showPanel2}
        >
          <PanelContent title="Panel 2" color={COLORS.accent.violet.muted} />
        </ManagedPanel>

        <ManagedPanel
          id="panel-3"
          title="Panel 3 - Green"
          initialPosition={{ x: 450, y: 220 }}
          initialDimensions={{ width: 300, height: 260 }}
          show={showPanel3}
        >
          <PanelContent title="Panel 3" color={COLORS.accent.green.muted} />
        </ManagedPanel>

        <ManagedPanel
          id="panel-adaptive"
          title="Adaptive Content"
          initialPosition={{ x: 150, y: 450 }}
          initialDimensions={{ width: 400, height: 250 }}
          show={showAdaptive}
        >
          <AdaptiveContent />
        </ManagedPanel>

        <ManagedPanel
          id="panel-constrained"
          title="Constrained (200-500)"
          initialPosition={{ x: 600, y: 450 }}
          initialDimensions={{ width: 300, height: 200 }}
          constraints={{
            minWidth: 200,
            minHeight: 150,
            maxWidth: 500,
            maxHeight: 400,
          }}
          show={showConstrained}
        >
          <div className="p-4">
            <p
              className="text-neutral-400 mb-2"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              This panel has size constraints:
            </p>
            <ul
              className="text-neutral-500 space-y-1"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <li>• Min: 200 × 150</li>
              <li>• Max: 500 × 400</li>
            </ul>
          </div>
        </ManagedPanel>

        {/* Draggable Cards Grid (withDraggable HOC demo) */}
        <DraggableCardGrid items={sortableItems} activeId={activeSortableId} />

        {/* Drag Overlay */}
        <FloatingDragOverlay style="ghost" />

        {/* Panel Controls */}
        <PanelControls />
      </FloatingPanelProvider>
    </div>
  )
}

export default FloatingPanelTestbed
