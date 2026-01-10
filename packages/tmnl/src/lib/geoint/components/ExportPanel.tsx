/**
 * ExportPanel - Data Export Interface
 *
 * Comprehensive export functionality:
 * - Multiple format support (GeoJSON, KML, CSV, PNG, PDF)
 * - Entity selection (all, visible, selected)
 * - Format-specific options
 * - Live preview
 * - Progress tracking
 *
 * Compound component architecture:
 * - ExportPanel.Root - Container with export state
 * - ExportPanel.Header - Title and close button
 * - ExportPanel.FormatSelector - Format type selection
 * - ExportPanel.EntityScope - What to export
 * - ExportPanel.FormatOptions - Format-specific settings
 * - ExportPanel.Preview - Live preview of export
 * - ExportPanel.Progress - Export progress indicator
 * - ExportPanel.Actions - Export/cancel buttons
 *
 * @module geoint/components/ExportPanel
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  useMemo,
  type FC,
  type ReactNode,
} from 'react'
import { animate } from 'animejs'
import {
  Download,
  X,
  FileJson,
  FileText,
  Image,
  FileSpreadsheet,
  Check,
  ChevronDown,
  Eye,
  MousePointer,
  Globe,
  Settings2,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING, STATUS_COLORS } from '../tokens'
import type { SearchResultItem } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

/** Supported export formats */
export type ExportFormat = 'geojson' | 'kml' | 'csv' | 'png' | 'pdf'

/** Entity selection scope */
export type EntityScope = 'all' | 'visible' | 'selected'

/** Export status */
export type ExportStatus = 'idle' | 'preparing' | 'exporting' | 'complete' | 'error'

/** GeoJSON export options */
export interface GeoJSONOptions {
  /** Include properties */
  includeProperties: boolean
  /** Pretty print JSON */
  prettyPrint: boolean
  /** Coordinate precision (decimal places) */
  precision: number
}

/** KML export options */
export interface KMLOptions {
  /** Include styles */
  includeStyles: boolean
  /** Include descriptions */
  includeDescriptions: boolean
  /** Use folders for categories */
  useFolders: boolean
}

/** CSV export options */
export interface CSVOptions {
  /** Delimiter character */
  delimiter: ',' | ';' | '\t'
  /** Include header row */
  includeHeader: boolean
  /** Fields to include */
  fields: readonly string[]
}

/** PNG export options */
export interface PNGOptions {
  /** Image width */
  width: number
  /** Image height */
  height: number
  /** Include legend */
  includeLegend: boolean
  /** Include scale bar */
  includeScaleBar: boolean
  /** Background style */
  background: 'transparent' | 'white' | 'dark'
}

/** PDF export options */
export interface PDFOptions {
  /** Page size */
  pageSize: 'A4' | 'letter' | 'A3'
  /** Page orientation */
  orientation: 'portrait' | 'landscape'
  /** Include map */
  includeMap: boolean
  /** Include entity table */
  includeTable: boolean
  /** Include statistics */
  includeStats: boolean
}

/** Union of all format options */
export type FormatOptions = GeoJSONOptions | KMLOptions | CSVOptions | PNGOptions | PDFOptions

/** Export configuration */
export interface ExportConfig {
  /** Selected format */
  format: ExportFormat
  /** Entity scope */
  scope: EntityScope
  /** Format-specific options */
  options: FormatOptions
}

/** Export result */
export interface ExportResult {
  /** Success status */
  success: boolean
  /** Output filename */
  filename?: string
  /** Output URL/blob */
  url?: string
  /** Error message */
  error?: string
  /** Entity count */
  entityCount?: number
  /** File size in bytes */
  fileSize?: number
}

// =============================================================================
// FORMAT METADATA
// =============================================================================

interface FormatMeta {
  id: ExportFormat
  label: string
  description: string
  icon: typeof FileJson
  extension: string
  mimeType: string
}

