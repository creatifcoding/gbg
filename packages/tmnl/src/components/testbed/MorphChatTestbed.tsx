/**
 * MorphChat Component Showcase Testbed
 *
 * Full-fidelity testbed matching RvnChatIsolatedTestbed's data richness:
 * seeded agents, inline task pipelines, connection simulation, status rows,
 * streaming, and all 8 presets.
 *
 * Route: /testbed/morphchat
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  MorphChat,
  createMockChatAdapter,
  PRESET_LIST,
  ALL_PRESETS,
  type ChatSurfaceSpec,
  type MockChatAdapter,
} from '@/lib/morphchat'

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
    <div className="flex flex-wrap gap-2 p-4 border-b border-neutral-800/50">
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
            'px-3 py-1.5 rounded font-mono transition-all duration-200',
            'border',
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
    <div className="p-4 space-y-1 border-b border-neutral-800/50">
      <div
        className="text-neutral-600 font-mono uppercase tracking-wider mb-2"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Active Spec: <span className="text-cyan-500">{spec._tag}</span>
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-1">
        {axes.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span
              className="text-neutral-600 font-mono"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {key}:
            </span>
            <span
              className={cn(
                'font-mono',
                value === 'none' || value === 'hidden' || value === 'disabled'
                  ? 'text-neutral-700'
                  : 'text-neutral-300',
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
      {(spec.maxHeight || spec.maxWidth) && (
        <div className="flex gap-4 mt-1">
          {spec.maxWidth && (
            <span className="text-neutral-600 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              maxW: {spec.maxWidth}px
            </span>
          )}
          {spec.maxHeight && (
            <span className="text-neutral-600 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              maxH: {spec.maxHeight}px
            </span>
          )}
        </div>
      )}
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
    <div className="p-4 border-b border-neutral-800/50">
      <div
        className="text-neutral-600 font-mono uppercase tracking-wider mb-2"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Morph Log
      </div>
      <div className="space-y-0.5 max-h-24 overflow-y-auto">
        {events.map((evt, i) => (
          <div
            key={i}
            className="flex items-center gap-2 font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <span className="text-neutral-700">
              {new Date(evt.timestamp).toLocaleTimeString()}
            </span>
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
// Control Panel — connection toggle, streaming, message injection
// =============================================================================

function ControlPanel({ adapter }: { adapter: MockChatAdapter }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-neutral-800/50">
      <span
        className="text-neutral-600 font-mono uppercase tracking-wider mr-2"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Controls
      </span>

      {/* Connection toggle */}
      <button
        type="button"
        onClick={() => adapter.toggleConnection()}
        className={cn(
          'px-3 py-1 rounded font-mono border transition-all duration-200',
          'hover:border-neutral-600',
          'active:scale-[0.97]',
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Toggle Connection
      </button>

      {/* Trigger manual stream */}
      <button
        type="button"
        onClick={() => {
          // Inject a user message to trigger auto-respond stream
          import('effect').then(({ Effect }) => {
            Effect.runSync(adapter.send({
              content: 'Trigger streaming response for testbed validation.',
            }))
          })
        }}
        className={cn(
          'px-3 py-1 rounded font-mono border border-neutral-800 text-neutral-500',
          'hover:border-cyan-800 hover:text-cyan-400',
          'transition-all duration-200 active:scale-[0.97]',
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Trigger Stream
      </button>

      {/* Cancel stream */}
      <button
        type="button"
        onClick={() => {
          import('effect').then(({ Effect }) => {
            Effect.runSync(adapter.cancel())
          })
        }}
        className={cn(
          'px-3 py-1 rounded font-mono border border-neutral-800 text-neutral-500',
          'hover:border-red-800 hover:text-red-400',
          'transition-all duration-200 active:scale-[0.97]',
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Cancel Stream
      </button>

      {/* Clear messages */}
      <button
        type="button"
        onClick={() => {
          import('effect').then(({ Effect }) => {
            Effect.runSync(adapter.clear())
          })
        }}
        className={cn(
          'px-3 py-1 rounded font-mono border border-neutral-800 text-neutral-500',
          'hover:border-amber-800 hover:text-amber-400',
          'transition-all duration-200 active:scale-[0.97]',
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Clear
      </button>

      {/* Agent info */}
      <div className="ml-auto flex items-center gap-2">
        <span
          className="text-neutral-700 font-mono"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {adapter.surfaceConfig.title} · {adapter.surfaceConfig.subtitle}
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// Main Testbed
// =============================================================================

export function MorphChatTestbed() {
  const [activeSpec, setActiveSpec] = React.useState<ChatSurfaceSpec>(
    ALL_PRESETS.Conductor,
  )
  const [morphLog, setMorphLog] = React.useState<MorphEvent[]>([])

  // Create full-fidelity mock adapter (stable across renders)
  const adapter = React.useMemo<MockChatAdapter>(
    () =>
      createMockChatAdapter({
        surface: {
          title: 'COP ASSISTANT',
          subtitle: 'HAVOC // SYSTEM L2',
          sessionLabel: 'agent:prime-architect',
        },
        seedTasks: true,
        autoRespond: true,
        responseDelayMs: 600,
        latencyMs: 150,
      }),
    [],
  )

  const handlePresetSelect = React.useCallback(
    (spec: ChatSurfaceSpec) => {
      setMorphLog((prev) => [
        ...prev,
        { from: activeSpec._tag, to: spec._tag, timestamp: Date.now() },
      ])
      setActiveSpec(spec)
    },
    [activeSpec._tag],
  )

  const handleMorph = React.useCallback(
    (from: ChatSurfaceSpec, to: ChatSurfaceSpec) => {
      console.log(`[MorphChat] Morphing: ${from._tag} → ${to._tag}`)
    },
    [],
  )

  return (
    <div className="h-screen flex flex-col bg-black text-neutral-200">
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800/50">
        <div className="flex items-center gap-3">
          <h1
            className="font-mono text-neutral-200 tracking-wider"
            style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
          >
            MorphChat
          </h1>
          <span
            className="font-mono text-neutral-600"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Adaptive Chat Surface Architecture
          </span>
        </div>
        <span
          className="font-mono text-neutral-700"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          /testbed/morphchat
        </span>
      </div>

      {/* ── Controls ────────────────────────────────── */}
      <ControlPanel adapter={adapter} />
      <PresetGallery activeTag={activeSpec._tag} onSelect={handlePresetSelect} />
      <SpecInspector spec={activeSpec} />
      <MorphLog events={morphLog} />

      {/* ── Surface ─────────────────────────────────── */}
      <div className="flex-1 min-h-0 p-6 flex items-start justify-center">
        <div
          className="w-full"
          style={{
            maxWidth: activeSpec.maxWidth ? `${activeSpec.maxWidth}px` : '900px',
          }}
        >
          <MorphChat.Surface
            spec={activeSpec}
            adapter={adapter}
            onMorph={handleMorph}
            className="h-full min-h-[300px] max-h-[600px]"
          />
        </div>
      </div>
    </div>
  )
}
