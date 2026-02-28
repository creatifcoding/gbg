/**
 * Frame Chrome View — Dual-Zone Header Strip
 *
 * Single 28px row replacing both the old Frame Chrome AND the old Header band.
 *
 * ┌──────────────────────┬──────────────────────────────────┐
 * │ LEFT ZONE            │ RIGHT ZONE                       │
 * │ [●]                  │ claude-sonnet-4 ▾  val  ↻  ✕    │
 * │ hover → [● | ↑1.2K…]│ ghost text, brighten on hover    │
 * └──────────────────────┴──────────────────────────────────┘
 *
 * Left: capsule only at rest. Hover → tokenomics reveal (progressive disclosure).
 * Right: flush text model name, ghost controls (neutral-700 → neutral-300 on hover).
 * Zones flex independently. 1px vertical divider.
 *
 * @module morphchat/components/frame-chrome-view
 */

import * as React from 'react'
import { Atom } from '@effect-atom/atom'
import { useAtomValue } from '@effect-atom/atom-react'
import { RotateCcw, X } from 'lucide-react'
import { Effect } from 'effect'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import { ConnectionCapsule } from './connection-capsule'
import { ModelSelectorView } from './model-selector-view'
import type { MockChatAdapter } from '../adapters/mock-adapter'
import type { ContextUsage } from '../hooks/useHarnessAdapter'
import { useBlockDensity } from '@/lib/chat/msg/density-context'

// ─── Sentinels ───────────────────────────────────────────────────────────────

const NULL_CONTEXT_USAGE = Atom.make<ContextUsage | null>(null)
const NULL_AGENT_ID = Atom.make<string | null>(null)

// ─── Constants ───────────────────────────────────────────────────────────────

