/**
 * Frame Chrome View — Dual-Zone Header Strip (Responsive)
 *
 * Single 28px row with 3 responsive tiers via CSS container queries:
 *
 *   ≥480px (full):    [● capsule] | [model ▾] [agent] [↻] [✕]
 *   380–479px (compact): [● capsule] | [model ▾] [↻] [✕]
 *   <380px (minimal):    [●] [model… ▾] [⋯]
 *
 * Progressive shed: agent name → tokenomics hover → zone divider → controls → overflow.
 *
 * @module morphchat/components/frame-chrome-view
 */

import { useState, useCallback, useRef, type ReactNode, type ComponentPropsWithoutRef } from 'react'
import { Atom } from '@effect-atom/atom'
import { useAtomValue } from '@effect-atom/atom-react'
import { RotateCcw, X, MoreHorizontal } from 'lucide-react'
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
const ICON_SIZE_SM = 11
const REVEAL_MS = 200
const REVEAL_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

// ─── Container query breakpoints ─────────────────────────────────────────────

/** Injected once into DOM. Defines the responsive tiers. */
const CONTAINER_STYLES = `
@container frame-chrome (min-width: 480px) {
  [data-tier="agent"]     { display: flex !important; }
  [data-tier="divider"]   { display: block !important; }
  [data-tier="controls"]  { display: flex !important; }
  [data-tier="overflow"]  { display: none !important; }
  [data-tier="left-zone"] { padding-inline: 12px; }
  [data-tier="right-zone"]{ padding-inline: 12px; gap: 8px; }
}
@container frame-chrome (min-width: 380px) and (max-width: 479px) {
  [data-tier="agent"]     { display: none !important; }
  [data-tier="divider"]   { display: block !important; }
  [data-tier="controls"]  { display: flex !important; }
  [data-tier="overflow"]  { display: none !important; }
  [data-tier="left-zone"] { padding-inline: 12px; }
  [data-tier="right-zone"]{ padding-inline: 12px; gap: 6px; }
}
@container frame-chrome (max-width: 379px) {
  [data-tier="agent"]     { display: none !important; }
  [data-tier="divider"]   { display: none !important; }
  [data-tier="controls"]  { display: none !important; }
  [data-tier="overflow"]  { display: flex !important; }
  [data-tier="left-zone"] { padding-inline: 8px; }
  [data-tier="right-zone"]{ padding-inline: 8px; gap: 4px; }
}
` as const

