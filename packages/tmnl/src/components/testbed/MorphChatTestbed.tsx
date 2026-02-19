/**
 * MorphChat Testbed V2
 *
 * Full showcase: adapter switcher, morph demo, preset gallery,
 * replay controls, spec inspector, morph log.
 *
 * Adapters available:
 * - Mock (full-fidelity, seeded data)
 * - Static (pre-loaded transcript)
 * - Replay (placeholder — needs real snapshot)
 *
 * Route: /testbed/morphchat
 */

import * as React from 'react'
import { Effect } from 'effect'
import { cn } from '@/lib/utils'
import {
  MorphChat,
  createMockChatAdapter,
  createStaticAdapter,
  useHarnessAdapter,
  type HarnessAdapterStatus,
  PRESET_LIST,
  ALL_PRESETS,
  type ChatSurfaceSpec,
  type MorphChatAdapter,
  type MockChatAdapter,
} from '@/lib/morphchat'

// =============================================================================
// Static Transcript
// =============================================================================

const STATIC_MESSAGES = [
  {
    id: 's1', role: 'system' as const, content: 'Session replay loaded — read-only transcript.',
    timestamp: new Date().toISOString(), status: 'complete' as const,
  },
  {
    id: 's2', role: 'operator' as const, content: 'What is the current pressure reading on V-4821?',
    timestamp: new Date().toISOString(), status: 'complete' as const, authorName: 'Operator',
  },
  {
    id: 's3', role: 'agent' as const, content: 'Valve V-4821-A is currently reading 2,415 PSI — 315 PSI above the 2,100 PSI target. The variance was first detected 12 minutes ago. Analysis pipeline has been initiated.',
    timestamp: new Date().toISOString(), status: 'complete' as const, authorName: 'Prime-Architect',
  },
  {
    id: 's4', role: 'operator' as const, content: 'Run full remediation.',
    timestamp: new Date().toISOString(), status: 'complete' as const, authorName: 'Operator',
  },
  {
    id: 's5', role: 'agent' as const, content: 'Remediation pipeline V-4821-A initiated. Locking intake valve, calibrating pressure sensor, adjusting setpoint to 2,050 PSI, running verification sweep, and generating compliance report.',
    timestamp: new Date().toISOString(), status: 'complete' as const, authorName: 'Val-Guard',
  },
]

// =============================================================================
// Adapter Types
// =============================================================================

type AdapterKind = 'mock' | 'static' | 'harness'

interface AdapterEntry {
  kind: AdapterKind
  label: string
  description: string
  adapter: MorphChatAdapter
  badge?: string
}

// =============================================================================
// Adapter Switcher
// =============================================================================

