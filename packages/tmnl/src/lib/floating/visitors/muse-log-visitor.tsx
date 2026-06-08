import * as React from 'react'
import { Activity, Copy, Link2, Pause, Play, Trash2 } from 'lucide-react'
import { useStxData } from '@/lib/stx'
import {
  createMuseIngestController,
  type MuseCadence,
  type MuseEvent,
} from '@/lib/muse'
import { PANEL } from '../tokens'
import { panelRegistry, type PanelContentProps } from '../panel-registry'

const DEFAULT_URL = 'ws://127.0.0.1:8765'
const CADENCES: MuseCadence[] = ['raw', 'sample', 'frame', 'summary']

interface MuseLogPanelData {
  url?: string
  autoConnect?: boolean
  maxEvents?: number
}

const mono = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'

function formatNs(ns: number): string {
  if (!Number.isFinite(ns)) return '—'
  const ms = Math.floor(ns / 1_000_000)
  return new Date(ms).toLocaleTimeString()
}

function eventLabel(event: MuseEvent): string {
  switch (event.type) {
    case 'muse.samples': {
      const sampleCount = event.samples?.length ?? (event.values ? Object.keys(event.values).length : 0)
      return `${event.sensor}:${event.channel} seq=${event.sequence ?? '—'} n=${sampleCount}`
    }
    case 'muse.packet':
      return `${event.sensor}:${event.channel} bytes=${event.byteLength} ${event.payloadHex}`
    case 'muse.frame':
      return `frame ${Object.keys(event.streams).length} streams @ ${event.frameHz}hz`
    case 'muse.summary':
      return `seen=${event.packetsSeen} decoded=${event.packetsDecoded} drop=${event.packetsDropped} err=${event.decodeErrors} q=${event.queueSize}/${event.queueMax}`
    case 'muse.keepalive':
      return `keepalive ${event.command} ${event.payloadHex}`
    case 'muse.decode_error':
      return `${event.channel}: ${event.error}`
    case 'muse.scan_hit':
      return `${event.name ?? 'Muse'} ${event.address}`
    case 'muse.scan_miss':
      return event.message
    case 'muse.capture_start':
      return `${event.address} cadences=${event.cadences.join(',')}`
    case 'muse.ws_listening':
      return event.url
    default:
      return JSON.stringify(event)
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'connected': return PANEL.accentEmerald
    case 'connecting': return PANEL.accentAmber
    case 'error': return '#fb7185'
    case 'closed': return PANEL.text
    default: return PANEL.textMuted
  }
}

