/**
 * Raw Events Panel
 *
 * AG-Grid display of raw event stream from Streams Playground.
 * Uses TmnlDataGrid with tmnlDenseDark variant.
 *
 * PAYLOAD PARSING:
 * Dynamically detects payload profile (SenML/OPC-UA/Prometheus) and
 * generates columns based on the payload schema.
 *
 * @module
 */

import { useMemo, useState } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { type ColDef, type ICellRendererParams, type ValueGetterParams } from 'ag-grid-community'
import {
  TmnlDataGrid,
  tmnlDenseDark,
} from '@/lib/data-grid'
import {
  rawEventsAtom,
  throughputAtom,
  scenarioConfigAtom,
  type RawEvent,
} from '@/lib/streams/playground'
import type { PayloadProfile } from '@/lib/streams/playground/scenarios/types'
import { Modal, createVisitor } from '@/components/base/BaseModal'

// =============================================================================
// TYPES
// =============================================================================

interface RawEventsPanelProps {
  /** Max height in pixels */
  maxHeight?: number
}

/** Data shape for payload inspector modal */
interface PayloadInspectorData {
  eventId: string
  profile: PayloadProfile | null
  payload: unknown
  sizeBytes: number | undefined
  timestamp: number
}

// =============================================================================
// PAYLOAD INSPECTOR VISITOR
// =============================================================================

/**
 * Syntax highlighting for JSON
 */
function JsonSyntaxHighlight({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2)

  // Simple syntax highlighting via regex
  const highlighted = json
    .replace(/"([^"]+)":/g, '<span style="color: #8b5cf6">"$1"</span>:') // keys
    .replace(/: "([^"]+)"/g, ': <span style="color: #22c55e">"$1"</span>') // string values
    .replace(/: (\d+\.?\d*)/g, ': <span style="color: #f59e0b">$1</span>') // numbers
    .replace(/: (true|false)/g, ': <span style="color: #06b6d4">$1</span>') // booleans
    .replace(/: (null)/g, ': <span style="color: #ef4444">$1</span>') // null

  return (
    <pre
      className="text-sm font-mono overflow-auto"
      style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        lineHeight: 1.5,
        maxHeight: '60vh',
      }}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  )
}

/**
 * Payload inspector visitor - shows full payload with syntax highlighting
 */
const payloadInspectorVisitor = createVisitor<PayloadInspectorData>({
  id: 'payload-inspector',
  size: 'lg',
  className: 'border-cyan-800/50',

  header: (data) => (
    <div className="flex items-center gap-3">
      <span className="text-cyan-400 font-mono font-bold">Payload Inspector</span>
      <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        {data.eventId}
      </span>
      {data.profile && (
        <span
          className="px-2 py-0.5 rounded border font-mono uppercase"
          style={{
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: data.profile === 'senml' ? '#22c55e' : data.profile === 'opcua' ? '#f59e0b' : '#8b5cf6',
            borderColor: data.profile === 'senml' ? '#22c55e40' : data.profile === 'opcua' ? '#f59e0b40' : '#8b5cf640',
            backgroundColor: data.profile === 'senml' ? '#22c55e10' : data.profile === 'opcua' ? '#f59e0b10' : '#8b5cf610',
          }}
        >
          {data.profile}
        </span>
      )}
    </div>
  ),

  render: (data, { close }) => (
    <div className="space-y-4">
      {/* Meta info */}
      <div className="flex items-center gap-4 text-xs text-neutral-500 font-mono">
        <span>
          Size: <span className="text-cyan-400">{data.sizeBytes ? `${(data.sizeBytes / 1024).toFixed(2)} kB` : '—'}</span>
        </span>
        <span>
          Time: <span className="text-neutral-300">{new Date(data.timestamp).toISOString()}</span>
        </span>
      </div>

      {/* JSON payload */}
      <div className="p-4 bg-neutral-950 rounded border border-neutral-800 overflow-auto">
        <JsonSyntaxHighlight data={data.payload} />
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-2">
        <button
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(data.payload, null, 2))
          }}
          className="px-3 py-1.5 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 transition-colors font-mono"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Copy JSON
        </button>
        <button
          onClick={close}
          className="px-4 py-2 bg-cyan-900/50 text-cyan-400 rounded hover:bg-cyan-900 transition-colors font-mono"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          Close
        </button>
      </div>
    </div>
  ),

  footer: (data) => (
    <div className="text-xs text-neutral-600 font-mono flex justify-between">
      <span>src/lib/streams/playground</span>
      <span>{data.profile ? `${data.profile.toUpperCase()} Schema` : 'Raw Data'}</span>
    </div>
  ),
})