const ICON_SIZE = 13
const ICON_STROKE = 1.5
const REVEAL_MS = 200
const REVEAL_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function contextPercentColor(percent: number): string {
  if (percent > 90) return 'text-red-400'
  if (percent > 70) return 'text-amber-400'
  return 'text-neutral-500'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FrameChromeView() {
  const { spec, adapter } = useMorphChatContext()
  const density = useBlockDensity()

  // Agent name (duck-typed mock adapter)
  const mockAdapter = adapter as Partial<MockChatAdapter>
  const agents = useAtomValue(adapter.agents$)
  const activeAgentId = useAtomValue(mockAdapter.activeAgentId$ ?? NULL_AGENT_ID) ?? undefined
  const activeAgent = agents.find(a => a.id === activeAgentId) ?? agents[0]

  // Context usage
  const contextUsage = useAtomValue((adapter as any).contextUsage$ ?? NULL_CONTEXT_USAGE)

  // Left zone hover state — drives progressive disclosure of tokenomics
  const [leftHovered, setLeftHovered] = React.useState(false)

  // Chrome actions
  const handleReset = React.useCallback(() => {
    Effect.runSync(adapter.clear())
  }, [adapter])

  const handleClose = React.useCallback(() => {
    Effect.runSync(adapter.dispose())
  }, [adapter])

  // ── Bail on none ──────────────────────────────────────────
  if (spec.frameChrome === 'none') return null

  // ── Pill density: no chrome ───────────────────────────────
  if (density === 'pill') return null

  // ── Minimal: capsule + model, no context/controls ─────────
  if (spec.frameChrome === 'minimal') {
    return (
      <div
        data-slot="morphchat-frame-chrome"
        className="flex items-center gap-2 px-3 border-b border-neutral-800/30"
        style={{ height: 28 }}
      >
        <ConnectionCapsule />
        <div className="flex-1 flex justify-center min-w-0">
          <ModelSelectorView />
        </div>
      </div>
    )
  }

  // ── Full: Dual-Zone Strip ─────────────────────────────────
  const showAgent = density !== 'compact' && activeAgent && spec.agentSelector !== 'hidden'

  return (
    <div
      data-slot="morphchat-frame-chrome"
      className="flex items-center border-b border-neutral-800/30"
      style={{ height: 28 }}
    >
      {/* ── LEFT ZONE: Capsule + progressive disclosure tokenomics ── */}
      <div
        className="flex items-center gap-0 px-3 shrink-0"
        onMouseEnter={() => setLeftHovered(true)}
        onMouseLeave={() => setLeftHovered(false)}
      >
        <ConnectionCapsule />

        {/* Tokenomics — revealed on hover, slides in from behind capsule */}
        {contextUsage && (
          <div
            className="flex items-center overflow-hidden"
            style={{
              maxWidth: leftHovered ? 260 : 0,
              opacity: leftHovered ? 1 : 0,
              transition: [
                `max-width ${REVEAL_MS}ms ${REVEAL_EASE}`,
                `opacity ${REVEAL_MS}ms ${REVEAL_EASE}`,
              ].join(', '),
            }}
          >
            {/* Divider between capsule and tokenomics */}
            <div
              className="w-px self-stretch my-1 shrink-0 ml-2"
              style={{
                background: 'rgba(52,211,153,0.1)',
                opacity: leftHovered ? 1 : 0,
                transition: `opacity ${REVEAL_MS}ms ${REVEAL_EASE}`,
              }}
            />
            <div
              className="flex items-center gap-1.5 font-mono whitespace-nowrap pl-2"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              title={`Context: ${contextUsage.contextTokens.toLocaleString()} / ${contextUsage.contextWindow.toLocaleString()} tokens`}
            >
              <span className="text-neutral-600">↑</span>
              <span className="text-neutral-500">{formatTokens(contextUsage.totalInput)}</span>
              <span className="text-neutral-600">↓</span>
              <span className="text-neutral-500">{formatTokens(contextUsage.totalOutput)}</span>
              {contextUsage.totalCacheRead > 0 && (
                <>
                  <span className="text-neutral-600">R</span>
                  <span className="text-neutral-500">{formatTokens(contextUsage.totalCacheRead)}</span>
                </>
              )}
              <span className={contextPercentColor(contextUsage.contextPercent)}>
                {contextUsage.contextPercent.toFixed(0)}%
              </span>
              {contextUsage.totalCost > 0 && (
                <span className="text-neutral-600">${contextUsage.totalCost.toFixed(3)}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── DIVIDER ───────────────────────────────────────── */}
      <div className="w-px self-stretch my-1.5 bg-white/[0.06] shrink-0" />

      {/* ── RIGHT ZONE: Flush text model + ghost controls ── */}
      <div className="group/right flex items-center gap-2 px-3 flex-1 justify-end min-w-0">
        {/* Model selector — flush text, no border/bg */}
        <div className="flex-1 flex justify-end min-w-0">
          <ModelSelectorView />
        </div>

        {/* Agent name — ghost, brightens on zone hover */}
        {showAgent && (
          <span
            className="font-mono shrink-0 text-neutral-700 group-hover/right:text-neutral-500 transition-colors duration-150"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {activeAgent.name}
          </span>
        )}

        {/* Chrome controls — ghost, brighten on zone hover */}
        <div className="flex items-center gap-0.5 shrink-0">
          <ChromeButton onClick={handleReset} aria-label="Reset session">
            <RotateCcw size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          </ChromeButton>
          <ChromeButton onClick={handleClose} aria-label="Close">
            <X size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          </ChromeButton>
        </div>
      </div>
    </div>
  )
}

FrameChromeView.displayName = 'MorphChat.FrameChromeView'

// ─── Chrome Button — ghost at rest, visible on zone hover ────────────────────

interface ChromeButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  children: React.ReactNode
}

function ChromeButton({ children, className, ...props }: ChromeButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'p-1 rounded transition-colors duration-150',
        'text-neutral-700 hover:text-neutral-300',
        'group-hover/right:text-neutral-500',
        'hover:bg-neutral-800/50',
        'active:scale-[0.97]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