function MuseLogPanel({ panelId, data }: PanelContentProps) {
  const config = (data ?? {}) as MuseLogPanelData
  const controller = React.useMemo(
    () => createMuseIngestController(panelId, {
      url: config.url ?? DEFAULT_URL,
      maxEvents: config.maxEvents ?? 1_000,
    }),
    [panelId, config.url, config.maxEvents],
  )

  const status = useStxData(controller.state, d => d.status.get())
  const url = useStxData(controller.state, d => d.url.get())
  const events = useStxData(controller.state, d => d.events.get())
  const lastSummary = useStxData(controller.state, d => d.lastSummary.get())
  const error = useStxData(controller.state, d => d.error.get())
  const lastKeepaliveAt = useStxData(controller.state, d => d.lastKeepaliveAt.get())
  const uiDroppedEvents = useStxData(controller.state, d => d.uiDroppedEvents.get())

  const [draftUrl, setDraftUrl] = React.useState(url)
  const [enabledCadences, setEnabledCadences] = React.useState<ReadonlySet<MuseCadence>>(
    () => new Set(['raw', 'sample', 'summary']),
  )
  const [errorsOnly, setErrorsOnly] = React.useState(false)
  const logRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (config.autoConnect) controller.connect(config.url ?? DEFAULT_URL)
    return () => controller.dispose()
  }, [controller, config.autoConnect, config.url])

  React.useEffect(() => {
    const node = logRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [events.length])

  const visibleEvents = React.useMemo(() => {
    return events.filter(event => {
      if (errorsOnly && event.type !== 'muse.decode_error' && event.type !== 'muse.scan_miss') return false
      return enabledCadences.has(event.cadence)
    })
  }, [enabledCadences, errorsOnly, events])

  const toggleCadence = React.useCallback((cadence: MuseCadence) => {
    setEnabledCadences(prev => {
      const next = new Set(prev)
      if (next.has(cadence)) next.delete(cadence)
      else next.add(cadence)
      return next
    })
  }, [])

  const clearBuffer = React.useCallback(() => {
    controller.state.data.events.set([])
  }, [controller])

  const copyVisible = React.useCallback(() => {
    void navigator.clipboard?.writeText(visibleEvents.map(event => JSON.stringify(event)).join('\n'))
  }, [visibleEvents])

  const connected = status === 'connected' || status === 'connecting'

  return (
    <div
      data-muse-log-panel
      data-panel-id={panelId}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: PANEL.bg,
        color: PANEL.textStrong,
        fontFamily: mono,
        fontSize: 'var(--tmnl-text-xs, 12px)',
        minHeight: 0,
      }}
    >
      <div style={{ padding: 10, borderBottom: `1px solid ${PANEL.border}`, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={14} color={statusColor(status)} />
          <span style={{ color: statusColor(status), textTransform: 'uppercase', letterSpacing: '0.08em' }}>{status}</span>
          <span style={{ color: PANEL.textMuted }}>panel:{panelId}</span>
          <span style={{ marginLeft: 'auto', color: PANEL.textMuted }}>
            visible {visibleEvents.length}/{events.length}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link2 size={14} color={PANEL.textMuted} />
          <input
            value={draftUrl}
            onChange={event => setDraftUrl(event.currentTarget.value)}
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${PANEL.border}`,
              color: PANEL.textStrong,
              borderRadius: 4,
              padding: '4px 8px',
              fontFamily: mono,
              fontSize: 'var(--tmnl-text-xs, 12px)',
              outline: 'none',
            }}
          />
          <IconButton
            label={connected ? 'Disconnect' : 'Connect'}
            onClick={() => connected ? controller.disconnect() : controller.connect(draftUrl)}
          >
            {connected ? <Pause size={14} /> : <Play size={14} />}
          </IconButton>
          <IconButton label="Copy visible" onClick={copyVisible}><Copy size={14} /></IconButton>
          <IconButton label="Clear buffer" onClick={clearBuffer}><Trash2 size={14} /></IconButton>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CADENCES.map(cadence => (
            <Toggle key={cadence} active={enabledCadences.has(cadence)} onClick={() => toggleCadence(cadence)}>
              {cadence}
            </Toggle>
          ))}
          <Toggle active={errorsOnly} onClick={() => setErrorsOnly(value => !value)}>errors</Toggle>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 1,
          background: PANEL.border,
          borderBottom: `1px solid ${PANEL.border}`,
        }}
      >
        <Metric label="packets/sec" value={lastSummary?.packetsPerSec.toFixed(1) ?? '—'} />
        <Metric label="decoded" value={lastSummary?.packetsDecoded ?? 0} />
        <Metric label="drops" value={lastSummary?.packetsDropped ?? 0} />
        <Metric label="errors" value={lastSummary?.decodeErrors ?? 0} />
        <Metric label="keepalive" value={lastKeepaliveAt ? new Date(lastKeepaliveAt).toLocaleTimeString() : '—'} />
      </div>

      {error && (
        <div style={{ padding: '6px 10px', color: '#fb7185', borderBottom: `1px solid ${PANEL.border}` }}>
          {error}
        </div>
      )}
      {uiDroppedEvents > 0 && (
        <div style={{ padding: '6px 10px', color: PANEL.accentAmber, borderBottom: `1px solid ${PANEL.border}` }}>
          Browser log buffer dropped {uiDroppedEvents} old event{uiDroppedEvents === 1 ? '' : 's'}.
        </div>
      )}

      <div ref={logRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 10 }}>
        {visibleEvents.length === 0 ? (
          <div style={{ color: PANEL.textMuted, lineHeight: 1.6 }}>
            Start capture with:
            <pre style={{ marginTop: 8, color: PANEL.text, whiteSpace: 'pre-wrap', fontSize: 'var(--tmnl-text-xs, 12px)' }}>
{`source .venv-muse/bin/activate
python scripts/muse/capture.py \\
  --address 00:55:DA:BB:8C:66 \\
  --duration 0 \\
  --cadence raw,sample,frame,summary \\
  --ws-port 8765`}
            </pre>
          </div>
        ) : (
          visibleEvents.map((event, index) => (
            <div
              key={`${event.timestampHostNs}-${event.type}-${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '88px 128px minmax(0, 1fr)',
                gap: 8,
                paddingBlock: 2,
                color: event.type === 'muse.decode_error' || event.type === 'muse.scan_miss' ? '#fb7185' : PANEL.text,
                borderBottom: '1px solid rgba(255,255,255,0.025)',
                lineHeight: 1.45,
              }}
            >
              <span style={{ color: PANEL.textMuted }}>{formatNs(event.timestampHostNs)}</span>
              <span style={{ color: PANEL.textStrong }}>{event.type.replace('muse.', '')}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={JSON.stringify(event)}>
                {eventLabel(event)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: PANEL.headerBg, padding: '6px 8px', minWidth: 0 }}>
      <div style={{ color: PANEL.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ color: PANEL.textStrong, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  )
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? PANEL.accentCyan : PANEL.border}`,
        background: active ? 'rgba(8,145,178,0.16)' : 'transparent',
        color: active ? PANEL.textStrong : PANEL.text,
        borderRadius: 4,
        padding: '3px 8px',
        cursor: 'pointer',
        fontFamily: mono,
        fontSize: 'var(--tmnl-text-xs, 12px)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {children}
    </button>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        display: 'grid',
        placeItems: 'center',
        border: `1px solid ${PANEL.border}`,
        background: PANEL.surfaceRaised,
        color: PANEL.text,
        borderRadius: 4,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export function registerMuseLogVisitor() {
  panelRegistry.register('muse:log', {
    label: 'Muse Log Capture',
    icon: '🧠',
    description: 'Raw/log capture panel for Muse BLE NDJSON/WebSocket events',
    category: 'sensors',
    stateTier: 'full',
    component: MuseLogPanel,
    defaults: {
      width: 760,
      height: 520,
      mode: 'floating',
      accent: 'rgba(8, 145, 178, 0.5)',
    },
  })
}