// =============================================================================
// CELL RENDERERS
// =============================================================================

const variant = tmnlDenseDark

function TimestampRenderer(params: ICellRendererParams<RawEvent>) {
  const ts = params.value as number
  const date = new Date(ts)
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const msStr = String(date.getMilliseconds()).padStart(3, '0')

  return (
    <span
      style={{
        fontFamily: 'monospace',
        color: variant.colors.text.muted,
        fontSize: variant.density.fontSizeXs,
      }}
    >
      {timeStr}.<span style={{ color: variant.colors.text.secondary }}>{msStr}</span>
    </span>
  )
}

function TypeRenderer(params: ICellRendererParams<RawEvent>) {
  const type = params.value as RawEvent['type']

  const colorMap: Record<RawEvent['type'], string> = {
    emission: variant.colors.signal.accent,
    circuitChange: '#f59e0b', // amber
    backpressure: '#8b5cf6', // purple
    dropped: variant.colors.signal.negative,
  }

  const labelMap: Record<RawEvent['type'], string> = {
    emission: 'EMIT',
    circuitChange: 'CB',
    backpressure: 'BP',
    dropped: 'DROP',
  }

  const color = colorMap[type]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
      <div
        style={{
          width: 5,
          height: 5,
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
        {labelMap[type]}
      </span>
    </div>
  )
}

function LatencyRenderer(params: ICellRendererParams<RawEvent>) {
  const latencyMs = params.data?.latencyMs
  if (latencyMs === undefined) return null

  // Convert to microseconds for display
  const latencyMicro = latencyMs * 1000

  // Color thresholds in microseconds: green < 50μs, amber < 100μs, red >= 100μs
  const color = latencyMicro >= 100
    ? variant.colors.signal.negative
    : latencyMicro >= 50
      ? '#f59e0b'
      : variant.colors.signal.positive

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
      <span
        style={{
          color,
          fontFamily: 'monospace',
          fontVariantNumeric: 'tabular-nums',
          fontSize: variant.density.fontSize,
        }}
      >
        {latencyMicro.toFixed(0)}
      </span>
      <span
        style={{
          color: variant.colors.text.muted,
          fontSize: variant.density.fontSizeXs,
        }}
      >
        μs
      </span>
    </div>
  )
}

