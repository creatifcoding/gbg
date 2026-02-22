/**
 * DataGrid Variant Testbed
 *
 * Extended testbed for the data-grid abstraction layer.
 * Features:
 * - Split layout: variant picker (left) + live preview (right)
 * - Effect-based streaming data with flash visualization
 * - Density tier interactive slider
 * - Full variant builder panel
 *
 * Route: /testbed/data-grid-variants
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
  ChevronDown,
  ChevronRight,
  Sliders,
  MousePointer2,
  Type,
} from 'lucide-react'
import { type ColDef, type ICellRendererParams } from 'ag-grid-community'

// Data grid library imports
import {
  // Variants
  tmnlDenseDark,
  tmnlDenseDarkMuted,
  tmnlUltraOps,
  tmnlAnalystLight,
  GRID_VARIANTS,
  // Schemas
  DENSITY_PRESETS,
  BEHAVIOR_PRESETS,
  INTENT_DEFAULTS,
  type DensityTierType,
  type GridVariantType,
  type SelectionModeType,
  type HoverModeType,
  type FocusModeType,
  type EditTriggerType,
  type KeyboardNavModeType,
  type ColumnIntent,
  // Composer (for cell renderers that need variant colors)
  extractStatusColors,
  // Flash
  type FlashState,
  // Component
  TmnlDataGrid,
  type TmnlDataGridHandle,
  type TmnlGridContext,
} from '@/lib/data-grid'
// Mocking imports (separate to avoid eager faker loading via barrel)
import { type MockRow, type RowUpdate } from '@/lib/data-grid/mocking'
import { useMockStream } from '@/lib/data-grid/hooks/useMockStream'

// Branded types need workarounds
type DensityTier = DensityTierType
type GridVariant = GridVariantType

// =============================================================================
// CONSTANTS
// =============================================================================

const VARIANT_LIST = [
  { id: 'tmnl-dense-dark', label: 'Dense Dark', variant: tmnlDenseDark },
  { id: 'tmnl-dense-dark-muted', label: 'Dense Muted', variant: tmnlDenseDarkMuted },
  { id: 'tmnl-ultra-ops', label: 'Ultra Ops', variant: tmnlUltraOps },
  { id: 'tmnl-analyst-light', label: 'Analyst Light', variant: tmnlAnalystLight },
] as const

const DENSITY_TIERS: DensityTier[] = ['ultra', 'dense', 'normal', 'relaxed']

// =============================================================================
// FLASH CONTEXT TYPE (passed via AG-Grid context)
// =============================================================================

// Use TmnlGridContext from the library - extending with our custom data if needed
type GridContext = TmnlGridContext

// =============================================================================
// FLASH STYLE HELPER
// =============================================================================

function getFlashStyle(
  flashState: FlashState | undefined,
  variant: GridVariant
): React.CSSProperties {
  if (!flashState?.isActive) return {}

  const flashColors = variant.colors.flash
  if (!flashColors) return {}

  const baseColor = flashState.direction === 'up' ? flashColors.up : flashColors.down
  const duration = flashColors.durationMs

  // Severity-based intensity
  let opacity = 0
  let glowIntensity = 0

  switch (flashState.severity) {
    case 'low':
      opacity = 0.15
      break
    case 'medium':
      opacity = 0.25
      break
    case 'high':
      opacity = 0.4
      glowIntensity = 0.3
      break
    case 'critical':
      opacity = 0.5
      glowIntensity = 0.5
      break
  }

  const styles: React.CSSProperties = {
    backgroundColor: `${baseColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
    transition: `background-color ${duration}ms ease-out, box-shadow ${duration}ms ease-out`,
  }

  if (glowIntensity > 0) {
    styles.boxShadow = `inset 0 0 8px ${baseColor}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')}`
  }

  return styles
}

// =============================================================================
// CELL RENDERERS (variant-aware + flash-aware)
// =============================================================================

function createStatusRenderer(variant: GridVariant) {
  const statusColors = extractStatusColors(variant)

  return function StatusCellRenderer(params: ICellRendererParams) {
    const status = params.value as keyof typeof statusColors
    const color = statusColors[status] || statusColors.default

    // Get flash state from context
    const ctx = params.context as GridContext | undefined
    const flashState = ctx?.getFlashState(params.data?.id, 'status')
    const flashStyle = getFlashStyle(flashState, variant)

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          height: '100%',
          padding: '0 4px',
          margin: '0 -4px',
          ...flashStyle,
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

function createValueRenderer(variant: GridVariant) {
  return function ValueCellRenderer(params: ICellRendererParams) {
    const value = params.value as number
    const delta = params.data?.delta as number | undefined
    const intensity = Math.min(1, value / 100)

    // Get flash state from context
    const ctx = params.context as GridContext | undefined
    const flashState = ctx?.getFlashState(params.data?.id, 'value')
    const flashStyle = getFlashStyle(flashState, variant)

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
          margin: '0 -4px',
          ...flashStyle,
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

function createIdRenderer(variant: GridVariant) {
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
        style={{ fontSize: 10 }}
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
              ? 'border-white/30 bg-white/5'
              : 'border-neutral-800 hover:border-neutral-700'
            }
          `}
        >
          <div className="flex items-center justify-between">
            <span
              className={`font-mono uppercase tracking-wide ${
                selectedId === id ? 'text-white' : 'text-neutral-400'
              }`}
              style={{ fontSize: 11 }}
            >
              {label}
            </span>
            <div
              className="flex items-center gap-1"
              style={{ fontSize: 9 }}
            >
              <span className="text-neutral-600">{variant.densityTier}</span>
              <div
                className="w-2 h-2"
                style={{
                  backgroundColor: variant.colorScheme === 'dark'
                    ? '#1a1a1a'
                    : '#e5e5e5',
                  border: '1px solid',
                  borderColor: variant.colorScheme === 'dark'
                    ? '#333'
                    : '#ccc',
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
  value: DensityTier
  onChange: (tier: DensityTier) => void
}

function DensitySlider({ value, onChange }: DensitySliderProps) {
  const currentIndex = DENSITY_TIERS.indexOf(value)

  return (
    <div className="space-y-2">
      <div
        className="font-mono uppercase tracking-widest text-neutral-500"
        style={{ fontSize: 10 }}
      >
        Density Tier
      </div>

      <div className="flex items-center gap-1">
        {DENSITY_TIERS.map((tier, i) => {
          const preset = DENSITY_PRESETS[tier]
          const isSelected = tier === value

          return (
            <button
              key={tier}
              onClick={() => onChange(tier)}
              className={`
                flex-1 py-2 border transition-all text-center
                ${isSelected
                  ? 'border-white/30 bg-white/5'
                  : 'border-neutral-800 hover:border-neutral-700'
                }
              `}
            >
              <div
                className={`font-mono uppercase ${
                  isSelected ? 'text-white' : 'text-neutral-500'
                }`}
                style={{ fontSize: 9 }}
              >
                {tier}
              </div>
              <div
                className="text-neutral-600 mt-0.5"
                style={{ fontSize: 8 }}
              >
                {preset.rowHeight}px
              </div>
            </button>
          )
        })}
      </div>

      <div
        className="font-mono text-neutral-600 text-center"
        style={{ fontSize: 9 }}
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
  useCustomFlash: boolean
  onFlashModeChange: (useCustom: boolean) => void
}

function StreamControls({
  isStreaming,
  tick,
  updateCount,
  onToggle,
  onReset,
  intervalMs,
  onIntervalChange,
  useCustomFlash,
  onFlashModeChange,
}: StreamControlsProps) {
  return (
    <div className="space-y-2">
      <div
        className="font-mono uppercase tracking-widest text-neutral-500"
        style={{ fontSize: 10 }}
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
          <span className="font-mono uppercase" style={{ fontSize: 10 }}>
            {isStreaming ? 'Pause' : 'Start'}
          </span>
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 text-neutral-400 hover:border-neutral-600 transition-all"
        >
          <RotateCcw size={12} />
          <span className="font-mono uppercase" style={{ fontSize: 10 }}>
            Reset
          </span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-neutral-600" style={{ fontSize: 9 }}>
            INTERVAL
          </span>
          <select
            value={intervalMs}
            onChange={(e) => onIntervalChange(Number(e.target.value))}
            className="bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono px-2 py-1"
            style={{ fontSize: 10 }}
          >
            <option value={250}>250ms</option>
            <option value={500}>500ms</option>
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Activity size={10} className={isStreaming ? 'text-emerald-500' : 'text-neutral-600'} />
          <span className="font-mono text-neutral-500" style={{ fontSize: 9 }}>
            TICK {tick}
          </span>
          <span className="font-mono text-cyan-500" style={{ fontSize: 9 }}>
            +{updateCount}
          </span>
        </div>
      </div>

      {/* Flash Mode Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-800/50">
        <div className="flex items-center gap-2">
          <Zap size={10} className={useCustomFlash ? 'text-amber-400' : 'text-neutral-600'} />
          <span className="font-mono text-neutral-500" style={{ fontSize: 9 }}>
            FLASH MODE
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onFlashModeChange(false)}
            className={`
              px-2 py-1 border transition-all font-mono uppercase cursor-pointer
              ${!useCustomFlash
                ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                : 'border-neutral-800 text-neutral-500 hover:border-neutral-700'
              }
            `}
            style={{ fontSize: 9 }}
          >
            Native
          </button>
          <button
            type="button"
            onClick={() => onFlashModeChange(true)}
            className={`
              px-2 py-1 border transition-all font-mono uppercase cursor-pointer
              ${useCustomFlash
                ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                : 'border-neutral-800 text-neutral-500 hover:border-neutral-700'
              }
            `}
            style={{ fontSize: 9 }}
          >
            Severity
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// STATS PANEL
// =============================================================================

interface StatsPanelProps {
  variant: GridVariant
  rowCount: number
  tick: number
}

function StatsPanel({ variant, rowCount, tick }: StatsPanelProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="border border-neutral-800 p-2">
        <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
          Density
        </div>
        <div className="font-mono text-white" style={{ fontSize: 12 }}>
          {variant.densityTier}
        </div>
      </div>
      <div className="border border-neutral-800 p-2">
        <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
          Rows
        </div>
        <div className="font-mono text-white" style={{ fontSize: 12 }}>
          {rowCount}
        </div>
      </div>
      <div className="border border-neutral-800 p-2">
        <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
          Theme
        </div>
        <div className="font-mono text-white" style={{ fontSize: 12 }}>
          {variant.colorScheme}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// FLASH VISUALIZATION PANEL
// =============================================================================

interface FlashVisualizationProps {
  updates: readonly RowUpdate[]
  variant: GridVariant
  isActive: boolean
}

const SEVERITY_COLORS: Record<string, string> = {
  none: '#333',
  low: '#3b82f6',
  medium: '#8b5cf6',
  high: '#f59e0b',
  critical: '#ef4444',
}

function FlashVisualization({ updates, variant, isActive }: FlashVisualizationProps) {
  // Track recent flashes for visualization (last 20)
  const [recentFlashes, setRecentFlashes] = useState<Array<{
    id: string
    rowId: string
    field: string
    delta: number
    severity: string
    direction: 'up' | 'down'
    timestamp: number
  }>>([])

  // Update recent flashes when updates arrive
  useEffect(() => {
    if (!isActive || updates.length === 0) return

    const newFlashes = updates
      .filter(u => u.field === 'value' && typeof u.delta === 'number')
      .map(u => {
        const absDelta = Math.abs(u.delta ?? 0)
        let severity = 'none'
        if (absDelta > 0 && absDelta <= 5) severity = 'low'
        else if (absDelta <= 10) severity = 'medium'
        else if (absDelta <= 15) severity = 'high'
        else if (absDelta > 15) severity = 'critical'

        return {
          id: `${u.id}-${Date.now()}-${Math.random()}`,
          rowId: u.id,
          field: u.field,
          delta: u.delta ?? 0,
          severity,
          direction: (u.delta ?? 0) > 0 ? 'up' as const : 'down' as const,
          timestamp: Date.now(),
        }
      })

    if (newFlashes.length > 0) {
      setRecentFlashes(prev => [...newFlashes, ...prev].slice(0, 20))
    }
  }, [updates, isActive])

  // Count by severity
  const severityCounts = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 }
    recentFlashes.forEach(f => {
      if (f.severity in counts) {
        counts[f.severity as keyof typeof counts]++
      }
    })
    return counts
  }, [recentFlashes])

  const flashColors = variant.colors.flash

  return (
    <div className="space-y-3">
      <div
        className="font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-2"
        style={{ fontSize: 10 }}
      >
        <Activity size={12} className={isActive ? 'text-amber-400' : ''} />
        Flash Monitor
      </div>

      {/* Severity distribution */}
      <div className="grid grid-cols-4 gap-1">
        {(['low', 'medium', 'high', 'critical'] as const).map(sev => (
          <div
            key={sev}
            className="border p-1.5 text-center"
            style={{
              borderColor: severityCounts[sev] > 0 ? SEVERITY_COLORS[sev] : '#333',
              backgroundColor: severityCounts[sev] > 0 ? `${SEVERITY_COLORS[sev]}15` : 'transparent',
            }}
          >
            <div className="font-mono" style={{ fontSize: 14, color: SEVERITY_COLORS[sev] }}>
              {severityCounts[sev]}
            </div>
            <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 7 }}>
              {sev}
            </div>
          </div>
        ))}
      </div>

      {/* Flash color preview */}
      {flashColors && (
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 border border-neutral-800 p-2">
            <div
              className="w-3 h-3"
              style={{ backgroundColor: flashColors.up }}
            />
            <span className="font-mono text-neutral-500" style={{ fontSize: 9 }}>UP</span>
          </div>
          <div className="flex-1 flex items-center gap-2 border border-neutral-800 p-2">
            <div
              className="w-3 h-3"
              style={{ backgroundColor: flashColors.down }}
            />
            <span className="font-mono text-neutral-500" style={{ fontSize: 9 }}>DOWN</span>
          </div>
        </div>
      )}

      {/* Recent flash stream */}
      <div className="border border-neutral-800 max-h-32 overflow-y-auto">
        {recentFlashes.length === 0 ? (
          <div className="p-2 text-center">
            <span className="font-mono text-neutral-600" style={{ fontSize: 9 }}>
              {isActive ? 'Waiting for updates...' : 'Flash disabled'}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/50">
            {recentFlashes.slice(0, 8).map(flash => (
              <div
                key={flash.id}
                className="flex items-center justify-between px-2 py-1"
                style={{
                  backgroundColor: `${flash.direction === 'up' ? flashColors?.up : flashColors?.down}10`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: SEVERITY_COLORS[flash.severity] }}
                  />
                  <span className="font-mono text-neutral-400" style={{ fontSize: 9 }}>
                    {flash.rowId.slice(0, 8)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      color: flash.direction === 'up' ? flashColors?.up : flashColors?.down,
                    }}
                  >
                    {flash.direction === 'up' ? '+' : ''}{flash.delta.toFixed(1)}
                  </span>
                  <span
                    className="font-mono uppercase"
                    style={{ fontSize: 8, color: SEVERITY_COLORS[flash.severity] }}
                  >
                    {flash.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// COLUMN INTENT DEMO
// =============================================================================

interface IntentDemoRow {
  id: string
  identifier: string
  metric: number
  primaryMetric: number
  status: 'active' | 'pending' | 'inactive' | 'alert'
  severity: 1 | 2 | 3 | 4 | 5
  action: string
  text: string
  timestamp: Date
  sparkline: number[]
}

const INTENT_DEMO_DATA: IntentDemoRow[] = [
  {
    id: '1',
    identifier: 'TXN-001',
    metric: 42.5,
    primaryMetric: 87,
    status: 'active',
    severity: 1,
    action: 'view',
    text: 'Primary transaction record',
    timestamp: new Date('2024-12-04T10:30:00'),
    sparkline: [20, 35, 28, 45, 38, 52, 48],
  },
  {
    id: '2',
    identifier: 'TXN-002',
    metric: 128.3,
    primaryMetric: 45,
    status: 'pending',
    severity: 3,
    action: 'edit',
    text: 'Awaiting confirmation from upstream',
    timestamp: new Date('2024-12-04T09:15:00'),
    sparkline: [45, 42, 48, 35, 30, 28, 32],
  },
  {
    id: '3',
    identifier: 'TXN-003',
    metric: 7.8,
    primaryMetric: 92,
    status: 'active',
    severity: 2,
    action: 'view',
    text: 'High priority flagged item',
    timestamp: new Date('2024-12-04T11:00:00'),
    sparkline: [10, 25, 40, 55, 70, 85, 95],
  },
  {
    id: '4',
    identifier: 'TXN-004',
    metric: 256.0,
    primaryMetric: 23,
    status: 'alert',
    severity: 5,
    action: 'resolve',
    text: 'Critical: requires immediate attention',
    timestamp: new Date('2024-12-04T08:45:00'),
    sparkline: [80, 75, 60, 45, 30, 20, 15],
  },
  {
    id: '5',
    identifier: 'TXN-005',
    metric: 64.2,
    primaryMetric: 68,
    status: 'inactive',
    severity: 1,
    action: 'archive',
    text: 'Completed and archived transaction',
    timestamp: new Date('2024-12-03T16:30:00'),
    sparkline: [50, 52, 48, 51, 49, 50, 50],
  },
]

const SEVERITY_LABELS = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'SEVERE']
const SEVERITY_COLORS_MAP = ['', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#dc2626']

function createIntentColumnDefs(variant: GridVariant): ColDef[] {
  const statusColors = extractStatusColors(variant)

  return [
    // Drag handle
    {
      field: 'drag',
      headerName: '',
      width: INTENT_DEFAULTS.drag.width,
      suppressSizeToFit: true,
      cellRenderer: () => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'grab' }}>
          <span style={{ color: variant.colors.text.muted, fontSize: 10 }}>⋮⋮</span>
        </div>
      ),
    },
    // Identifier
    {
      field: 'identifier',
      headerName: 'ID',
      width: INTENT_DEFAULTS.identifier.width,
      suppressSizeToFit: true,
      cellStyle: {
        color: variant.colors.text.muted,
        fontSize: variant.density.fontSizeXs,
        fontFamily: 'monospace',
      },
    },
    // Text
    {
      field: 'text',
      headerName: 'Description',
      flex: 1,
      cellStyle: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
    },
    // Metric
    {
      field: 'metric',
      headerName: 'Metric',
      width: INTENT_DEFAULTS.metric.width,
      cellStyle: {
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      },
      valueFormatter: (p) => p.value?.toFixed(1),
    },
    // Primary Metric (with progress bar)
    {
      field: 'primaryMetric',
      headerName: 'Score',
      width: INTENT_DEFAULTS.primaryMetric.width,
      cellRenderer: (params: ICellRendererParams) => {
        const value = params.value as number
        const intensity = value / 100
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
            <div style={{ flex: 1, height: 4, backgroundColor: variant.colors.border.muted, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${value}%`,
                  height: '100%',
                  backgroundColor: variant.colors.signal.accent,
                  opacity: 0.3 + intensity * 0.7,
                }}
              />
            </div>
            <span style={{ fontSize: variant.density.fontSizeXs, color: variant.colors.text.primary, fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </span>
          </div>
        )
      },
    },
    // Status
    {
      field: 'status',
      headerName: 'Status',
      width: INTENT_DEFAULTS.status.width,
      cellRenderer: (params: ICellRendererParams) => {
        const status = params.value as keyof typeof statusColors
        const color = statusColors[status] || statusColors.default
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
            <div style={{ width: 5, height: 5, backgroundColor: color, boxShadow: `0 0 4px ${color}60` }} />
            <span style={{ color, fontSize: variant.density.fontSizeXs, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {params.value}
            </span>
          </div>
        )
      },
    },
    // Severity
    {
      field: 'severity',
      headerName: 'Level',
      width: INTENT_DEFAULTS.severity.width,
      cellRenderer: (params: ICellRendererParams) => {
        const level = params.value as number
        const color = SEVERITY_COLORS_MAP[level]
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
            <span style={{ color, fontSize: variant.density.fontSizeXs, fontWeight: 600 }}>
              {SEVERITY_LABELS[level]}
            </span>
          </div>
        )
      },
    },
    // Timestamp
    {
      field: 'timestamp',
      headerName: 'Time',
      width: INTENT_DEFAULTS.timestamp.width,
      cellStyle: {
        fontFamily: 'monospace',
        color: variant.colors.text.muted,
        fontSize: variant.density.fontSizeXs,
      },
      valueFormatter: (p) => {
        const d = p.value as Date
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      },
    },
    // Sparkline
    {
      field: 'sparkline',
      headerName: 'Trend',
      width: INTENT_DEFAULTS.sparkline.width,
      suppressSizeToFit: true,
      cellRenderer: (params: ICellRendererParams) => {
        const data = params.value as number[]
        const max = Math.max(...data)
        const min = Math.min(...data)
        const range = max - min || 1
        const width = 60
        const height = 16
        const points = data.map((v, i) => {
          const x = (i / (data.length - 1)) * width
          const y = height - ((v - min) / range) * height
          return `${x},${y}`
        }).join(' ')

        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <svg width={width} height={height} style={{ overflow: 'visible' }}>
              <polyline
                points={points}
                fill="none"
                stroke={variant.colors.signal.accent}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )
      },
    },
    // Action
    {
      field: 'action',
      headerName: '',
      width: INTENT_DEFAULTS.action.width,
      suppressSizeToFit: true,
      cellRenderer: (params: ICellRendererParams) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <button
            onClick={() => console.log('Action:', params.value, params.data)}
            style={{
              padding: '2px 6px',
              fontSize: variant.density.fontSizeXs,
              color: variant.colors.signal.accent,
              border: `1px solid ${variant.colors.signal.accent}40`,
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            ▸
          </button>
        </div>
      ),
    },
  ]
}

interface IntentDemoGridProps {
  variant: GridVariant
}

function IntentDemoGrid({ variant }: IntentDemoGridProps) {
  const columnDefs = useMemo(() => createIntentColumnDefs(variant), [variant])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-mono uppercase tracking-widest text-neutral-300" style={{ fontSize: 12 }}>
            Column Intent Demo
          </h2>
          <p className="font-mono text-neutral-600" style={{ fontSize: 10 }}>
            All 10 ColumnIntent types with semantic styling
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['drag', 'identifier', 'text', 'metric', 'primaryMetric', 'status', 'severity', 'timestamp', 'sparkline', 'action'] as ColumnIntent[]).map(intent => (
            <span
              key={intent}
              className="px-2 py-0.5 border border-neutral-700 font-mono text-neutral-500"
              style={{ fontSize: 8 }}
            >
              {intent}
            </span>
          ))}
        </div>
      </div>
      <TmnlDataGrid
        variant={variant}
        rowData={INTENT_DEMO_DATA}
        columnDefs={columnDefs}
        getRowId={(params) => params.data.id}
        className="flex-1 border"
      />
    </div>
  )
}

// =============================================================================
// VARIANT BUILDER COMPONENTS
// =============================================================================

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

function CollapsibleSection({ title, icon, isOpen, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="border border-neutral-800">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">{icon}</span>
          <span
            className="font-mono uppercase tracking-wide text-neutral-300"
            style={{ fontSize: 10 }}
          >
            {title}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown size={12} className="text-neutral-500" />
        ) : (
          <ChevronRight size={12} className="text-neutral-500" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-neutral-800 p-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

interface ColorInputProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function ColorInput({ label, value, onChange }: ColorInputProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-neutral-500" style={{ fontSize: 9 }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 border border-neutral-700"
          style={{ backgroundColor: value }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 bg-neutral-900 border border-neutral-800 text-neutral-300 px-2 py-1 font-mono"
          style={{ fontSize: 9 }}
        />
      </div>
    </div>
  )
}

interface SelectInputProps<T extends string> {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
}

function SelectInput<T extends string>({ label, value, options, onChange }: SelectInputProps<T>) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-neutral-500" style={{ fontSize: 9 }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-neutral-900 border border-neutral-800 text-neutral-300 px-2 py-1 font-mono"
        style={{ fontSize: 9 }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}

interface ToggleInputProps {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}

function ToggleInput({ label, value, onChange }: ToggleInputProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-neutral-500" style={{ fontSize: 9 }}>
        {label}
      </span>
      <button
        onClick={() => onChange(!value)}
        className={`
          w-8 h-4 rounded-full transition-colors relative
          ${value ? 'bg-cyan-500/50' : 'bg-neutral-700'}
        `}
      >
        <div
          className={`
            absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform
            ${value ? 'translate-x-4' : 'translate-x-0.5'}
          `}
        />
      </button>
    </div>
  )
}

interface NumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}

function NumberInput({ label, value, onChange, min, max, step = 1, unit }: NumberInputProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-neutral-500" style={{ fontSize: 9 }}>
        {label}
      </span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-14 bg-neutral-900 border border-neutral-800 text-neutral-300 px-2 py-1 font-mono text-right"
          style={{ fontSize: 9 }}
        />
        {unit && (
          <span className="font-mono text-neutral-600" style={{ fontSize: 8 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// VARIANT BUILDER PANEL
// =============================================================================

interface VariantBuilderProps {
  variant: GridVariant
  onChange: (updates: Partial<GridVariant>) => void
}

function VariantBuilder({ variant, onChange }: VariantBuilderProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    colors: true,
    behavior: false,
    typography: false,
  })

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Helper to update nested color
  const updateColor = (category: 'background' | 'text' | 'signal' | 'border', key: string, value: string) => {
    onChange({
      colors: {
        ...variant.colors,
        [category]: {
          ...variant.colors[category],
          [key]: value,
        },
      },
    })
  }

  // Helper to update behavior
  const updateBehavior = <K extends keyof typeof variant.behavior>(
    key: K,
    value: typeof variant.behavior[K]
  ) => {
    onChange({
      behavior: {
        ...variant.behavior,
        [key]: value,
      },
    })
  }

  // Helper to update micro interactions
  const updateMicroInteraction = <K extends keyof typeof variant.behavior.microInteractions>(
    key: K,
    value: typeof variant.behavior.microInteractions[K]
  ) => {
    onChange({
      behavior: {
        ...variant.behavior,
        microInteractions: {
          ...variant.behavior.microInteractions,
          [key]: value,
        },
      },
    })
  }

  return (
    <div className="space-y-2">
      <div
        className="font-mono uppercase tracking-widest text-neutral-500 mb-2 flex items-center gap-2"
        style={{ fontSize: 10 }}
      >
        <Settings2 size={12} />
        Variant Builder
      </div>

      {/* Colors Section */}
      <CollapsibleSection
        title="Colors"
        icon={<Palette size={12} />}
        isOpen={openSections.colors}
        onToggle={() => toggleSection('colors')}
      >
        <div className="space-y-2">
          <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
            Background
          </div>
          <ColorInput
            label="BASE"
            value={variant.colors.background.base}
            onChange={(v) => updateColor('background', 'base', v)}
          />
          <ColorInput
            label="HEADER"
            value={variant.colors.background.header}
            onChange={(v) => updateColor('background', 'header', v)}
          />
          <ColorInput
            label="HOVER"
            value={variant.colors.background.hover}
            onChange={(v) => updateColor('background', 'hover', v)}
          />
          <ColorInput
            label="SELECTED"
            value={variant.colors.background.selected}
            onChange={(v) => updateColor('background', 'selected', v)}
          />

          <div className="border-t border-neutral-800 my-2" />

          <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
            Text
          </div>
          <ColorInput
            label="PRIMARY"
            value={variant.colors.text.primary}
            onChange={(v) => updateColor('text', 'primary', v)}
          />
          <ColorInput
            label="SECONDARY"
            value={variant.colors.text.secondary}
            onChange={(v) => updateColor('text', 'secondary', v)}
          />
          <ColorInput
            label="MUTED"
            value={variant.colors.text.muted}
            onChange={(v) => updateColor('text', 'muted', v)}
          />

          <div className="border-t border-neutral-800 my-2" />

          <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
            Signals
          </div>
          <ColorInput
            label="POSITIVE"
            value={variant.colors.signal.positive}
            onChange={(v) => updateColor('signal', 'positive', v)}
          />
          <ColorInput
            label="NEGATIVE"
            value={variant.colors.signal.negative}
            onChange={(v) => updateColor('signal', 'negative', v)}
          />
          <ColorInput
            label="ACCENT"
            value={variant.colors.signal.accent}
            onChange={(v) => updateColor('signal', 'accent', v)}
          />
        </div>
      </CollapsibleSection>

      {/* Behavior Section */}
      <CollapsibleSection
        title="Behavior"
        icon={<MousePointer2 size={12} />}
        isOpen={openSections.behavior}
        onToggle={() => toggleSection('behavior')}
      >
        <div className="space-y-2">
          <SelectInput
            label="SELECTION"
            value={variant.behavior.selection}
            options={['single', 'multiple', 'none'] as const}
            onChange={(v) => updateBehavior('selection', v as SelectionModeType)}
          />
          <SelectInput
            label="HOVER"
            value={variant.behavior.hover}
            options={['row', 'cell', 'none'] as const}
            onChange={(v) => updateBehavior('hover', v as HoverModeType)}
          />
          <SelectInput
            label="FOCUS"
            value={variant.behavior.focus}
            options={['cell', 'row', 'none'] as const}
            onChange={(v) => updateBehavior('focus', v as FocusModeType)}
          />
          <SelectInput
            label="EDIT TRIGGER"
            value={variant.behavior.editTrigger}
            options={['click', 'doubleClick', 'enter', 'none'] as const}
            onChange={(v) => updateBehavior('editTrigger', v as EditTriggerType)}
          />
          <SelectInput
            label="KEYBOARD NAV"
            value={variant.behavior.keyboardNav}
            options={['standard', 'vim', 'none'] as const}
            onChange={(v) => updateBehavior('keyboardNav', v as KeyboardNavModeType)}
          />

          <div className="border-t border-neutral-800 my-2" />

          <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
            Micro Interactions
          </div>
          <ToggleInput
            label="ANIMATE ROWS"
            value={variant.behavior.microInteractions.animateRows}
            onChange={(v) => updateMicroInteraction('animateRows', v)}
          />
          <ToggleInput
            label="CELL FLASH"
            value={variant.behavior.microInteractions.enableCellFlash}
            onChange={(v) => updateMicroInteraction('enableCellFlash', v)}
          />
          <SelectInput
            label="HOVER ROW"
            value={variant.behavior.microInteractions.hoverRow}
            options={['none', 'subtleFill', 'underline', 'glow'] as const}
            onChange={(v) => updateMicroInteraction('hoverRow', v)}
          />
          <SelectInput
            label="FOCUS OUTLINE"
            value={variant.behavior.microInteractions.focusOutline}
            options={['none', 'subtle', 'strong', 'accent'] as const}
            onChange={(v) => updateMicroInteraction('focusOutline', v)}
          />
        </div>
      </CollapsibleSection>

      {/* Typography Section */}
      <CollapsibleSection
        title="Typography"
        icon={<Type size={12} />}
        isOpen={openSections.typography}
        onToggle={() => toggleSection('typography')}
      >
        <div className="space-y-2">
          <NumberInput
            label="ROW HEIGHT"
            value={variant.density.rowHeight}
            onChange={(v) =>
              onChange({
                density: { ...variant.density, rowHeight: v },
              })
            }
            min={12}
            max={64}
            unit="px"
          />
          <NumberInput
            label="HEADER HEIGHT"
            value={variant.density.headerHeight}
            onChange={(v) =>
              onChange({
                density: { ...variant.density, headerHeight: v },
              })
            }
            min={16}
            max={72}
            unit="px"
          />
          <NumberInput
            label="FONT SIZE"
            value={variant.density.fontSize}
            onChange={(v) =>
              onChange({
                density: { ...variant.density, fontSize: v },
              })
            }
            min={8}
            max={24}
            unit="px"
          />
          <NumberInput
            label="FONT SIZE XS"
            value={variant.density.fontSizeXs}
            onChange={(v) =>
              onChange({
                density: { ...variant.density, fontSizeXs: v },
              })
            }
            min={8}
            max={20}
            unit="px"
          />
          <NumberInput
            label="CELL PADDING H"
            value={variant.density.cellPaddingH}
            onChange={(v) =>
              onChange({
                density: { ...variant.density, cellPaddingH: v },
              })
            }
            min={0}
            max={24}
            unit="px"
          />
          <NumberInput
            label="CELL PADDING V"
            value={variant.density.cellPaddingV}
            onChange={(v) =>
              onChange({
                density: { ...variant.density, cellPaddingV: v },
              })
            }
            min={0}
            max={24}
            unit="px"
          />
        </div>
      </CollapsibleSection>

      {/* Preset Buttons */}
      <div className="space-y-2 pt-2">
        <div className="font-mono text-neutral-600 uppercase" style={{ fontSize: 8 }}>
          Behavior Presets
        </div>
        <div className="grid grid-cols-2 gap-1">
          {Object.keys(BEHAVIOR_PRESETS).map((presetKey) => (
            <button
              key={presetKey}
              onClick={() =>
                onChange({
                  behavior: BEHAVIOR_PRESETS[presetKey as keyof typeof BEHAVIOR_PRESETS],
                })
              }
              className="px-2 py-1 border border-neutral-800 hover:border-neutral-700 text-neutral-500 hover:text-white transition-colors"
            >
              <span className="font-mono uppercase" style={{ fontSize: 8 }}>
                {presetKey}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN TESTBED
// =============================================================================

type ViewMode = 'streaming' | 'intents' | 'compare'

export function DataGridVariantTestbed() {
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('streaming')

  // Variant state
  const [selectedVariantId, setSelectedVariantId] = useState('tmnl-dense-dark')
  const [densityOverride, setDensityOverride] = useState<DensityTier | null>(null)
  const [customOverrides, setCustomOverrides] = useState<Partial<GridVariant> | null>(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [useCustomFlash, setUseCustomFlash] = useState(true) // Toggle hybrid flash

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

  // Grid ref
  const gridRef = useRef<TmnlDataGridHandle>(null)

  // Compute active variant (with optional density override + custom overrides)
  const activeVariant = useMemo(() => {
    const base = GRID_VARIANTS[selectedVariantId] ?? tmnlDenseDark

    let result = { ...base }

    // Apply density override
    if (densityOverride && densityOverride !== base.densityTier) {
      result = {
        ...result,
        densityTier: densityOverride,
        density: DENSITY_PRESETS[densityOverride],
      }
    }

    // Apply custom overrides from builder
    if (customOverrides) {
      result = {
        ...result,
        ...customOverrides,
        colors: customOverrides.colors
          ? {
              background: { ...result.colors.background, ...customOverrides.colors.background },
              text: { ...result.colors.text, ...customOverrides.colors.text },
              signal: { ...result.colors.signal, ...customOverrides.colors.signal },
              border: { ...result.colors.border, ...customOverrides.colors.border },
              flash: customOverrides.colors.flash ?? result.colors.flash,
            }
          : result.colors,
        behavior: customOverrides.behavior
          ? {
              ...result.behavior,
              ...customOverrides.behavior,
              microInteractions: {
                ...result.behavior.microInteractions,
                ...customOverrides.behavior.microInteractions,
              },
              resize: { ...result.behavior.resize, ...customOverrides.behavior.resize },
              sort: { ...result.behavior.sort, ...customOverrides.behavior.sort },
              drag: { ...result.behavior.drag, ...customOverrides.behavior.drag },
            }
          : result.behavior,
        density: customOverrides.density
          ? { ...result.density, ...customOverrides.density }
          : result.density,
      }
    }

    return result
  }, [selectedVariantId, densityOverride, customOverrides])

  // Compare variant (for compare mode)
  const compareVariant = useMemo(() => {
    return GRID_VARIANTS[compareVariantId] ?? tmnlUltraOps
  }, [compareVariantId])

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
    setDensityOverride(null) // Reset density override when changing variant
    setCustomOverrides(null) // Reset custom overrides when changing variant
  }, [])

  // Handle custom override from builder
  const handleCustomOverride = useCallback((updates: Partial<GridVariant>) => {
    setCustomOverrides((prev) => {
      if (!prev) return updates
      return {
        ...prev,
        ...updates,
      }
    })
  }, [])

  // Resize columns on variant change
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.sizeColumnsToFit()
    }
  }, [activeVariant])

  // Refresh cells when flash mode changes (context update doesn't auto-refresh)
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ force: true })
    }
  }, [useCustomFlash])

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
              <h1 className="font-mono uppercase tracking-widest text-neutral-300" style={{ fontSize: 12 }}>
                DataGrid Variant Testbed
              </h1>
              <p className="font-mono text-neutral-600" style={{ fontSize: 10 }}>
                Live streaming · Density tiers · Full variant builder
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
                style={{ fontSize: 9 }}
              >
                <div className="flex items-center gap-1.5">
                  <Activity size={10} />
                  Stream
                </div>
              </button>
              <button
                onClick={() => setViewMode('intents')}
                className={`
                  px-3 py-1.5 transition-all font-mono uppercase
                  ${viewMode === 'intents'
                    ? 'bg-emerald-500/10 text-emerald-400 border-r border-emerald-500/30'
                    : 'text-neutral-500 hover:text-white border-r border-neutral-800'
                  }
                `}
                style={{ fontSize: 9 }}
              >
                <div className="flex items-center gap-1.5">
                  <Layers size={10} />
                  Intents
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
                style={{ fontSize: 9 }}
              >
                <div className="flex items-center gap-1.5">
                  <Palette size={10} />
                  Compare
                </div>
              </button>
            </div>

            <div className="w-px h-4 bg-neutral-800" />

            <button
              onClick={() => setShowBuilder(!showBuilder)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 border transition-all
                ${showBuilder
                  ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                  : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                }
              `}
            >
              <Sliders size={12} />
              <span className="font-mono uppercase" style={{ fontSize: 10 }}>
                Builder
              </span>
            </button>
            <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-700'}`} />
            <span className="font-mono text-neutral-500 uppercase" style={{ fontSize: 10 }}>
              {activeVariant.id}
              {customOverrides && ' (modified)'}
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
              useCustomFlash={useCustomFlash}
              onFlashModeChange={setUseCustomFlash}
            />

            <div className="border-t border-neutral-800" />

            {/* Stats */}
            <StatsPanel
              variant={activeVariant}
              rowCount={rows.length}
              tick={tick}
            />

            <div className="border-t border-neutral-800" />

            {/* Flash visualization */}
            <FlashVisualization
              updates={lastUpdates}
              variant={activeVariant}
              isActive={useCustomFlash}
            />
          </div>
        </aside>

        {/* Center panel: content based on view mode */}
        <main className="flex-1 p-6 overflow-hidden">
          {viewMode === 'streaming' && (
            <TmnlDataGrid
              ref={gridRef}
              variant={activeVariant}
              rowData={rows as MockRow[]}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={(params) => params.data.id}
              flash={{
                enabled: useCustomFlash,
                updates: lastUpdates,
                maxDelta: 20,
                expirationMs: 1500,
              }}
              className="h-full border"
            />
          )}

          {viewMode === 'intents' && (
            <IntentDemoGrid variant={activeVariant} />
          )}

          {viewMode === 'compare' && (
            <div className="h-full flex flex-col">
              {/* Compare header with variant selectors */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-800">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-cyan-500" />
                    <span className="font-mono uppercase text-neutral-300" style={{ fontSize: 11 }}>
                      Variant A
                    </span>
                    <select
                      value={selectedVariantId}
                      onChange={(e) => handleVariantChange(e.target.value)}
                      className="bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono px-2 py-1"
                      style={{ fontSize: 10 }}
                    >
                      {VARIANT_LIST.map(v => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="text-neutral-600 font-mono" style={{ fontSize: 10 }}>VS</div>

                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500" />
                    <span className="font-mono uppercase text-neutral-300" style={{ fontSize: 11 }}>
                      Variant B
                    </span>
                    <select
                      value={compareVariantId}
                      onChange={(e) => setCompareVariantId(e.target.value)}
                      className="bg-neutral-900 border border-neutral-700 text-neutral-300 font-mono px-2 py-1"
                      style={{ fontSize: 10 }}
                    >
                      {VARIANT_LIST.map(v => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 font-mono text-neutral-600" style={{ fontSize: 9 }}>
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
                    <span className="font-mono uppercase text-cyan-400" style={{ fontSize: 10 }}>
                      {activeVariant.id}
                    </span>
                    <span className="font-mono text-neutral-600" style={{ fontSize: 9 }}>
                      {activeVariant.densityTier} · {activeVariant.colorScheme}
                    </span>
                  </div>
                  <TmnlDataGrid
                    variant={activeVariant}
                    rowData={rows as MockRow[]}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    getRowId={(params) => params.data.id}
                    flash={{ enabled: useCustomFlash, updates: lastUpdates }}
                    className="flex-1 border min-h-0"
                  />
                </div>

                {/* Variant B */}
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-amber-500" />
                    <span className="font-mono uppercase text-amber-400" style={{ fontSize: 10 }}>
                      {compareVariant.id}
                    </span>
                    <span className="font-mono text-neutral-600" style={{ fontSize: 9 }}>
                      {compareVariant.densityTier} · {compareVariant.colorScheme}
                    </span>
                  </div>
                  <TmnlDataGrid
                    variant={compareVariant}
                    rowData={rows as MockRow[]}
                    columnDefs={compareColumnDefs}
                    defaultColDef={defaultColDef}
                    getRowId={(params) => params.data.id}
                    className="flex-1 border min-h-0"
                  />
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right panel: variant builder (collapsible) */}
        {showBuilder && (
          <aside className="w-80 border-l border-neutral-800 bg-neutral-900/30 p-4 overflow-y-auto">
            <VariantBuilder
              variant={activeVariant}
              onChange={handleCustomOverride}
            />

            {/* Reset button */}
            {customOverrides && (
              <div className="mt-4 pt-4 border-t border-neutral-800">
                <button
                  onClick={() => setCustomOverrides(null)}
                  className="w-full px-3 py-2 border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <span className="font-mono uppercase" style={{ fontSize: 10 }}>
                    Reset to Base Variant
                  </span>
                </button>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
