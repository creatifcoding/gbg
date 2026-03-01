/**
 * ChatThinkingBlock.Root — Compound root with collapsible state.
 *
 * Manages open/close, auto-close after streaming completes,
 * duration tracking, and context provision for sub-components.
 *
 * Pattern: components.build compound root with context.
 * Mirrors AI Elements' Reasoning component but TMNL-styled.
 *
 * @module chat/msg/thinking-block
 */

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { useBlockDensity, useBlockInteractivity } from '../density-context'
import { ChatThinkingBlockContext, type ChatThinkingBlockContextValue } from './thinking-block-context'

// =============================================================================
// Constants
// =============================================================================

/** Delay before auto-closing after streaming ends (ms) */
const AUTO_CLOSE_DELAY = 1200

const MS_IN_S = 1000

// =============================================================================
// EPOCH-0005: Thinking Heatmap — duration-keyed border/bg colors
// =============================================================================

/**
 * Heatmap color scale for thinking duration.
 *
 * Communicates cognitive effort visually:
 * - Violet (0s): fresh start — model just entered reasoning
 * - Blue (2s): warming up — light reasoning
 * - Blue-400 (5s): engaged — moderate effort
 * - Amber (15s): deep reasoning — extended chain-of-thought
 * - Rose (30s): extreme effort — complex multi-step reasoning
 *
 * Colors persist after collapse — the heatmap is a visible record of effort.
 * transition-colors duration-700 in the component smooths shifts.
 */
const THINKING_HEATMAP = [
  { threshold: 0,  border: 'border-violet-500/20', bg: 'bg-violet-500/[0.03]', hoverBorder: 'hover:border-violet-500/30', hoverBg: 'hover:bg-violet-500/[0.06]' },
  { threshold: 2,  border: 'border-blue-500/20',   bg: 'bg-blue-500/[0.03]',   hoverBorder: 'hover:border-blue-500/30',   hoverBg: 'hover:bg-blue-500/[0.06]' },
  { threshold: 5,  border: 'border-blue-400/20',   bg: 'bg-blue-400/[0.03]',   hoverBorder: 'hover:border-blue-400/30',   hoverBg: 'hover:bg-blue-400/[0.06]' },
  { threshold: 15, border: 'border-amber-500/20',  bg: 'bg-amber-500/[0.03]',  hoverBorder: 'hover:border-amber-500/30',  hoverBg: 'hover:bg-amber-500/[0.06]' },
  { threshold: 30, border: 'border-rose-500/20',   bg: 'bg-rose-500/[0.03]',   hoverBorder: 'hover:border-rose-500/30',   hoverBg: 'hover:bg-rose-500/[0.06]' },
] as const

function getHeatmapColors(elapsedSec: number) {
  let entry = THINKING_HEATMAP[0]
  for (const h of THINKING_HEATMAP) {
    if (elapsedSec >= h.threshold) entry = h
    else break
  }
  return entry
}

// =============================================================================
// Props
// =============================================================================

export interface ChatThinkingBlockRootProps extends ComponentPropsWithoutRef<'div'> {
  /** Whether thinking is currently streaming */
  isStreaming?: boolean
  /** Controlled open state */
  open?: boolean
  /** Default open state (uncontrolled) */
  defaultOpen?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
  /** Pre-computed duration in ms (from adapter) */
  durationMs?: number
  children?: ReactNode
}

// =============================================================================
// Component
// =============================================================================