function CircuitStateRenderer(params: ICellRendererParams<RawEvent>) {
  const state = params.data?.cbState
  if (!state) return null

  const colorMap = {
    closed: variant.colors.signal.positive,
    open: variant.colors.signal.negative,
    'half-open': '#f59e0b',
  }

  return (
    <span
      style={{
        color: colorMap[state],
        fontSize: variant.density.fontSizeXs,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {state}
    </span>
  )
}

function DetailsRenderer(params: ICellRendererParams<RawEvent>) {
  const event = params.data
  if (!event) return null

  const details: string[] = []

  if (event.failureCount !== undefined) {
    details.push(`failures: ${event.failureCount}`)
  }
  if (event.strategy) {
    details.push(`strategy: ${event.strategy}`)
  }
  if (event.bufferFill !== undefined) {
    details.push(`buffer: ${(event.bufferFill * 100).toFixed(0)}%`)
  }
  if (event.droppedCount !== undefined) {
    details.push(`dropped: ${event.droppedCount}`)
  }

  if (details.length === 0) return null

  return (
    <span
      style={{
        color: variant.colors.text.muted,
        fontSize: variant.density.fontSizeXs,
        fontFamily: 'monospace',
      }}
    >
      {details.join(' · ')}
    </span>
  )
}

// =============================================================================
// PAYLOAD CELL RENDERERS
// =============================================================================

/**
 * Payload size renderer - shows bytes with color coding
 */
function PayloadSizeRenderer(params: ICellRendererParams<RawEvent>) {
  const size = params.data?.payloadSizeBytes
  if (size === undefined) return null

  // Color thresholds: green < 1kB, amber < 5kB, red >= 5kB
  const color = size >= 5120
    ? variant.colors.signal.negative
    : size >= 1024
      ? '#f59e0b'
      : variant.colors.signal.positive

  const formatted = size >= 1024
    ? `${(size / 1024).toFixed(1)} kB`
    : `${size} B`

  return (
    <span
      style={{
        color,
        fontFamily: 'monospace',
        fontVariantNumeric: 'tabular-nums',
        fontSize: variant.density.fontSizeXs,
      }}
    >
      {formatted}
    </span>
  )
}

// =============================================================================
// PAYLOAD TYPE DETECTION & COLUMN GENERATION
// =============================================================================

/**
 * Detect payload profile from payload structure
 */
function detectPayloadProfile(payload: unknown): PayloadProfile | null {
  if (!payload) return null

  // SenML: array with records containing n, v, u fields
  if (Array.isArray(payload) && payload.length > 0) {
    const first = payload[0]
    if (typeof first === 'object' && first !== null && ('n' in first || 'bn' in first)) {
      return 'senml'
    }
  }

  // OPC-UA: object with MessageId, MessageType, Messages
  if (typeof payload === 'object' && payload !== null) {
    if ('MessageType' in payload && 'Messages' in payload) {
      return 'opcua'
    }
    // Prometheus: object with metrics array
    if ('metrics' in payload && Array.isArray((payload as { metrics: unknown }).metrics)) {
      return 'prometheus'
    }
  }

  return null
}

/**
 * SenML cell renderer - shows first sensor reading
 */
function SenMLRenderer(params: ICellRendererParams<RawEvent>) {
  const payload = params.data?.payload as Array<{ bn?: string; n?: string; v?: number; u?: string }> | undefined
  if (!payload || !Array.isArray(payload) || payload.length === 0) return null

  const first = payload[0]
  const name = first.n || '—'
  const value = first.v !== undefined ? first.v.toFixed(2) : '—'
  const unit = first.u || ''

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ color: variant.colors.text.muted, fontSize: variant.density.fontSizeXs }}>
        {name}
      </span>
      <span style={{ color: variant.colors.signal.accent, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ color: variant.colors.text.muted, fontSize: variant.density.fontSizeXs }}>
        {unit}
      </span>
      {payload.length > 1 && (
        <span style={{ color: variant.colors.text.muted, fontSize: variant.density.fontSizeXs, opacity: 0.6 }}>
          +{payload.length - 1}
        </span>
      )}
    </div>
  )
}

/**
 * OPC-UA cell renderer - shows publisher and first message
 */
function OpcUaRenderer(params: ICellRendererParams<RawEvent>) {
  const payload = params.data?.payload as {
    PublisherId?: string
    Messages?: Array<{ DataSetWriterId?: number; Payload?: Record<string, { Value?: { Body?: unknown } }> }>
  } | undefined
  if (!payload || typeof payload !== 'object') return null

  const publisherId = payload.PublisherId || '—'
  const messages = payload.Messages || []
  const firstMsg = messages[0]
  const fieldCount = firstMsg?.Payload ? Object.keys(firstMsg.Payload).length : 0

  // Get first field value
  let firstValue = '—'
  if (firstMsg?.Payload) {
    const firstField = Object.values(firstMsg.Payload)[0]
    if (firstField?.Value?.Body !== undefined) {
      const body = firstField.Value.Body
      firstValue = typeof body === 'number' ? body.toFixed(2) : String(body)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ color: '#f59e0b', fontSize: variant.density.fontSizeXs }}>
        {publisherId}
      </span>
      <span style={{ color: variant.colors.signal.accent, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
        {firstValue}
      </span>
      <span style={{ color: variant.colors.text.muted, fontSize: variant.density.fontSizeXs, opacity: 0.6 }}>
        {fieldCount} fields · {messages.length} msg
      </span>
    </div>
  )
}

/**
 * Prometheus cell renderer - shows first metric
 */
function PrometheusRenderer(params: ICellRendererParams<RawEvent>) {
  const payload = params.data?.payload as {
    metrics?: Array<{ name?: string; value?: number; type?: string; labels?: Record<string, string> }>
  } | undefined
  if (!payload || typeof payload !== 'object' || !payload.metrics) return null

  const metrics = payload.metrics
  const first = metrics[0]
  if (!first) return null

  const name = first.name?.replace('tmnl_', '') || '—'
  const value = first.value !== undefined ? first.value.toFixed(2) : '—'
  const type = first.type || ''
  const labelCount = first.labels ? Object.keys(first.labels).length : 0

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ color: '#8b5cf6', fontSize: variant.density.fontSizeXs }}>
        {name.length > 20 ? name.slice(0, 20) + '…' : name}
      </span>
      <span style={{ color: variant.colors.signal.accent, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ color: variant.colors.text.muted, fontSize: variant.density.fontSizeXs, opacity: 0.6 }}>
        {type} · {labelCount}L · {metrics.length}M
      </span>
    </div>
  )
}