const FORMAT_META: readonly FormatMeta[] = [
  {
    id: 'geojson',
    label: 'GeoJSON',
    description: 'Geographic data interchange format',
    icon: FileJson,
    extension: '.geojson',
    mimeType: 'application/geo+json',
  },
  {
    id: 'kml',
    label: 'KML',
    description: 'Keyhole Markup Language (Google Earth)',
    icon: Globe,
    extension: '.kml',
    mimeType: 'application/vnd.google-earth.kml+xml',
  },
  {
    id: 'csv',
    label: 'CSV',
    description: 'Comma-separated values spreadsheet',
    icon: FileSpreadsheet,
    extension: '.csv',
    mimeType: 'text/csv',
  },
  {
    id: 'png',
    label: 'PNG Image',
    description: 'Map screenshot as image',
    icon: Image,
    extension: '.png',
    mimeType: 'image/png',
  },
  {
    id: 'pdf',
    label: 'PDF Report',
    description: 'Formatted document with map and data',
    icon: FileText,
    extension: '.pdf',
    mimeType: 'application/pdf',
  },
]

// =============================================================================
// DEFAULT OPTIONS
// =============================================================================

const DEFAULT_GEOJSON_OPTIONS: GeoJSONOptions = {
  includeProperties: true,
  prettyPrint: true,
  precision: 6,
}

const DEFAULT_KML_OPTIONS: KMLOptions = {
  includeStyles: true,
  includeDescriptions: true,
  useFolders: true,
}

const DEFAULT_CSV_OPTIONS: CSVOptions = {
  delimiter: ',',
  includeHeader: true,
  fields: ['id', 'name', 'type', 'latitude', 'longitude', 'timestamp'],
}

const DEFAULT_PNG_OPTIONS: PNGOptions = {
  width: 1920,
  height: 1080,
  includeLegend: true,
  includeScaleBar: true,
  background: 'dark',
}

const DEFAULT_PDF_OPTIONS: PDFOptions = {
  pageSize: 'A4',
  orientation: 'landscape',
  includeMap: true,
  includeTable: true,
  includeStats: true,
}

function getDefaultOptions(format: ExportFormat): FormatOptions {
  switch (format) {
    case 'geojson':
      return { ...DEFAULT_GEOJSON_OPTIONS }
    case 'kml':
      return { ...DEFAULT_KML_OPTIONS }
    case 'csv':
      return { ...DEFAULT_CSV_OPTIONS }
    case 'png':
      return { ...DEFAULT_PNG_OPTIONS }
    case 'pdf':
      return { ...DEFAULT_PDF_OPTIONS }
  }
}

// =============================================================================
// CONTEXT
// =============================================================================

export interface ExportContextValue {
  /** Current format */
  format: ExportFormat
  /** Set format */
  setFormat: (format: ExportFormat) => void
  /** Entity scope */
  scope: EntityScope
  /** Set scope */
  setScope: (scope: EntityScope) => void
  /** Format options */
  options: FormatOptions
  /** Set options */
  setOptions: (options: FormatOptions) => void
  /** Export status */
  status: ExportStatus
  /** Export progress (0-100) */
  progress: number
  /** Error message */
  error: string | null
  /** Available entities */
  entities: readonly SearchResultItem[]
  /** Filtered entities based on scope */
  filteredEntities: readonly SearchResultItem[]
  /** Selected entity IDs */
  selectedIds: ReadonlySet<string>
  /** Visible entity IDs */
  visibleIds: ReadonlySet<string>
  /** Start export */
  startExport: () => void
  /** Cancel export */
  cancelExport: () => void
  /** Compact mode */
  compact: boolean
}

const ExportContext = createContext<ExportContextValue | null>(null)

