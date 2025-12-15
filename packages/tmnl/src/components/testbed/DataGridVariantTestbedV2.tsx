/**
 * DataGrid Variant Testbed V2
 *
 * Uses the NEW unified Tmnl.DataGrid compound component.
 * Mirror of DataGridVariantTestbed but using the consolidated implementation.
 *
 * Route: /testbed/data-grid-variants (via wrapper toggle)
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Settings2,
  Zap,
  Layers,
  Palette,
  Activity,
  Sliders,
} from 'lucide-react'
import { type ColDef, type ICellRendererParams } from 'ag-grid-community'

// NEW: Unified DataGrid from lib/data-grid
import {
  Tmnl,
  tmnlDenseDark,
  tmnlDenseDarkMuted,
  tmnlUltraOps,
  tmnlAnalystLight,
  GRID_VARIANTS,
  DENSITY_PRESETS,
  extractStatusColors,
  useMockStream,
  type GridVariantType,
  type DensityTierType,
  type MockRow,
} from '@/lib/data-grid'

// =============================================================================
// CONSTANTS
// =============================================================================

const VARIANT_LIST = [
  { id: 'tmnl-dense-dark', label: 'Dense Dark', variant: tmnlDenseDark },
  { id: 'tmnl-dense-dark-muted', label: 'Dense Muted', variant: tmnlDenseDarkMuted },
  { id: 'tmnl-ultra-ops', label: 'Ultra Ops', variant: tmnlUltraOps },
  { id: 'tmnl-analyst-light', label: 'Analyst Light', variant: tmnlAnalystLight },
] as const

const DENSITY_TIERS: DensityTierType[] = ['ultra', 'dense', 'normal', 'relaxed']

// =============================================================================
// CELL RENDERERS (variant-aware)
// =============================================================================

function createStatusRenderer(variant: GridVariantType) {
  const statusColors = extractStatusColors(variant)

  return function StatusCellRenderer(params: ICellRendererParams) {
    const status = params.value as keyof typeof statusColors
    const color = statusColors[status] || statusColors.default

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          height: '100%',
          padding: '0 4px',
        }}
      >
        <div
          style={{
            width: '5px',
            height: '5px',
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}60`,
          }}
        />
        <span
          style={{
            color,
            fontSize: variant.density.fontSizeXs,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 500,
          }}
        >
          {params.value}
        </span>
      </div>
    )
  }
}

function createValueRenderer(variant: GridVariantType) {
  return function ValueCellRenderer(params: ICellRendererParams) {
    const value = params.value as number
    const delta = params.data?.delta as number | undefined
    const intensity = Math.min(1, value / 100)

    const deltaColor = delta && delta > 0
      ? variant.colors.signal.positive
      : delta && delta < 0
        ? variant.colors.signal.negative
        : 'transparent'

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          height: '100%',
          padding: '0 4px',
        }}
      >
        <span
          style={{
            color: variant.colors.text.primary,
            fontVariantNumeric: 'tabular-nums',
            minWidth: '20px',
            fontSize: variant.density.fontSize,
          }}
        >
          {value}
        </span>
        {delta !== undefined && delta !== 0 && (
          <span
            style={{
              color: deltaColor,
              fontSize: variant.density.fontSizeXs,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
        <div
          style={{
            flex: 1,
            height: '2px',
            backgroundColor: variant.colors.border.muted,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${intensity * 100}%`,
              height: '100%',
              backgroundColor: variant.colors.signal.accent,
              opacity: 0.4,
              transition: 'width 0.15s ease-out',
            }}
          />
        </div>
      </div>
    )
  }
}

function createIdRenderer(variant: GridVariantType) {
  return function IdCellRenderer(params: ICellRendererParams) {
    return (
      <span
        style={{
          color: variant.colors.text.muted,
          fontSize: variant.density.fontSizeXs,
          letterSpacing: '0.05em',
        }}
      >
        {params.value}
      </span>
    )
  }
}

// =============================================================================
// VARIANT PICKER
// =============================================================================

interface VariantPickerProps {
  selectedId: string
  onSelect: (id: string) => void
}

function VariantPicker({ selectedId, onSelect }: VariantPickerProps) {
  return (
    <div className="space-y-1">
      <div
        className="font-mono uppercase tracking-widest text-neutral-500 mb-2"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Variants
      </div>
      {VARIANT_LIST.map(({ id, label, variant }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`
            w-full text-left px-3 py-2 border transition-all
            ${selectedId === id
              ? 'border-cyan-500/30 bg-cyan-500/5'
              : 'border-neutral-800 hover:border-neutral-700'
            }
          `}
        >
          <div className="flex items-center justify-between">
            <span
              className={`font-mono uppercase tracking-wide ${
                selectedId === id ? 'text-cyan-400' : 'text-neutral-400'
              }`}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {label}
            </span>
            <div
              className="flex items-center gap-1"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <span className="text-neutral-600">{variant.densityTier}</span>
              <div
                className="w-2 h-2"
                style={{
                  backgroundColor: variant.colorScheme === 'dark' ? '#1a1a1a' : '#e5e5e5',
                  border: '1px solid',
                  borderColor: variant.colorScheme === 'dark' ? '#333' : '#ccc',
                }}
              />
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

// =============================================================================
// DENSITY SLIDER
// =============================================================================

interface DensitySliderProps {
  value: DensityTierType
  onChange: (tier: DensityTierType) => void
}

function DensitySlider({ value, onChange }: DensitySliderProps) {
  return (
    <div className="space-y-2">
      <div
        className="font-mono uppercase tracking-widest text-neutral-500"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Density Tier
      </div>

      <div className="flex items-center gap-1">
        {DENSITY_TIERS.map((tier) => {
          const preset = DENSITY_PRESETS[tier]
          const isSelected = tier === value

          return (
            <button
              key={tier}
              onClick={() => onChange(tier)}
              className={`
                flex-1 py-2 border transition-all text-center
                ${isSelected
                  ? 'border-cyan-500/30 bg-cyan-500/5'
                  : 'border-neutral-800 hover:border-neutral-700'
                }
              `}
            >
              <div
                className={`font-mono uppercase ${
                  isSelected ? 'text-cyan-400' : 'text-neutral-500'
                }`}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {tier}
              </div>
              <div
                className="text-neutral-600 mt-0.5"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {preset.rowHeight}px
              </div>
            </button>
          )
        })}
      </div>

      <div
        className="font-mono text-neutral-600 text-center"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Row: {DENSITY_PRESETS[value].rowHeight}px · Font: {DENSITY_PRESETS[value].fontSize}px
      </div>
    </div>
  )
}

// =============================================================================
// STREAM CONTROLS
// =============================================================================

interface StreamControlsProps {
  isStreaming: boolean
  tick: number
  updateCount: number
  onToggle: () => void
  onReset: () => void
  intervalMs: number
  onIntervalChange: (ms: number) => void
}

function StreamControls({
  isStreaming,
  tick,
  updateCount,
  onToggle,
  onReset,
  intervalMs,
  onIntervalChange,
}: StreamControlsProps) {
  return (
    <div className="space-y-2">
      <div
        className="font-mono uppercase tracking-widest text-neutral-500"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Stream
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 border transition-all
            ${isStreaming
              ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
              : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
            }
          `}
        >
          {isStreaming ? <Pause size={12} /> : <Play size={12} />}
          <span
            className="font-mono uppercase"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {isStreaming ? 'Pause' : 'Start'}
          </span>
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:border-neutral-600 transition-all"
        >
          <RotateCcw size={12} />
          <span
            className="font-mono uppercase"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Reset
          </span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-neutral-600"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            INTERVAL
          </span>
          <select
            value={intervalMs}
            onChange={(e) => onIntervalChange(Number(e.target.value))}
            className="bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono px-2 py-1"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <option value={250}>250ms</option>
            <option value={500}>500ms</option>
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Activity size={10} className={isStreaming ? 'text-emerald-500' : 'text-neutral-600'} />
          <span
            className="font-mono text-neutral-500"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            TICK {tick}
          </span>
          <span
            className="font-mono text-cyan-500"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            +{updateCount}
          </span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// STATS PANEL
// =============================================================================

interface StatsPanelProps {
  variant: GridVariantType
  rowCount: number
}

function StatsPanel({ variant, rowCount }: StatsPanelProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="border border-neutral-800 p-2">
        <div
          className="font-mono text-neutral-600 uppercase"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Density
        </div>
        <div
          className="font-mono text-white"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {variant.densityTier}
        </div>
      </div>
      <div className="border border-neutral-800 p-2">
        <div
          className="font-mono text-neutral-600 uppercase"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Rows
        </div>
        <div
          className="font-mono text-white"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {rowCount}
        </div>
      </div>
      <div className="border border-neutral-800 p-2">
        <div
          className="font-mono text-neutral-600 uppercase"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Theme
        </div>
        <div
          className="font-mono text-white"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {variant.colorScheme}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN TESTBED V2
// =============================================================================

type ViewMode = 'streaming' | 'compare'

export function DataGridVariantTestbedV2() {
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('streaming')

  // Variant state
  const [selectedVariantId, setSelectedVariantId] = useState('tmnl-dense-dark')
  const [densityOverride, setDensityOverride] = useState<DensityTierType | null>(null)

  // Compare mode state
  const [compareVariantId, setCompareVariantId] = useState('tmnl-ultra-ops')

  // Stream state
  const [intervalMs, setIntervalMs] = useState(1000)
  const {
    rows,
    lastUpdates,
    tick,
    isStreaming,
    start,
    stop,
    toggle,
    setConfig,
  } = useMockStream({
    autoStart: true,
    initialCount: 15,
    updateIntervalMs: intervalMs,
    changeProbability: 0.4,
  })

  // Compute active variant (with optional density override)
  const activeVariant = useMemo(() => {
    const base = GRID_VARIANTS[selectedVariantId] ?? tmnlDenseDark

    if (densityOverride && densityOverride !== base.densityTier) {
      return {
        ...base,
        densityTier: densityOverride,
        density: DENSITY_PRESETS[densityOverride],
      }
    }

    return base
  }, [selectedVariantId, densityOverride])

  // Compare variant (for compare mode)
  const compareVariant = useMemo(() => {
    return GRID_VARIANTS[compareVariantId] ?? tmnlUltraOps
  }, [compareVariantId])

  // Column definitions (variant-aware renderers)
  const columnDefs = useMemo<ColDef<MockRow>[]>(() => [
    {
      field: 'id',
      headerName: 'ID',
      width: activeVariant.density.rowHeight * 2.5,
      suppressSizeToFit: true,
      cellRenderer: createIdRenderer(activeVariant),
    },
    {
      field: 'name',
      headerName: 'NAME',
      flex: 1,
      cellStyle: {
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      },
    },
    {
      field: 'value',
      headerName: 'VALUE',
      width: activeVariant.density.rowHeight * 5,
      cellRenderer: createValueRenderer(activeVariant),
    },
    {
      field: 'status',
      headerName: 'STATUS',
      width: activeVariant.density.rowHeight * 4,
      cellRenderer: createStatusRenderer(activeVariant),
    },
  ], [activeVariant])

  // Compare column defs
  const compareColumnDefs = useMemo<ColDef<MockRow>[]>(() => [
    {
      field: 'id',
      headerName: 'ID',
      width: compareVariant.density.rowHeight * 2.5,
      suppressSizeToFit: true,
      cellRenderer: createIdRenderer(compareVariant),
    },
    {
      field: 'name',
      headerName: 'NAME',
      flex: 1,
      cellStyle: {
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      },
    },
    {
      field: 'value',
      headerName: 'VALUE',
      width: compareVariant.density.rowHeight * 5,
      cellRenderer: createValueRenderer(compareVariant),
    },
    {
      field: 'status',
      headerName: 'STATUS',
      width: compareVariant.density.rowHeight * 4,
      cellRenderer: createStatusRenderer(compareVariant),
    },
  ], [compareVariant])

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
  }), [])

  // Handle interval change
  const handleIntervalChange = useCallback((ms: number) => {
    setIntervalMs(ms)
    setConfig({ updateIntervalMs: ms })
  }, [setConfig])

  // Handle reset
  const handleReset = useCallback(() => {
    stop()
    setTimeout(() => start(), 100)
  }, [stop, start])

  // Handle variant change
  const handleVariantChange = useCallback((id: string) => {
    setSelectedVariantId(id)
    setDensityOverride(null)
  }, [])

  return (
    <div className="min-h-screen w-screen bg-neutral-950">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-neutral-600 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="font-mono uppercase tracking-widest text-neutral-300" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                DataGrid Variant Testbed{' '}
                <span className="text-cyan-500">V2 (Tmnl.DataGrid)</span>
              </h1>
              <p
                className="font-mono text-neutral-600"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Testing unified lib/data-grid compound component
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-neutral-800">
              <button
                onClick={() => setViewMode('streaming')}
                className={`
                  px-3 py-1.5 transition-all font-mono uppercase
                  ${viewMode === 'streaming'
                    ? 'bg-cyan-500/10 text-cyan-400 border-r border-cyan-500/30'
                    : 'text-neutral-500 hover:text-white border-r border-neutral-800'
                  }
                `}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <div className="flex items-center gap-1.5">
                  <Activity size={10} />
                  Stream
                </div>
              </button>
              <button
                onClick={() => setViewMode('compare')}
                className={`
                  px-3 py-1.5 transition-all font-mono uppercase
                  ${viewMode === 'compare'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'text-neutral-500 hover:text-white'
                  }
                `}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <div className="flex items-center gap-1.5">
                  <Palette size={10} />
                  Compare
                </div>
              </button>
            </div>

            <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-700'}`} />
            <span
              className="font-mono text-cyan-500 uppercase"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {activeVariant.id}
            </span>
          </div>
        </div>
      </header>

      {/* Main content: split layout */}
      <div className="flex h-[calc(100vh-57px)]">
        {/* Left panel: controls */}
        <aside className="w-72 border-r border-neutral-800 bg-neutral-900/30 p-4 overflow-y-auto">
          <div className="space-y-6">
            {/* Variant picker */}
            <VariantPicker
              selectedId={selectedVariantId}
              onSelect={handleVariantChange}
            />

            <div className="border-t border-neutral-800" />

            {/* Density slider */}
            <DensitySlider
              value={densityOverride ?? activeVariant.densityTier}
              onChange={setDensityOverride}
            />

            <div className="border-t border-neutral-800" />

            {/* Stream controls */}
            <StreamControls
              isStreaming={isStreaming}
              tick={tick}
              updateCount={lastUpdates.length}
              onToggle={toggle}
              onReset={handleReset}
              intervalMs={intervalMs}
              onIntervalChange={handleIntervalChange}
            />

            <div className="border-t border-neutral-800" />

            {/* Stats */}
            <StatsPanel
              variant={activeVariant}
              rowCount={rows.length}
            />
          </div>
        </aside>

        {/* Center panel: content based on view mode */}
        <main className="flex-1 p-6 overflow-hidden">
          {viewMode === 'streaming' && (
            <div style={{ height: '100%' }}>
              <Tmnl.DataGrid
                id="variant-stream"
                variant={activeVariant}
                rowData={rows as MockRow[]}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                getRowId={(params) => params.data.id}
              >
                <Tmnl.DataGrid.Header>
                  <Tmnl.DataGrid.Title title="STREAMING DATA" badge={rows.length} />
                  <Tmnl.DataGrid.SettingsButton />
                </Tmnl.DataGrid.Header>
                <Tmnl.DataGrid.Body />
                <Tmnl.DataGrid.StatusBar>
                  <span>Tick: {tick}</span>
                  <span>Updates: {lastUpdates.length}</span>
                </Tmnl.DataGrid.StatusBar>
                <Tmnl.DataGrid.CornerDecorations />
              </Tmnl.DataGrid>
            </div>
          )}

          {viewMode === 'compare' && (
            <div className="h-full flex flex-col">
              {/* Compare header with variant selectors */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-800">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-cyan-500" />
                    <span
                      className="font-mono uppercase text-neutral-300"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      Variant A
                    </span>
                    <select
                      value={selectedVariantId}
                      onChange={(e) => handleVariantChange(e.target.value)}
                      className="bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono px-2 py-1"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      {VARIANT_LIST.map(v => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </div>

                  <div
                    className="text-neutral-600 font-mono"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    VS
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500" />
                    <span
                      className="font-mono uppercase text-neutral-300"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      Variant B
                    </span>
                    <select
                      value={compareVariantId}
                      onChange={(e) => setCompareVariantId(e.target.value)}
                      className="bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono px-2 py-1"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      {VARIANT_LIST.map(v => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div
                  className="flex items-center gap-4 font-mono text-neutral-600"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  <span>ROW: {activeVariant.density.rowHeight}px vs {compareVariant.density.rowHeight}px</span>
                  <span>FONT: {activeVariant.density.fontSize}px vs {compareVariant.density.fontSize}px</span>
                </div>
              </div>

              {/* Side-by-side grids */}
              <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                {/* Variant A */}
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-cyan-500" />
                    <span
                      className="font-mono uppercase text-cyan-400"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      {activeVariant.id}
                    </span>
                    <span
                      className="font-mono text-neutral-600"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      {activeVariant.densityTier} · {activeVariant.colorScheme}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <Tmnl.DataGrid
                      id="compare-a"
                      variant={activeVariant}
                      rowData={rows as MockRow[]}
                      columnDefs={columnDefs}
                      defaultColDef={defaultColDef}
                      getRowId={(params) => params.data.id}
                    >
                      <Tmnl.DataGrid.Body />
                    </Tmnl.DataGrid>
                  </div>
                </div>

                {/* Variant B */}
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-amber-500" />
                    <span
                      className="font-mono uppercase text-amber-400"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      {compareVariant.id}
                    </span>
                    <span
                      className="font-mono text-neutral-600"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      {compareVariant.densityTier} · {compareVariant.colorScheme}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <Tmnl.DataGrid
                      id="compare-b"
                      variant={compareVariant}
                      rowData={rows as MockRow[]}
                      columnDefs={compareColumnDefs}
                      defaultColDef={defaultColDef}
                      getRowId={(params) => params.data.id}
                    >
                      <Tmnl.DataGrid.Body />
                    </Tmnl.DataGrid>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