/**
 * Universal payload renderer - detects type and delegates
 */
function PayloadRenderer(params: ICellRendererParams<RawEvent>) {
  const payload = params.data?.payload
  if (!payload) return <span style={{ color: variant.colors.text.muted, opacity: 0.4 }}>—</span>

  const profile = detectPayloadProfile(payload)

  switch (profile) {
    case 'senml':
      return <SenMLRenderer {...params} />
    case 'opcua':
      return <OpcUaRenderer {...params} />
    case 'prometheus':
      return <PrometheusRenderer {...params} />
    default:
      return (
        <span style={{ color: variant.colors.text.muted, fontSize: variant.density.fontSizeXs, fontFamily: 'monospace' }}>
          {JSON.stringify(payload).slice(0, 40)}…
        </span>
      )
  }
}

// =============================================================================
// DYNAMIC COLUMN GENERATION (Schema-Derived)
// =============================================================================

/**
 * SenML semantic field mappings
 * RFC 8428 field codes → human-readable names
 */
const SENML_FIELD_SEMANTICS: Record<string, { name: string; color: string }> = {
  bn: { name: 'Device', color: '#6b7280' },
  bt: { name: 'Base Time', color: '#6b7280' },
  n: { name: 'Sensor', color: variant.colors.text.secondary },
  u: { name: 'Unit', color: variant.colors.text.muted },
  v: { name: 'Value', color: variant.colors.signal.accent },
  vs: { name: 'String', color: variant.colors.signal.accent },
  vb: { name: 'Bool', color: variant.colors.signal.accent },
  t: { name: 'Δt', color: '#6b7280' },
  s: { name: 'Sum', color: '#8b5cf6' },
}

/**
 * Known SenML sensor types with semantic names and colors
 */
const SENML_SENSOR_SEMANTICS: Record<string, { label: string; color: string; icon: string }> = {
  temperature: { label: 'Temp', color: '#ef4444', icon: '🌡' },
  humidity: { label: 'Humidity', color: '#3b82f6', icon: '💧' },
  pressure: { label: 'Pressure', color: '#8b5cf6', icon: '⬇' },
  voltage: { label: 'Voltage', color: '#f59e0b', icon: '⚡' },
  current: { label: 'Current', color: '#f59e0b', icon: '〰' },
  power: { label: 'Power', color: '#ef4444', icon: '⚡' },
  luminosity: { label: 'Light', color: '#fbbf24', icon: '☀' },
  co2: { label: 'CO₂', color: '#6b7280', icon: '💨' },
  sound: { label: 'Sound', color: '#a855f7', icon: '🔊' },
  battery: { label: 'Battery', color: '#22c55e', icon: '🔋' },
  rssi: { label: 'RSSI', color: '#06b6d4', icon: '📶' },
}

/**
 * Generate SenML schema-derived columns
 * Groups sensors into column groups with Value + Unit children
 */
function generateSenMLColumns(): ColDef<RawEvent>[] {
  // Primary sensors to show as column groups (first 4 for space)
  const primarySensors = ['temperature', 'humidity', 'pressure', 'voltage']

  return primarySensors.map((sensorName) => {
    const semantic = SENML_SENSOR_SEMANTICS[sensorName] || {
      label: sensorName,
      color: variant.colors.text.secondary,
      icon: '📊'
    }

    return {
      headerName: semantic.label,
      headerClass: 'ag-header-group-sensor',
      marryChildren: true,
      children: [
        {
          headerName: 'Value',
          width: 70,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as Array<{ n?: string; v?: number }> | undefined
            if (!Array.isArray(payload)) return null
            const record = payload.find(r => r.n === sensorName)
            return record?.v
          },
          cellStyle: {
            color: semantic.color,
            fontFamily: 'monospace',
            fontVariantNumeric: 'tabular-nums',
            fontSize: variant.density.fontSize,
          },
          valueFormatter: (params) =>
            params.value !== null && params.value !== undefined
              ? params.value.toFixed(1)
              : '—',
        },
        {
          headerName: 'Unit',
          width: 50,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as Array<{ n?: string; u?: string }> | undefined
            if (!Array.isArray(payload)) return null
            const record = payload.find(r => r.n === sensorName)
            return record?.u
          },
          cellStyle: {
            color: variant.colors.text.muted,
            fontSize: variant.density.fontSizeXs,
          },
        },
      ],
    } as ColDef<RawEvent>
  })
}