export const ChatThinkingBlockRoot = memo(forwardRef<HTMLDivElement, ChatThinkingBlockRootProps>(
  (
    {
      isStreaming = false,
      open: controlledOpen,
      defaultOpen = true,
      onOpenChange,
      durationMs: durationMsProp,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    // ── Density ───────────────────────────────────────────
    const density = useBlockDensity('thinking')
    const { expandCollapse } = useBlockInteractivity()

    // ── State ────────────────────────────────────────────
    const [internalOpen, setInternalOpen] = useState(defaultOpen)
    const isOpen = controlledOpen ?? internalOpen
    const setIsOpen = useCallback((next: boolean) => {
      setInternalOpen(next)
      onOpenChange?.(next)
    }, [onOpenChange])

    // ── Duration tracking ────────────────────────────────
    const [durationSec, setDurationSec] = useState<number | undefined>(
      durationMsProp != null ? Math.ceil(durationMsProp / MS_IN_S) : undefined,
    )
    const startTimeRef = useRef<number | null>(null)
    const hasAutoClosedRef = useRef(false)

    // EPOCH-0005: Live elapsed counter during streaming (drives heatmap)
    // Local state, not atom — this is pure display state for the timer.
    const [liveElapsed, setLiveElapsed] = useState(0)

    // Track streaming start/end for duration
    useEffect(() => {
      if (isStreaming) {
        if (startTimeRef.current === null) {
          startTimeRef.current = Date.now()
        }
      } else if (startTimeRef.current !== null) {
        // Streaming just ended — compute duration
        const elapsed = Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S)
        setDurationSec(elapsed)
        startTimeRef.current = null
      }
    }, [isStreaming])

    // EPOCH-0005: 1s interval for live elapsed (drives heatmap color shifts)
    useEffect(() => {
      if (!isStreaming) {
        setLiveElapsed(0)
        return
      }
      const tick = () => {
        if (startTimeRef.current != null) {
          setLiveElapsed(Math.floor((Date.now() - startTimeRef.current) / MS_IN_S))
        }
      }
      tick() // Initial
      const id = setInterval(tick, 1000)
      return () => clearInterval(id)
    }, [isStreaming])

    // EPOCH-0005: Resolve heatmap colors from elapsed time
    const heatmapElapsed = isStreaming ? liveElapsed : (durationSec ?? 0)
    const heatmap = getHeatmapColors(heatmapElapsed)

    // Sync external durationMs prop
    useEffect(() => {
      if (durationMsProp != null) {
        setDurationSec(Math.ceil(durationMsProp / MS_IN_S))
      }
    }, [durationMsProp])

    // ── Auto-close after streaming ends ──────────────────
    useEffect(() => {
      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosedRef.current) {
        const timer = setTimeout(() => {
          setIsOpen(false)
          hasAutoClosedRef.current = true
        }, AUTO_CLOSE_DELAY)
        return () => clearTimeout(timer)
      }
    }, [isStreaming, isOpen, defaultOpen, setIsOpen])

    // ── Context ──────────────────────────────────────────
    // EPOCH-0005: During streaming, expose liveElapsed as durationSec so
    // the trigger shows "Thinking… 12s" in real-time.
    const ctx: ChatThinkingBlockContextValue = {
      isStreaming,
      isOpen: density === 'pill' ? false : isOpen, // pill never expands
      setIsOpen: expandCollapse ? setIsOpen : () => {}, // gate collapse by interactivity
      durationSec: isStreaming ? (liveElapsed > 0 ? liveElapsed : undefined) : durationSec,
    }

    // ── Pill density: single-line indicator ──────────────
    if (density === 'pill') {
      return (
        <ChatThinkingBlockContext.Provider value={ctx}>
          <div
            ref={ref}
            data-slot="tmnl-chat-thinking-block"
            data-density="pill"
            data-streaming={isStreaming || undefined}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
              'border transition-colors duration-700',
              heatmap.border, heatmap.bg,
              isStreaming && 'animate-pulse',
              className,
            )}
            {...props}
          >
            <span className="text-violet-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}>
              {isStreaming ? `thinking… ${liveElapsed}s` : durationSec != null ? `${durationSec}s` : 'thought'}
            </span>
          </div>
        </ChatThinkingBlockContext.Provider>
      )
    }

    // ── Full/Compact density ─────────────────────────────
    return (
      <ChatThinkingBlockContext.Provider value={ctx}>
        <div
          ref={ref}
          data-slot="tmnl-chat-thinking-block"
          data-density={density}
          data-state={isOpen ? 'open' : 'closed'}
          data-streaming={isStreaming || undefined}
          className={cn(
            'rounded border transition-colors duration-700',
            density === 'compact' ? 'my-1' : 'my-1.5',
            heatmap.border, heatmap.bg,
            heatmap.hoverBorder, heatmap.hoverBg,
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </ChatThinkingBlockContext.Provider>
    )
  },
))

ChatThinkingBlockRoot.displayName = 'ChatThinkingBlock.Root'