let stylesInjected = false
function ensureContainerStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.setAttribute('data-frame-chrome', '')
  el.textContent = CONTAINER_STYLES
  document.head.appendChild(el)
  stylesInjected = true
}

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

  ensureContainerStyles()

  // Agent name (duck-typed mock adapter)
  const mockAdapter = adapter as Partial<MockChatAdapter>
  const agents = useAtomValue(adapter.agents$)
  const activeAgentId = useAtomValue(mockAdapter.activeAgentId$ ?? NULL_AGENT_ID) ?? undefined
  const activeAgent = agents.find(a => a.id === activeAgentId) ?? agents[0]

  // Context usage
  const contextUsage = useAtomValue((adapter as any).contextUsage$ ?? NULL_CONTEXT_USAGE)

  // Left zone hover state — drives progressive disclosure of tokenomics
  const [leftHovered, setLeftHovered] = useState(false)

  // Overflow menu state (minimal tier)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  // Chrome actions
  const handleReset = useCallback(() => {
    Effect.runSync(adapter.clear())
  }, [adapter])

  const handleClose = useCallback(() => {
    Effect.runSync(adapter.dispose())
  }, [adapter])

  // ── Bail on none / pill ───────────────────────────────────
  if (spec.frameChrome === 'none') return null
  if (density === 'pill') return null

  // ── Minimal spec: capsule + model only ────────────────────
  if (spec.frameChrome === 'minimal') {
    return (
      <div
        data-slot="morphchat-frame-chrome"
        className="flex items-center gap-2 px-3 border-b border-neutral-800/30"
        style={{ height: 28, containerType: 'inline-size', containerName: 'frame-chrome' }}
      >
        <ConnectionCapsule />
        <div className="flex-1 flex justify-center min-w-0">
          <ModelSelectorView />
        </div>
      </div>
    )
  }

  // ── Full spec: Dual-Zone Strip (responsive) ───────────────
  const showAgent = density !== 'compact' && activeAgent && spec.agentSelector !== 'hidden'

  return (
    <div
      data-slot="morphchat-frame-chrome"
      className="flex items-center border-b border-neutral-800/30"
      style={{ height: 28, containerType: 'inline-size', containerName: 'frame-chrome' }}
    >
      {/* ── LEFT ZONE: Capsule + tokenomics ────────────────── */}
      <div
        data-tier="left-zone"
        className="flex items-center gap-0 shrink-0 px-3"
        onMouseEnter={() => setLeftHovered(true)}
        onMouseLeave={() => setLeftHovered(false)}
      >
        <ConnectionCapsule />

        {/* Tokenomics — disabled at compact/minimal, revealed on hover at full */}
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

      {/* ── DIVIDER (hidden at minimal) ───────────────────── */}
      <div
        data-tier="divider"
        className="w-px self-stretch my-1.5 bg-white/[0.06] shrink-0"
      />

      {/* ── RIGHT ZONE: Model + agent + controls ──────────── */}
      <div
        data-tier="right-zone"
        className="group/right flex items-center gap-2 px-3 flex-1 justify-end min-w-0"
      >
        {/* Model selector — flush text, no border/bg */}
        <div className="flex-1 flex justify-end min-w-0">
          <ModelSelectorView />
        </div>

        {/* Agent name — shed at compact (hidden by container query) */}
        {showAgent && (
          <span
            data-tier="agent"
            className="font-mono shrink-0 text-neutral-700 group-hover/right:text-neutral-500 transition-colors duration-150"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)', display: 'none' }}
          >
            {activeAgent.name}
          </span>
        )}

        {/* Chrome controls — shed at minimal (hidden by container query) */}
        <div
          data-tier="controls"
          className="flex items-center gap-0.5 shrink-0"
          style={{ display: 'none' }}
        >
          <ChromeButton onClick={handleReset} aria-label="Reset session">
            <RotateCcw size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          </ChromeButton>
          <ChromeButton onClick={handleClose} aria-label="Close">
            <X size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          </ChromeButton>
        </div>

        {/* Overflow menu — visible at minimal only */}
        <div
          data-tier="overflow"
          className="relative shrink-0"
          style={{ display: 'none' }}
          ref={overflowRef}
        >
          <ChromeButton
            onClick={() => setOverflowOpen(prev => !prev)}
            aria-label="More actions"
          >
            <MoreHorizontal size={ICON_SIZE_SM} strokeWidth={ICON_STROKE} />
          </ChromeButton>

          {overflowOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOverflowOpen(false)}
              />
              {/* Menu */}
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-[4px] border border-white/[0.06] py-1"
                style={{
                  background: 'rgba(2,2,4,0.98)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  minWidth: 120,
                }}
              >
                <OverflowItem onClick={() => { handleReset(); setOverflowOpen(false) }}>
                  <RotateCcw size={ICON_SIZE_SM} strokeWidth={ICON_STROKE} />
                  <span>Reset</span>
                </OverflowItem>
                <OverflowItem onClick={() => { handleClose(); setOverflowOpen(false) }}>
                  <X size={ICON_SIZE_SM} strokeWidth={ICON_STROKE} />
                  <span>Close</span>
                </OverflowItem>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

FrameChromeView.displayName = 'MorphChat.FrameChromeView'

// ─── Chrome Button — ghost at rest, visible on zone hover ────────────────────

interface ChromeButtonProps extends ComponentPropsWithoutRef<'button'> {
  children: ReactNode
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

// ─── Overflow Menu Item ──────────────────────────────────────────────────────

function OverflowItem({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04] transition-colors duration-100 font-mono"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {children}
    </button>
  )
}