/**
 * Generate OPC-UA schema-derived columns
 * Groups: Publisher info, First DataSet fields
 */
function generateOpcUaColumns(): ColDef<RawEvent>[] {
  return [
    {
      headerName: 'Publisher',
      marryChildren: true,
      children: [
        {
          headerName: 'ID',
          width: 100,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as { PublisherId?: string } | undefined
            return payload?.PublisherId
          },
          cellStyle: {
            color: '#f59e0b',
            fontFamily: 'monospace',
            fontSize: variant.density.fontSizeXs,
          },
        },
        {
          headerName: 'Writer',
          width: 60,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as {
              Messages?: Array<{ DataSetWriterId?: number }>
            } | undefined
            return payload?.Messages?.[0]?.DataSetWriterId
          },
          cellStyle: {
            color: variant.colors.text.muted,
            fontFamily: 'monospace',
            fontSize: variant.density.fontSizeXs,
          },
        },
      ],
    },
    {
      headerName: 'DataSet Fields',
      marryChildren: true,
      children: [
        {
          headerName: 'Temp PV',
          width: 75,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as {
              Messages?: Array<{ Payload?: Record<string, { Value?: { Body?: unknown } }> }>
            } | undefined
            const fields = payload?.Messages?.[0]?.Payload
            if (!fields) return null
            const tempField = Object.entries(fields).find(([k]) => k.includes('Temperature'))
            return tempField?.[1]?.Value?.Body
          },
          cellStyle: {
            color: '#ef4444',
            fontFamily: 'monospace',
            fontVariantNumeric: 'tabular-nums',
          },
          valueFormatter: (params) =>
            typeof params.value === 'number' ? params.value.toFixed(1) : '—',
        },
        {
          headerName: 'Pressure',
          width: 75,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as {
              Messages?: Array<{ Payload?: Record<string, { Value?: { Body?: unknown } }> }>
            } | undefined
            const fields = payload?.Messages?.[0]?.Payload
            if (!fields) return null
            const field = Object.entries(fields).find(([k]) => k.includes('Pressure'))
            return field?.[1]?.Value?.Body
          },
          cellStyle: {
            color: '#8b5cf6',
            fontFamily: 'monospace',
            fontVariantNumeric: 'tabular-nums',
          },
          valueFormatter: (params) =>
            typeof params.value === 'number' ? params.value.toFixed(2) : '—',
        },
        {
          headerName: 'Fields',
          width: 55,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as {
              Messages?: Array<{ Payload?: Record<string, unknown> }>
            } | undefined
            const fields = payload?.Messages?.[0]?.Payload
            return fields ? Object.keys(fields).length : null
          },
          cellStyle: {
            color: variant.colors.text.muted,
            fontSize: variant.density.fontSizeXs,
          },
        },
      ],
    },
  ] as ColDef<RawEvent>[]
}

/**
 * Generate Prometheus schema-derived columns
 * Groups: Metric info, Labels
 */