export const useExport = () => {
  const ctx = useContext(ExportContext)
  if (!ctx) throw new Error('useExport must be used within ExportPanel.Root')
  return ctx
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

export interface ExportPanelRootProps {
  /** Available entities */
  entities: readonly SearchResultItem[]
  /** Selected entity IDs */
  selectedIds?: ReadonlySet<string>
  /** Visible entity IDs */
  visibleIds?: ReadonlySet<string>
  /** Export handler */
  onExport?: (config: ExportConfig, entities: readonly SearchResultItem[]) => Promise<ExportResult>
  /** Close handler */
  onClose?: () => void
  /** Initial format */
  initialFormat?: ExportFormat
  /** Compact mode */
  compact?: boolean
  /** Additional class */
  className?: string
  /** Children */
  children?: ReactNode
}

const Root: FC<ExportPanelRootProps> = memo(function Root({
  entities,
  selectedIds = new Set<string>(),
  visibleIds = new Set<string>(),
  onExport,
  onClose,
  initialFormat = 'geojson',
  compact = false,
  className,
  children,
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  // State
  const [format, setFormat] = useState<ExportFormat>(initialFormat)
  const [scope, setScope] = useState<EntityScope>('visible')
  const [options, setOptions] = useState<FormatOptions>(() => getDefaultOptions(initialFormat))
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Update options when format changes
  useEffect(() => {
    setOptions(getDefaultOptions(format))
  }, [format])

  // Filter entities based on scope
  const filteredEntities = useMemo(() => {
    switch (scope) {
      case 'all':
        return entities
      case 'visible':
        return entities.filter(e => {
          const id = getEntityId(e)
          return visibleIds.has(id)
        })
      case 'selected':
        return entities.filter(e => {
          const id = getEntityId(e)
          return selectedIds.has(id)
        })
    }
  }, [entities, scope, selectedIds, visibleIds])

  // Start export
  const startExport = useCallback(async () => {
    if (!onExport) return

    setStatus('preparing')
    setProgress(0)
    setError(null)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 90))
      }, 200)

      setStatus('exporting')
      const result = await onExport({ format, scope, options }, filteredEntities)

      clearInterval(progressInterval)

      if (result.success) {
        setProgress(100)
        setStatus('complete')

        // Auto-close after success
        setTimeout(() => {
          onClose?.()
        }, 1500)
      } else {
        setError(result.error ?? 'Export failed')
        setStatus('error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }, [onExport, format, scope, options, filteredEntities, onClose])

  // Cancel export
  const cancelExport = useCallback(() => {
    setStatus('idle')
    setProgress(0)
    setError(null)
  }, [])

  // Entrance animation
  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        translateY: [10, 0],
        duration: TIMING.normal,
        easing: EASING.anime.out,
      })
    }
  }, [])

  const value: ExportContextValue = {
    format,
    setFormat,
    scope,
    setScope,
    options,
    setOptions,
    status,
    progress,
    error,
    entities,
    filteredEntities,
    selectedIds,
    visibleIds,
    startExport,
    cancelExport,
    compact,
  }

  return (
    <ExportContext.Provider value={value}>
      <div
        ref={containerRef}
        className={cn(
          'bg-surface-1 border border-border-subtle rounded-lg shadow-lg overflow-hidden',
          compact ? 'w-72' : 'w-96',
          className
        )}
      >
        {children}
      </div>
    </ExportContext.Provider>
  )
})

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getEntityId(entity: SearchResultItem): string {
  switch (entity._tag) {
    case 'SearchResultPoi':
      return entity.poiId
    case 'SearchResultTrack':
      return entity.trackId
    case 'SearchResultFlight':
      return entity.icao24
    case 'SearchResultFeature':
      return entity.featureId
    case 'SearchResultWeather':
      return entity.id
    case 'SearchResultImagery':
      return entity.itemId
  }
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

export interface HeaderProps {
  /** Title */
  title?: string
  /** Close handler */
  onClose?: () => void
  /** Additional class */
  className?: string
}

const Header: FC<HeaderProps> = memo(function Header({
  title = 'Export Data',
  onClose,
  className,
}) {
  const { compact } = useExport()

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border-subtle',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Download className={cn(compact ? 'w-4 h-4' : 'w-5 h-5', 'text-accent-primary')} />
        <span className={cn('font-medium text-text-primary', compact ? 'text-sm' : 'text-base')}>
          {title}
        </span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 hover:bg-surface-2 rounded text-text-tertiary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
})

// =============================================================================
// FORMAT SELECTOR COMPONENT
// =============================================================================

export interface FormatSelectorProps {
  /** Additional class */
  className?: string
}

const FormatSelector: FC<FormatSelectorProps> = memo(function FormatSelector({ className }) {
  const { format, setFormat, compact } = useExport()

  return (
    <div className={cn('space-y-2', compact ? 'px-3 py-2' : 'px-4 py-3', className)}>
      <div className="text-xs text-text-tertiary uppercase font-mono">Format</div>
      <div className="grid grid-cols-5 gap-1">
        {FORMAT_META.map(meta => {
          const Icon = meta.icon
          const isSelected = format === meta.id
          return (
            <button
              key={meta.id}
              onClick={() => setFormat(meta.id)}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors',
                isSelected
                  ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/50'
                  : 'bg-surface-2 text-text-secondary hover:bg-surface-3 border border-transparent'
              )}
              title={meta.description}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{meta.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </div>
      <div className="text-xs text-text-tertiary">
        {FORMAT_META.find(m => m.id === format)?.description}
      </div>
    </div>
  )
})

// =============================================================================
// ENTITY SCOPE COMPONENT
// =============================================================================

export interface EntityScopeProps {
  /** Additional class */
  className?: string
}

const EntityScopeComponent: FC<EntityScopeProps> = memo(function EntityScopeComponent({ className }) {
  const { scope, setScope, entities, filteredEntities, selectedIds, visibleIds, compact } = useExport()

  const scopes: Array<{ id: EntityScope; label: string; icon: typeof Globe; count: number }> = [
    { id: 'all', label: 'All', icon: Globe, count: entities.length },
    { id: 'visible', label: 'Visible', icon: Eye, count: visibleIds.size },
    { id: 'selected', label: 'Selected', icon: MousePointer, count: selectedIds.size },
  ]

  return (
    <div className={cn('space-y-2', compact ? 'px-3 py-2' : 'px-4 py-3', className)}>
      <div className="text-xs text-text-tertiary uppercase font-mono">Include</div>
      <div className="space-y-1">
        {scopes.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setScope(id)}
            disabled={count === 0}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              scope === id
                ? 'bg-accent-primary/20 text-text-primary border border-accent-primary/50'
                : count > 0
                  ? 'bg-surface-2 text-text-secondary hover:bg-surface-3 border border-transparent'
                  : 'bg-surface-2 text-text-tertiary cursor-not-allowed border border-transparent opacity-50'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className={cn('flex-1 text-left', compact ? 'text-xs' : 'text-sm')}>{label}</span>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-mono',
                scope === id ? 'bg-accent-primary/30' : 'bg-surface-3'
              )}
            >
              {count}
            </span>
          </button>
        ))}
      </div>
      <div className="text-xs text-text-tertiary">
        {filteredEntities.length} entities will be exported
      </div>
    </div>
  )
})