function AdapterSwitcher({
  entries,
  activeKind,
  onSelect,
}: {
  entries: ReadonlyArray<AdapterEntry>
  activeKind: AdapterKind
  onSelect: (kind: AdapterKind) => void
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-800/50">
      <span
        className="text-neutral-600 font-mono uppercase tracking-wider mr-2"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Adapter
      </span>
      {entries.map((entry) => (
        <button
          key={entry.kind}
          onClick={() => onSelect(entry.kind)}
          className={cn(
            'px-3 py-1 rounded font-mono border transition-all duration-200',
            'active:scale-[0.97] flex items-center gap-1.5',
            activeKind === entry.kind
              ? 'border-emerald-800 bg-emerald-500/10 text-emerald-400'
              : 'border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          title={entry.description}
        >
          {entry.label}
          {entry.badge && (
            <span className={cn(
              'px-1 rounded text-[10px] leading-tight',
              entry.badge === 'live' ? 'bg-emerald-500/20 text-emerald-400' :
              entry.badge === 'connecting' ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
              entry.badge === 'error' ? 'bg-red-500/20 text-red-400' :
              'bg-neutral-800 text-neutral-500',
            )}>
              {entry.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// =============================================================================
// Preset Gallery
// =============================================================================

function PresetGallery({
  activeTag,
  onSelect,
}: {
  activeTag: string
  onSelect: (spec: ChatSurfaceSpec) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-neutral-800/50">
      <span
        className="text-neutral-600 font-mono uppercase tracking-wider self-center mr-2"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Presets
      </span>
      {PRESET_LIST.map((preset) => (
        <button
          key={preset._tag}
          onClick={() => onSelect(preset)}
          className={cn(
            'px-3 py-1 rounded font-mono border transition-all duration-200',
            'active:scale-[0.97]',
            activeTag === preset._tag
              ? 'border-cyan-800 bg-cyan-500/10 text-cyan-400'
              : 'border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {preset._tag}
        </button>
      ))}
    </div>
  )
}

// =============================================================================
// Morph Demo — Auto-cycles through presets
// =============================================================================

function MorphDemo({
  isRunning,
  onToggle,
}: {
  isRunning: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'px-3 py-1 rounded font-mono border transition-all duration-200',
        'active:scale-[0.97]',
        isRunning
          ? 'border-amber-800 bg-amber-500/10 text-amber-400'
          : 'border-neutral-800 text-neutral-500 hover:border-neutral-700',
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {isRunning ? '■ Stop Demo' : '▶ Morph Demo'}
    </button>
  )
}

// =============================================================================
// Spec Inspector
// =============================================================================

function SpecInspector({ spec }: { spec: ChatSurfaceSpec }) {
  const axes = [
    ['composer', spec.composer],
    ['thread', spec.thread],
    ['inlineTasks', spec.inlineTasks],
    ['agentSelector', spec.agentSelector],
    ['connectionStatus', spec.connectionStatus],
    ['frameChrome', spec.frameChrome],
    ['keyboardShortcuts', spec.keyboardShortcuts],
    ['contextChips', spec.contextChips],
    ['scrollBehavior', spec.scrollBehavior],
  ] as const

  return (
    <div className="px-4 py-2 border-b border-neutral-800/50">
      <div className="grid grid-cols-3 gap-x-4 gap-y-0.5">
        {axes.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-neutral-600 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {key}:
            </span>
            <span
              className={cn(
                'font-mono',
                value === 'none' || value === 'hidden' || value === 'disabled'
                  ? 'text-neutral-700' : 'text-neutral-300',
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Morph Log
// =============================================================================

interface MorphEvent {
  from: string
  to: string
  timestamp: number
}

function MorphLog({ events }: { events: MorphEvent[] }) {
  if (events.length === 0) return null

  return (
    <div className="px-4 py-2 border-b border-neutral-800/50">
      <div className="space-y-0.5 max-h-16 overflow-y-auto">
        {events.slice(-5).map((evt, i) => (
          <div key={i} className="flex items-center gap-2 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            <span className="text-neutral-700">{new Date(evt.timestamp).toLocaleTimeString()}</span>
            <span className="text-neutral-500">{evt.from}</span>
            <span className="text-neutral-700">→</span>
            <span className="text-cyan-500">{evt.to}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Control Panel
// =============================================================================

function ControlPanel({
  adapter,
  activeKind,
  harnessStatus,
  harnessError,
}: {
  adapter: MorphChatAdapter
  activeKind: AdapterKind
  harnessStatus?: HarnessAdapterStatus
  harnessError?: string | null
}) {
  if (activeKind === 'static') {
    return (
      <div className="px-4 py-2 border-b border-neutral-800/50">
        <span className="text-neutral-600 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          Static adapter — read-only transcript, no controls
        </span>
      </div>
    )
  }

  if (activeKind === 'harness') {
    return (
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-neutral-800/50">
        <span className="text-neutral-600 font-mono uppercase tracking-wider mr-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          Harness
        </span>
        <span className={cn(
          'font-mono',
          harnessStatus === 'connected' ? 'text-emerald-400' :
          harnessStatus === 'connecting' || harnessStatus === 'resolving' ? 'text-amber-400' :
          harnessStatus === 'error' ? 'text-red-400' : 'text-neutral-400',
        )} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {harnessStatus ?? 'idle'}
        </span>
        {harnessError && (
          <span className="text-red-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {harnessError}
          </span>
        )}
        {adapter && (
          <>
            <ControlButton
              variant="cyan"
              onClick={() => Effect.runPromise(adapter.reconnect()).catch(() => {})}
            >
              Reconnect
            </ControlButton>
            <ControlButton variant="red" onClick={() => Effect.runPromise(adapter.cancel()).catch(() => {})}>
              Cancel
            </ControlButton>
            <ControlButton variant="amber" onClick={() => Effect.runPromise(adapter.clear()).catch(() => {})}>
              Clear
            </ControlButton>
          </>
        )}
      </div>
    )
  }

  // Mock adapter controls
  if (!adapter) return null
  const mockAdapter = adapter as MockChatAdapter

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-neutral-800/50">
      <span className="text-neutral-600 font-mono uppercase tracking-wider mr-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        Controls
      </span>
      <ControlButton onClick={() => mockAdapter.toggleConnection()}>
        Toggle Connection
      </ControlButton>
      <ControlButton
        variant="cyan"
        onClick={() => Effect.runSync(adapter.send({ content: 'Trigger streaming response.' }))}
      >
        Trigger Stream
      </ControlButton>
      <ControlButton variant="red" onClick={() => Effect.runSync(adapter.cancel())}>
        Cancel
      </ControlButton>
      <ControlButton variant="amber" onClick={() => Effect.runSync(adapter.clear())}>
        Clear
      </ControlButton>
    </div>
  )
}

function ControlButton({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: 'cyan' | 'red' | 'amber'
}) {
  const colorClass =
    variant === 'cyan' ? 'hover:border-cyan-800 hover:text-cyan-400' :
    variant === 'red' ? 'hover:border-red-800 hover:text-red-400' :
    variant === 'amber' ? 'hover:border-amber-800 hover:text-amber-400' :
    'hover:border-neutral-600 hover:text-neutral-300'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded font-mono border border-neutral-800 text-neutral-500',
        'transition-all duration-200 active:scale-[0.97]',
        colorClass,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {children}
    </button>
  )
}

// =============================================================================
// Main Testbed
// =============================================================================

export function MorphChatTestbed() {
  const [activeSpec, setActiveSpec] = React.useState<ChatSurfaceSpec>(ALL_PRESETS.Conductor)
  const [morphLog, setMorphLog] = React.useState<MorphEvent[]>([])
  const [demoRunning, setDemoRunning] = React.useState(false)
  const [activeKind, setActiveKind] = React.useState<AdapterKind>('mock')

  // ── Mock Adapter (stable) ───────────────────────────────

  const mockAdapter = React.useMemo<MockChatAdapter>(
    () => createMockChatAdapter({
      surface: { title: 'COP ASSISTANT', subtitle: 'HAVOC // SYSTEM L2', sessionLabel: 'agent:prime-architect' },
      seedTasks: true,
      autoRespond: true,
      responseDelayMs: 600,
      latencyMs: 150,
    }),
    [],
  )

  // ── Static Adapter (stable) ─────────────────────────────

  const staticAdapter = React.useMemo(
    () => createStaticAdapter({ messages: STATIC_MESSAGES, label: 'Static Transcript' }),
    [],
  )

  // ── Harness Adapter (live WebSocket) ────────────────────

  const {
    adapter: harnessAdapter,
    status: harnessStatus,
    error: harnessError,
  } = useHarnessAdapter({
    nodeId: 'cop-assistant',
    role: 'general',
    agentName: 'Prime-Architect',
    autoConnect: activeKind === 'harness', // only connect when selected
    label: 'Harness (Live)',
  })

  // ── Adapter Registry ────────────────────────────────────

  const harnessBadge: string | undefined =
    harnessStatus === 'connected' ? 'live' :
    harnessStatus === 'connecting' || harnessStatus === 'resolving' ? 'connecting' :
    harnessStatus === 'error' ? 'error' : undefined

  const adapters = React.useMemo<ReadonlyArray<AdapterEntry>>(() => [
    { kind: 'mock', label: 'Mock', description: 'Full-fidelity mock with seeded agents, tasks, streaming', adapter: mockAdapter },
    { kind: 'static', label: 'Static', description: 'Read-only transcript, no interactions', adapter: staticAdapter },
    { kind: 'harness', label: 'Harness', description: 'Live WebSocket connection to pi-ai harness runtime', adapter: harnessAdapter, badge: harnessBadge },
  ], [mockAdapter, staticAdapter, harnessAdapter, harnessBadge])

  const currentAdapter = adapters.find((a) => a.kind === activeKind)?.adapter ?? mockAdapter

  // ── Morph Demo (auto-cycle) ─────────────────────────────

  React.useEffect(() => {
    if (!demoRunning) return
    let idx = PRESET_LIST.findIndex((p) => p._tag === activeSpec._tag)
    const timer = setInterval(() => {
      idx = (idx + 1) % PRESET_LIST.length
      setActiveSpec(PRESET_LIST[idx])
    }, 2000)
    return () => clearInterval(timer)
  }, [demoRunning, activeSpec._tag])

  // ── Handlers ────────────────────────────────────────────

  const handlePresetSelect = React.useCallback(
    (spec: ChatSurfaceSpec) => {
      setMorphLog((prev) => [...prev, { from: activeSpec._tag, to: spec._tag, timestamp: Date.now() }])
      setActiveSpec(spec)
      setDemoRunning(false)
    },
    [activeSpec._tag],
  )

  const handleMorph = React.useCallback(
    (from: ChatSurfaceSpec, to: ChatSurfaceSpec) => {
      console.log(`[MorphChat] ${from._tag} → ${to._tag}`)
    },
    [],
  )

  return (
    <div className="h-screen flex flex-col bg-black text-neutral-200">
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800/50">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-neutral-200 tracking-wider" style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}>
            MorphChat
          </h1>
          <span className="font-mono text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Adaptive Chat Surface · Testbed V2
          </span>
        </div>
        <div className="flex items-center gap-3">
          <MorphDemo isRunning={demoRunning} onToggle={() => setDemoRunning((v) => !v)} />
          <span className="font-mono text-neutral-700" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            /testbed/morphchat
          </span>
        </div>
      </div>

      {/* ── Toolbars ────────────────────────────────── */}
      <AdapterSwitcher entries={adapters} activeKind={activeKind} onSelect={setActiveKind} />
      <ControlPanel
        adapter={currentAdapter}
        activeKind={activeKind}
        harnessStatus={harnessStatus}
        harnessError={harnessError}
      />
      <PresetGallery activeTag={activeSpec._tag} onSelect={handlePresetSelect} />
      <SpecInspector spec={activeSpec} />
      <MorphLog events={morphLog} />

      {/* ── Surface ─────────────────────────────────── */}
      <div className="flex-1 min-h-0 p-6 flex items-stretch justify-center">
        <div
          className="w-full"
          style={{ maxWidth: activeSpec.maxWidth ? `${activeSpec.maxWidth}px` : '900px' }}
        >
          <MorphChat.Surface
            key={activeKind}
            spec={activeSpec}
            adapter={currentAdapter}
            onMorph={handleMorph}
            className="h-full min-h-[300px] max-h-[600px]"
          />
        </div>
      </div>
    </div>
  )
}