function generatePrometheusColumns(): ColDef<RawEvent>[] {
  return [
    {
      headerName: 'Metric',
      marryChildren: true,
      children: [
        {
          headerName: 'Name',
          width: 140,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as {
              metrics?: Array<{ name?: string }>
            } | undefined
            return payload?.metrics?.[0]?.name?.replace('tmnl_', '')
          },
          cellStyle: {
            color: '#8b5cf6',
            fontFamily: 'monospace',
            fontSize: variant.density.fontSizeXs,
          },
        },
        {
          headerName: 'Value',
          width: 80,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as {
              metrics?: Array<{ value?: number }>
            } | undefined
            return payload?.metrics?.[0]?.value
          },
          cellStyle: {
            color: variant.colors.signal.accent,
            fontFamily: 'monospace',
            fontVariantNumeric: 'tabular-nums',
          },
          valueFormatter: (params) =>
            typeof params.value === 'number'
              ? params.value > 10000
                ? `${(params.value / 1000).toFixed(0)}k`
                : params.value.toFixed(1)
              : '—',
        },
        {
          headerName: 'Type',
          width: 70,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as {
              metrics?: Array<{ type?: string }>
            } | undefined
            return payload?.metrics?.[0]?.type
          },
          cellStyle: {
            color: variant.colors.text.muted,
            fontSize: variant.density.fontSizeXs,
            textTransform: 'uppercase',
          },
        },
      ],
    },
    {
      headerName: 'Labels',
      marryChildren: true,
      children: [
        {
          headerName: 'method',
          width: 60,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as {
              metrics?: Array<{ labels?: Record<string, string> }>
            } | undefined
            return payload?.metrics?.[0]?.labels?.method
          },
          cellStyle: {
            color: '#22c55e',
            fontFamily: 'monospace',
            fontSize: variant.density.fontSizeXs,
          },
        },
        {
          headerName: 'status',
          width: 50,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as {
              metrics?: Array<{ labels?: Record<string, string> }>
            } | undefined
            return payload?.metrics?.[0]?.labels?.status
          },
          cellRenderer: (params: ICellRendererParams) => {
            const status = params.value as string | undefined
            if (!status) return '—'
            const color = status.startsWith('2') ? '#22c55e'
              : status.startsWith('4') ? '#f59e0b'
              : status.startsWith('5') ? '#ef4444'
              : variant.colors.text.muted
            return <span style={{ color, fontFamily: 'monospace', fontSize: variant.density.fontSizeXs }}>{status}</span>
          },
        },
        {
          headerName: 'job',
          width: 80,
          suppressSizeToFit: true,
          valueGetter: (params: ValueGetterParams<RawEvent>) => {
            const payload = params.data?.payload as {
              metrics?: Array<{ labels?: Record<string, string> }>
            } | undefined
            return payload?.metrics?.[0]?.labels?.job
          },
          cellStyle: {
            color: '#06b6d4',
            fontFamily: 'monospace',
            fontSize: variant.density.fontSizeXs,
          },
        },
      ],
    },
  ] as ColDef<RawEvent>[]
}

/**
 * Get schema-derived columns based on payload profile
 */
function getSchemaColumns(profile: PayloadProfile): ColDef<RawEvent>[] {
  switch (profile) {
    case 'senml':
      return generateSenMLColumns()
    case 'opcua':
      return generateOpcUaColumns()
    case 'prometheus':
      return generatePrometheusColumns()
    default:
      return []
  }
}

// =============================================================================
// BASE COLUMN DEFINITIONS (Profile-independent)
// =============================================================================

/** Left-side columns (always shown) */
const baseColumnsLeft: ColDef<RawEvent>[] = [
  {
    field: 'id',
    headerName: 'ID',
    width: 70,
    suppressSizeToFit: true,
    pinned: 'left',
    cellStyle: {
      color: variant.colors.text.muted,
      fontSize: variant.density.fontSizeXs,
      fontFamily: 'monospace',
    },
  },
  {
    field: 'timestamp',
    headerName: 'Time',
    width: 100,
    suppressSizeToFit: true,
    cellRenderer: TimestampRenderer,
  },
  {
    field: 'type',
    headerName: 'Type',
    width: 65,
    suppressSizeToFit: true,
    cellRenderer: TypeRenderer,
  },
  {
    field: 'latencyMs',
    headerName: 'Latency',
    width: 70,
    suppressSizeToFit: true,
    cellRenderer: LatencyRenderer,
  },
  {
    field: 'payloadSizeBytes',
    headerName: 'Size',
    width: 65,
    suppressSizeToFit: true,
    cellRenderer: PayloadSizeRenderer,
  },
]

/** Right-side columns (always shown) */
const baseColumnsRight: ColDef<RawEvent>[] = [
  {
    field: 'payload',
    headerName: 'Payload',
    width: 200,
    minWidth: 150,
    cellRenderer: PayloadRenderer,
  },
  {
    field: 'cbState',
    headerName: 'CB',
    width: 60,
    suppressSizeToFit: true,
    cellRenderer: CircuitStateRenderer,
  },
  {
    headerName: 'Details',
    width: 120,
    suppressSizeToFit: true,
    cellRenderer: DetailsRenderer,
  },
]

