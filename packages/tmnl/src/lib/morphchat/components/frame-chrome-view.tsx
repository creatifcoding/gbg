/**
 * Frame Chrome View — MorphChat Header Bar
 *
 * Composes ChatHeaderBand from src/lib/chat/shell/ into MorphChat's
 * spec-driven topology. Reads adapter config for title/subtitle/session,
 * adapter atoms for connection state and agents.
 *
 * spec.frameChrome axis:
 *   - full: Title bar with title/subtitle, connection badge, agent selector, controls
 *   - minimal: Title only, no controls or badges
 *   - none: (not rendered — handled by SurfaceContent)
 *
 * @module morphchat/components/frame-chrome-view
 */

import * as React from 'react'
import { Atom } from '@effect-atom/atom'
import { useAtomValue } from '@effect-atom/atom-react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, RotateCcw, X } from 'lucide-react'
import { Effect } from 'effect'

// Module-level sentinel for conditional hook reads (Rules of Hooks)
const NULL_AGENT_ID = Atom.make<string | null>(null)
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import type { MockChatAdapter } from '../adapters/mock-adapter'
import { morphChatRegistry } from '../atoms/registry'
import { useBlockDensity } from '@/lib/chat/msg/density-context'

// =============================================================================
// Icon sizing (TMNL tokens)
// =============================================================================

const ICON_SIZE = 14
const ICON_STROKE = 1.5

// =============================================================================
// Frame Chrome View
// =============================================================================

export function FrameChromeView() {
  const { spec, adapter } = useMorphChatContext()

  // Read connection state for badge
  const connectionResult = useAtomValue(adapter.connection$)

  // Resolve connection phase to badge display
  const connectionPhase = connectionResult.phase
  const badgeState: 'online' | 'offline' | 'checking' =
    connectionPhase === 'connected' ? 'online'
    : connectionPhase === 'connecting' || connectionPhase === 'reconnecting' ? 'checking'
    : 'offline'

  const badgeDotColor =
    badgeState === 'online' ? 'bg-emerald-400'
    : badgeState === 'checking' ? 'bg-amber-400'
    : 'bg-red-400'

  const badgeTextColor =
    badgeState === 'online' ? 'text-emerald-400'
    : badgeState === 'checking' ? 'text-amber-400'
    : 'text-red-400'

  // Try to read surface config from mock adapter (safe cast — duck-typed)
  const mockAdapter = adapter as Partial<MockChatAdapter>
  const title = mockAdapter.surfaceConfig?.title ?? spec._tag
  const subtitle = mockAdapter.surfaceConfig?.subtitle
  const sessionLabel = mockAdapter.surfaceConfig?.sessionLabel

  // Active agent name (if available)
  const agents = useAtomValue(adapter.agents$)
  // Module-level sentinel ensures useAtomValue is ALWAYS called (Rules of Hooks)
  const activeAgentId = useAtomValue(mockAdapter.activeAgentId$ ?? NULL_AGENT_ID) ?? undefined
  const activeAgent = agents.find(a => a.id === activeAgentId) ?? agents[0]

  // ── Operations ────────────────────────────────────────────

  const handleCollapse = React.useCallback(() => {
    // Placeholder — will wire to adapter.onCollapse when available
    console.log('[MorphChat] Collapse requested')
  }, [])

  const handleReset = React.useCallback(() => {
    Effect.runSync(adapter.clear())
  }, [adapter])

  const handleClose = React.useCallback(() => {
    Effect.runSync(adapter.dispose())
  }, [adapter])

  // ── Render ────────────────────────────────────────────────

  const density = useBlockDensity()

  switch (spec.frameChrome) {
    case 'full': {
      // ── Pill density: no chrome ──
      if (density === 'pill') return null

      // ── Compact density: slim single row ──
      if (density === 'compact') {
        return (
          <div
            data-slot="morphchat-frame-chrome"
            className="flex items-center gap-2 px-3 h-8 border-b border-neutral-800/30"
          >
            <span
              className="text-neutral-400 font-mono tracking-wider uppercase truncate flex-1"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {title}
            </span>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', badgeDotColor)} title={badgeState} />
            <ChromeButton onClick={handleClose} aria-label="Close">
              <X size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </ChromeButton>
          </div>
        )
      }

      // ── Full density: complete header bar ──
      return (
        <div
          data-slot="morphchat-frame-chrome"
          className="flex items-center gap-2 px-3 py-1.5 border-b border-neutral-800/50"
        >
          {/* ── Left: Title + Subtitle ──────────────── */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-neutral-200 font-mono tracking-wider uppercase truncate"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {title}
            </span>
            {subtitle && (
              <span
                className="text-neutral-600 font-mono truncate hidden sm:inline"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {subtitle}
              </span>
            )}
          </div>

          {/* ── Center: Connection + Session ────────── */}
          <div className="flex items-center gap-2 mx-auto">
            {/* Connection badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md',
                'font-mono border border-neutral-800',
                badgeTextColor,
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              role="status"
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', badgeDotColor)} />
              <span className="uppercase tracking-wider">{badgeState}</span>
              {connectionResult.latencyMs != null && (
                <span className="text-neutral-600">{connectionResult.latencyMs}ms</span>
              )}
            </span>

            {/* Session label */}
            {sessionLabel && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md font-mono border border-neutral-800 text-neutral-500"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {sessionLabel}
              </span>
            )}
          </div>

          {/* ── Right: Controls ─────────────────────── */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {/* Active agent indicator (if agents available) */}
            {activeAgent && spec.agentSelector !== 'hidden' && (
              <span
                className="text-neutral-600 font-mono mr-2 hidden md:inline"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                agent: {activeAgent.name}
              </span>
            )}

            <ChromeButton onClick={handleCollapse} aria-label="Collapse">
              <ChevronDown size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </ChromeButton>
            <ChromeButton onClick={handleReset} aria-label="Reset session">
              <RotateCcw size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </ChromeButton>
            <ChromeButton onClick={handleClose} aria-label="Close">
              <X size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </ChromeButton>
          </div>
        </div>
      )
    }

    case 'minimal': {
      // Pill density: no chrome at all
      if (density === 'pill') return null

      return (
        <div
          data-slot="morphchat-frame-chrome"
          className="flex items-center px-3 py-1 border-b border-neutral-800/30"
        >
          <span
            className="text-neutral-500 font-mono tracking-wider uppercase"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {title}
          </span>
        </div>
      )
    }

    case 'none':
    default:
      return null
  }
}

FrameChromeView.displayName = 'MorphChat.FrameChromeView'

// =============================================================================
// Chrome Button — small icon button with scale(0.97) press
// =============================================================================

interface ChromeButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  children: React.ReactNode
}

function ChromeButton({ children, className, ...props }: ChromeButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'p-1.5 rounded transition-all duration-200',
        'text-neutral-600 hover:text-neutral-300',
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
