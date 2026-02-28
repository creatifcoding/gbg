/**
 * Frame Chrome View — Dual-Zone Header Strip (Responsive)
 *
 * Single 28px row with 3 responsive tiers:
 *
 *   ≥480px (full):       [● capsule] | [model ▾] [agent] [↻] [✕]
 *   380–479px (compact): [●]         | [model ▾] [↻] [✕]
 *   <380px (minimal):    [●] [model… ▾] [⋯]
 *
 * Tier is measured via ResizeObserver on the container.
 * Progressive shed: capsule mode → agent name → tokenomics → zone divider → controls → overflow.
 *
 * @module morphchat/components/frame-chrome-view
 */

import {
  useState, useCallback, useRef, useEffect,
  type ReactNode, type ComponentPropsWithoutRef,
} from 'react'
import { Atom } from '@effect-atom/atom'
import { useAtomValue } from '@effect-atom/atom-react'
import { RotateCcw, X, MoreHorizontal } from 'lucide-react'
import { Effect } from 'effect'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import { ConnectionCapsule } from './connection-capsule'
import { viewModeFamily } from './connection-capsule'
import { morphChatRegistry } from '../atoms/registry'
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

// ─── Responsive Tiers ────────────────────────────────────────────────────────

type Tier = 'full' | 'compact' | 'minimal'

const TIER_BREAKPOINTS = { full: 480, compact: 380 } as const

function widthToTier(w: number): Tier {
  if (w >= TIER_BREAKPOINTS.full) return 'full'
  if (w >= TIER_BREAKPOINTS.compact) return 'compact'
  return 'minimal'
}

function useContainerTier(): { ref: React.RefObject<HTMLDivElement | null>; tier: Tier } {
  const ref = useRef<HTMLDivElement | null>(null)
  const [tier, setTier] = useState<Tier>('full')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setTier(widthToTier(entry.contentRect.width))
    })
    ro.observe(el)
    // Initial measurement
    setTier(widthToTier(el.clientWidth))
    return () => ro.disconnect()
  }, [])

  return { ref, tier }
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
  const { spec, adapter, surfaceId } = useMorphChatContext()
  const density = useBlockDensity()
  const { ref: containerRef, tier } = useContainerTier()

  // Agent name (duck-typed mock adapter)
  const mockAdapter = adapter as Partial<MockChatAdapter>
  const agents = useAtomValue(adapter.agents$)
  const activeAgentId = useAtomValue(mockAdapter.activeAgentId$ ?? NULL_AGENT_ID) ?? undefined
  const activeAgent = agents.find(a => a.id === activeAgentId) ?? agents[0]

  // Context usage
  const contextUsage = useAtomValue((adapter as any).contextUsage$ ?? NULL_CONTEXT_USAGE)

  // Left zone hover state — drives progressive disclosure of tokenomics
  const [leftHovered, setLeftHovered] = useState(false)
  // Tokenomics only at full tier
  const showTokenomics = tier === 'full' && leftHovered && !!contextUsage

  // Overflow menu state (minimal tier)
  const [overflowOpen, setOverflowOpen] = useState(false)

  // Force capsule to dot mode when not at full tier
  useEffect(() => {
    if (tier !== 'full') {
      morphChatRegistry.set(viewModeFamily(surfaceId), 'dot')
    }
  }, [tier, surfaceId])

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
        ref={containerRef}
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

  // ── Derived visibility ────────────────────────────────────
  const showAgent = tier === 'full' && density !== 'compact' && activeAgent && spec.agentSelector !== 'hidden'
  const showDivider = tier !== 'minimal'
  const showControls = tier !== 'minimal'
  const showOverflow = tier === 'minimal'

  // ── Tier-dependent padding/gap ────────────────────────────
  const leftPx = tier === 'minimal' ? 'px-2' : 'px-3'
  const rightPx = tier === 'minimal' ? 'px-2' : 'px-3'
  const rightGap = tier === 'minimal' ? 'gap-1' : tier === 'compact' ? 'gap-1.5' : 'gap-2'

  return (
    <div
      ref={containerRef}
      data-slot="morphchat-frame-chrome"
      data-tier={tier}
      className="flex items-center border-b border-neutral-800/30"
      style={{ height: 28 }}
    >
      {/* ── LEFT ZONE: Capsule + tokenomics ────────────────── */}
      <div
        className={cn('flex items-center gap-0 shrink-0', leftPx)}
        onMouseEnter={() => setLeftHovered(true)}
        onMouseLeave={() => setLeftHovered(false)}
      >
        <ConnectionCapsule />

        {/* Tokenomics — only at full tier, revealed on hover */}
        {contextUsage && (
          <div
            className="flex items-center overflow-hidden"
            style={{
              maxWidth: showTokenomics ? 260 : 0,
              opacity: showTokenomics ? 1 : 0,
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
                opacity: showTokenomics ? 1 : 0,
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
      {showDivider && (
        <div className="w-px self-stretch my-1.5 bg-white/[0.06] shrink-0" />
      )}

      {/* ── RIGHT ZONE: Model + agent + controls ──────────── */}
      <div className={cn('group/right flex items-center flex-1 justify-end min-w-0', rightPx, rightGap)}>
        {/* Model selector */}
        <div className="flex-1 flex justify-end min-w-0">
          <ModelSelectorView />
        </div>

        {/* Agent name — full tier only */}
        {showAgent && (
          <span
            className="font-mono shrink-0 text-neutral-700 group-hover/right:text-neutral-500 transition-colors duration-150"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {activeAgent.name}
          </span>
        )}

        {/* Chrome controls — full + compact tiers */}
        {showControls && (
          <div className="flex items-center gap-0.5 shrink-0">
            <ChromeButton onClick={handleReset} aria-label="Reset session">
              <RotateCcw size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </ChromeButton>
            <ChromeButton onClick={handleClose} aria-label="Close">
              <X size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </ChromeButton>
          </div>
        )}

        {/* Overflow menu — minimal tier only */}
        {showOverflow && (
          <div className="relative shrink-0">
            <ChromeButton
              onClick={() => setOverflowOpen(prev => !prev)}
              aria-label="More actions"
            >
              <MoreHorizontal size={ICON_SIZE_SM} strokeWidth={ICON_STROKE} />
            </ChromeButton>

            {overflowOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOverflowOpen(false)} />
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
        )}
      </div>
    </div>
  )
}

FrameChromeView.displayName = 'MorphChat.FrameChromeView'

// ─── Chrome Button ───────────────────────────────────────────────────────────

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