// =============================================================================
// RAW EVENTS PANEL
// =============================================================================

/**
 * Profile badge colors
 */
const PROFILE_COLORS: Record<PayloadProfile, string> = {
  senml: '#22c55e',     // green - IoT
  opcua: '#f59e0b',     // amber - Industrial
  prometheus: '#8b5cf6', // purple - Observability
}

/**
 * Raw Events Panel
 *
 * Displays a live-updating AG-Grid of raw events from the playground stream.
 * Events are ordered newest-first (circular buffer pattern).
 *
 * DYNAMIC COLUMNS:
 * Column definitions are generated based on the active payload profile,
 * providing schema-derived columns with semantic names and groupings.
 *
 * PAYLOAD INSPECTOR:
 * Click on any payload cell to open the full JSON inspector modal.
 */
export function RawEventsPanel({ maxHeight = 400 }: RawEventsPanelProps) {
  const rawEvents = useAtomValue(rawEventsAtom)
  const throughput = useAtomValue(throughputAtom)
  const scenarioConfig = useAtomValue(scenarioConfigAtom)

  // Current payload profile determines schema columns
  const payloadProfile = scenarioConfig.payloadProfile

  // Selected event for payload inspector modal
  const [selectedEvent, setSelectedEvent] = useState<RawEvent | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Handle cell click - open modal for payload column
  const handleCellClicked = (params: { colDef: ColDef<RawEvent>; data: RawEvent | undefined }) => {
    if (params.colDef.field === 'payload' && params.data?.payload) {
      setSelectedEvent(params.data)
      setModalOpen(true)
    }
  }

  // Dynamic column definitions based on payload profile
  const columnDefs = useMemo<ColDef<RawEvent>[]>(() => {
    const schemaColumns = getSchemaColumns(payloadProfile)
    return [
      ...baseColumnsLeft,
      ...schemaColumns,
      ...baseColumnsRight,
    ]
  }, [payloadProfile])

  // Convert readonly array to mutable for AG-Grid
  const rowData = useMemo(() => [...rawEvents], [rawEvents])

  // Prepare modal data
  const modalData: PayloadInspectorData | null = selectedEvent ? {
    eventId: selectedEvent.id,
    profile: detectPayloadProfile(selectedEvent.payload),
    payload: selectedEvent.payload,
    sizeBytes: selectedEvent.payloadSizeBytes,
    timestamp: selectedEvent.timestamp,
  } : null

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h3
            className="font-mono uppercase tracking-wider text-neutral-300"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            Raw Event Stream
          </h3>
          {/* Profile badge */}
          <span
            className="px-2 py-0.5 rounded border font-mono uppercase"
            style={{
              fontSize: 'var(--tmnl-text-xs, 12px)',
              color: PROFILE_COLORS[payloadProfile],
              borderColor: `${PROFILE_COLORS[payloadProfile]}40`,
              backgroundColor: `${PROFILE_COLORS[payloadProfile]}10`,
            }}
          >
            {payloadProfile}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="font-mono text-neutral-500"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <span className="text-cyan-400">{throughput.totalEvents.toLocaleString()}</span> total
            <span className="text-neutral-600 mx-1">·</span>
            {rowData.length} buffered
          </span>
          <div
            className={`w-2 h-2 rounded-full ${
              rowData.length > 0 ? 'bg-cyan-400 animate-pulse' : 'bg-neutral-600'
            }`}
          />
        </div>
      </div>

      {/* Grid with dynamic schema columns */}
      <TmnlDataGrid
        variant={variant}
        rowData={rowData}
        columnDefs={columnDefs}
        getRowId={(params) => params.data.id}
        className="border border-neutral-800"
        style={{ height: maxHeight }}
        onCellClicked={handleCellClicked}
        defaultColDef={{
          sortable: false,
          resizable: true,
        }}
      />

      {/* Payload Inspector Modal */}
      <Modal.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Portal>
          <Modal.Overlay />
          {modalData && (
            <Modal.Content visitor={payloadInspectorVisitor} data={modalData} />
          )}
        </Modal.Portal>
      </Modal.Root>
    </div>
  )
}

export default RawEventsPanel