// =============================================================================
// FORMAT OPTIONS COMPONENT
// =============================================================================

export interface FormatOptionsProps {
  /** Additional class */
  className?: string
}

const FormatOptionsComponent: FC<FormatOptionsProps> = memo(function FormatOptionsComponent({
  className,
}) {
  const { format, options, setOptions, compact } = useExport()
  const [isOpen, setIsOpen] = useState(false)

  const renderOptions = () => {
    switch (format) {
      case 'geojson':
        return <GeoJSONOptionsForm options={options as GeoJSONOptions} onChange={setOptions} />
      case 'kml':
        return <KMLOptionsForm options={options as KMLOptions} onChange={setOptions} />
      case 'csv':
        return <CSVOptionsForm options={options as CSVOptions} onChange={setOptions} />
      case 'png':
        return <PNGOptionsForm options={options as PNGOptions} onChange={setOptions} />
      case 'pdf':
        return <PDFOptionsForm options={options as PDFOptions} onChange={setOptions} />
    }
  }

  return (
    <div className={cn('border-t border-border-subtle', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between text-text-secondary hover:bg-surface-2 transition-colors',
          compact ? 'px-3 py-2' : 'px-4 py-3'
        )}
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          <span className={cn(compact ? 'text-xs' : 'text-sm')}>Format Options</span>
        </div>
        <ChevronDown
          className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
        />
      </button>
      {isOpen && (
        <div className={cn('border-t border-border-subtle', compact ? 'px-3 py-2' : 'px-4 py-3')}>
          {renderOptions()}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// FORMAT-SPECIFIC OPTION FORMS
// =============================================================================

const GeoJSONOptionsForm: FC<{
  options: GeoJSONOptions
  onChange: (options: GeoJSONOptions) => void
}> = ({ options, onChange }) => (
  <div className="space-y-3">
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={options.includeProperties}
        onChange={e => onChange({ ...options, includeProperties: e.target.checked })}
        className="w-4 h-4 rounded border-border-subtle bg-surface-2"
      />
      <span className="text-sm text-text-secondary">Include properties</span>
    </label>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={options.prettyPrint}
        onChange={e => onChange({ ...options, prettyPrint: e.target.checked })}
        className="w-4 h-4 rounded border-border-subtle bg-surface-2"
      />
      <span className="text-sm text-text-secondary">Pretty print</span>
    </label>
    <div className="flex items-center gap-2">
      <span className="text-sm text-text-secondary">Precision:</span>
      <input
        type="number"
        value={options.precision}
        onChange={e => onChange({ ...options, precision: Number(e.target.value) })}
        min={0}
        max={10}
        className="w-16 px-2 py-1 bg-surface-2 border border-border-subtle rounded text-sm"
      />
    </div>
  </div>
)

const KMLOptionsForm: FC<{
  options: KMLOptions
  onChange: (options: KMLOptions) => void
}> = ({ options, onChange }) => (
  <div className="space-y-3">
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={options.includeStyles}
        onChange={e => onChange({ ...options, includeStyles: e.target.checked })}
        className="w-4 h-4 rounded border-border-subtle bg-surface-2"
      />
      <span className="text-sm text-text-secondary">Include styles</span>
    </label>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={options.includeDescriptions}
        onChange={e => onChange({ ...options, includeDescriptions: e.target.checked })}
        className="w-4 h-4 rounded border-border-subtle bg-surface-2"
      />
      <span className="text-sm text-text-secondary">Include descriptions</span>
    </label>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={options.useFolders}
        onChange={e => onChange({ ...options, useFolders: e.target.checked })}
        className="w-4 h-4 rounded border-border-subtle bg-surface-2"
      />
      <span className="text-sm text-text-secondary">Use folders for categories</span>
    </label>
  </div>
)

const CSVOptionsForm: FC<{
  options: CSVOptions
  onChange: (options: CSVOptions) => void
}> = ({ options, onChange }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <span className="text-sm text-text-secondary">Delimiter:</span>
      <select
        value={options.delimiter}
        onChange={e => onChange({ ...options, delimiter: e.target.value as CSVOptions['delimiter'] })}
        className="px-2 py-1 bg-surface-2 border border-border-subtle rounded text-sm"
      >
        <option value=",">Comma (,)</option>
        <option value=";">Semicolon (;)</option>
        <option value={'\t'}>Tab</option>
      </select>
    </div>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={options.includeHeader}
        onChange={e => onChange({ ...options, includeHeader: e.target.checked })}
        className="w-4 h-4 rounded border-border-subtle bg-surface-2"
      />
      <span className="text-sm text-text-secondary">Include header row</span>
    </label>
  </div>
)

const PNGOptionsForm: FC<{
  options: PNGOptions
  onChange: (options: PNGOptions) => void
}> = ({ options, onChange }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">Width:</span>
        <input
          type="number"
          value={options.width}
          onChange={e => onChange({ ...options, width: Number(e.target.value) })}
          min={100}
          max={4096}
          className="w-20 px-2 py-1 bg-surface-2 border border-border-subtle rounded text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">Height:</span>
        <input
          type="number"
          value={options.height}
          onChange={e => onChange({ ...options, height: Number(e.target.value) })}
          min={100}
          max={4096}
          className="w-20 px-2 py-1 bg-surface-2 border border-border-subtle rounded text-sm"
        />
      </div>
    </div>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={options.includeLegend}
        onChange={e => onChange({ ...options, includeLegend: e.target.checked })}
        className="w-4 h-4 rounded border-border-subtle bg-surface-2"
      />
      <span className="text-sm text-text-secondary">Include legend</span>
    </label>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={options.includeScaleBar}
        onChange={e => onChange({ ...options, includeScaleBar: e.target.checked })}
        className="w-4 h-4 rounded border-border-subtle bg-surface-2"
      />
      <span className="text-sm text-text-secondary">Include scale bar</span>
    </label>
    <div className="flex items-center gap-2">
      <span className="text-sm text-text-secondary">Background:</span>
      <select
        value={options.background}
        onChange={e =>
          onChange({ ...options, background: e.target.value as PNGOptions['background'] })
        }
        className="px-2 py-1 bg-surface-2 border border-border-subtle rounded text-sm"
      >
        <option value="dark">Dark</option>
        <option value="white">White</option>
        <option value="transparent">Transparent</option>
      </select>
    </div>
  </div>
)

const PDFOptionsForm: FC<{
  options: PDFOptions
  onChange: (options: PDFOptions) => void
}> = ({ options, onChange }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">Size:</span>
        <select
          value={options.pageSize}
          onChange={e =>
            onChange({ ...options, pageSize: e.target.value as PDFOptions['pageSize'] })
          }
          className="px-2 py-1 bg-surface-2 border border-border-subtle rounded text-sm"
        >
          <option value="A4">A4</option>
          <option value="letter">Letter</option>
          <option value="A3">A3</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">Orientation:</span>
        <select
          value={options.orientation}
          onChange={e =>
            onChange({ ...options, orientation: e.target.value as PDFOptions['orientation'] })
          }
          className="px-2 py-1 bg-surface-2 border border-border-subtle rounded text-sm"
        >
          <option value="landscape">Landscape</option>
          <option value="portrait">Portrait</option>
        </select>
      </div>
    </div>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={options.includeMap}
        onChange={e => onChange({ ...options, includeMap: e.target.checked })}
        className="w-4 h-4 rounded border-border-subtle bg-surface-2"
      />
      <span className="text-sm text-text-secondary">Include map</span>
    </label>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={options.includeTable}
        onChange={e => onChange({ ...options, includeTable: e.target.checked })}
        className="w-4 h-4 rounded border-border-subtle bg-surface-2"
      />
      <span className="text-sm text-text-secondary">Include entity table</span>
    </label>
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={options.includeStats}
        onChange={e => onChange({ ...options, includeStats: e.target.checked })}
        className="w-4 h-4 rounded border-border-subtle bg-surface-2"
      />
      <span className="text-sm text-text-secondary">Include statistics</span>
    </label>
  </div>
)

// =============================================================================
// PREVIEW COMPONENT
// =============================================================================

export interface PreviewProps {
  /** Additional class */
  className?: string
}

const Preview: FC<PreviewProps> = memo(function Preview({ className }) {
  const { format, filteredEntities, options, compact } = useExport()

  const previewContent = useMemo(() => {
    if (filteredEntities.length === 0) {
      return 'No entities to export'
    }

    switch (format) {
      case 'geojson': {
        const opts = options as GeoJSONOptions
        const sample = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [0, 0] },
              properties: opts.includeProperties ? { id: '...', name: '...' } : {},
            },
          ],
        }
        return opts.prettyPrint
          ? JSON.stringify(sample, null, 2)
          : JSON.stringify(sample)
      }
      case 'kml':
        return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Export</name>
    <Placemark>
      <name>Entity 1</name>
      <Point><coordinates>0,0,0</coordinates></Point>
    </Placemark>
    ...${filteredEntities.length - 1} more
  </Document>
</kml>`
      case 'csv': {
        const opts = options as CSVOptions
        const header = opts.includeHeader ? opts.fields.join(opts.delimiter) + '\n' : ''
        return header + `entity_1${opts.delimiter}Name${opts.delimiter}...`
      }
      case 'png':
        return '[Map screenshot preview]'
      case 'pdf':
        return '[PDF report preview]'
    }
  }, [format, filteredEntities, options])

  return (
    <div className={cn('border-t border-border-subtle', compact ? 'px-3 py-2' : 'px-4 py-3', className)}>
      <div className="text-xs text-text-tertiary uppercase font-mono mb-2">Preview</div>
      <div className="p-2 bg-surface-2 rounded-lg">
        <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-all max-h-32 overflow-auto">
          {previewContent}
        </pre>
      </div>
    </div>
  )
})

// =============================================================================
// PROGRESS COMPONENT
// =============================================================================

export interface ProgressProps {
  /** Additional class */
  className?: string
}

const Progress: FC<ProgressProps> = memo(function Progress({ className }) {
  const { status, progress, error, compact } = useExport()
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (progressRef.current && (status === 'preparing' || status === 'exporting')) {
      animate(progressRef.current, {
        width: `${progress}%`,
        duration: TIMING.fast,
        easing: EASING.anime.out,
      })
    }
  }, [progress, status])

  if (status === 'idle') return null

  const getStatusIcon = () => {
    switch (status) {
      case 'preparing':
      case 'exporting':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'preparing':
        return 'Preparing...'
      case 'exporting':
        return `Exporting... ${progress}%`
      case 'complete':
        return 'Export complete!'
      case 'error':
        return error ?? 'Export failed'
    }
  }

  const statusColor =
    status === 'complete'
      ? STATUS_COLORS.success.primary
      : status === 'error'
        ? STATUS_COLORS.error.primary
        : STATUS_COLORS.loading.primary

  return (
    <div
      className={cn('border-t border-border-subtle', compact ? 'px-3 py-2' : 'px-4 py-3', className)}
    >
      <div className="flex items-center gap-2 mb-2">
        {getStatusIcon()}
        <span className={cn('text-text-secondary', compact ? 'text-xs' : 'text-sm')}>
          {getStatusText()}
        </span>
      </div>
      {(status === 'preparing' || status === 'exporting') && (
        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            ref={progressRef}
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: statusColor }}
          />
        </div>
      )}
    </div>
  )
})

// =============================================================================
// ACTIONS COMPONENT
// =============================================================================

export interface ActionsProps {
  /** Cancel handler */
  onCancel?: () => void
  /** Additional class */
  className?: string
}

const Actions: FC<ActionsProps> = memo(function Actions({ onCancel, className }) {
  const { status, startExport, cancelExport, filteredEntities, compact } = useExport()

  const isExporting = status === 'preparing' || status === 'exporting'
  const isComplete = status === 'complete'
  const canExport = filteredEntities.length > 0 && !isExporting && !isComplete

  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-border-subtle',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        className
      )}
    >
      <button
        onClick={() => {
          if (isExporting) {
            cancelExport()
          } else {
            onCancel?.()
          }
        }}
        className={cn(
          'px-3 py-1.5 text-text-secondary hover:bg-surface-2 rounded-lg transition-colors',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        {isExporting ? 'Cancel' : 'Close'}
      </button>
      <button
        onClick={startExport}
        disabled={!canExport}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors',
          compact ? 'text-xs' : 'text-sm',
          canExport
            ? 'bg-accent-primary text-white hover:bg-accent-primary/90'
            : 'bg-surface-2 text-text-tertiary cursor-not-allowed'
        )}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting...
          </>
        ) : isComplete ? (
          <>
            <Check className="w-4 h-4" />
            Done
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export
          </>
        )}
      </button>
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const ExportPanel = Object.assign(Root, {
  Root,
  Header,
  FormatSelector,
  EntityScope: EntityScopeComponent,
  FormatOptions: FormatOptionsComponent,
  Preview,
  Progress,
  Actions,
})

// Named exports for compound pattern
export {
  Root as ExportPanelRoot,
  Header as ExportPanelHeader,
  FormatSelector as ExportPanelFormatSelector,
  EntityScopeComponent as ExportPanelEntityScope,
  FormatOptionsComponent as ExportPanelFormatOptions,
  Preview as ExportPanelPreview,
  Progress as ExportPanelProgress,
  Actions as ExportPanelActions,
}

export default ExportPanel
