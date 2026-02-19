/**
 * MorphChat Surface Content — Topology Resolver with Layout Morphing
 *
 * Reads the active spec and renders the component tree with animated
 * layout transitions between presets.
 *
 * Morphing contract:
 * - Shared elements: layoutId on each band → Framer Motion animates position/size
 * - Band exit: scale(0.95) + opacity 0
 * - Band enter: stagger in with 50ms delay per band
 * - Container: spring bounds (slight overshoot then settle)
 * - Timing: 333ms, interruptible
 * - Reduced motion: opacity crossfade only
 * - Scroll: preserved across morph via ref
 *
 * @module morphchat/components/surface-content
 */

import * as React from 'react'
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from 'motion/react'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { sendSurfaceEvent } from '../machines/surface-stx'
import { ComposerView } from './composer-view'
import { ThreadView } from './thread-view'
import { InlineTasksView } from './inline-tasks-view'
import { FrameChromeView } from './frame-chrome-view'
import { ConnectionView } from './connection-view'
import { AgentSelectorView } from './agent-selector-view'
import { StatusBannerView } from './status-banner-view'
import { CommandBandView } from './command-band-view'

// =============================================================================
// Animation Constants
// =============================================================================

/** iOS-style easing curve */
const EASE_MORPH = [0.32, 0.72, 0, 1] as const

/** Morph duration in seconds */
const MORPH_DURATION = 0.333

/** Stagger delay between bands (seconds) */
const STAGGER_DELAY = 0.05

/** Spring config for container bounds */
const SPRING_BOUNDS = { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.8 }

/** Band exit animation */
const BAND_EXIT = { opacity: 0, scale: 0.95 }

/** Band enter animation */
const BAND_ENTER = { opacity: 1, scale: 1 }

/** Band initial state (before enter) */
const BAND_INITIAL = { opacity: 0, scale: 0.95 }

// =============================================================================
// Reduced Motion Variants
// =============================================================================

const REDUCED_EXIT = { opacity: 0 }
const REDUCED_ENTER = { opacity: 1 }
const REDUCED_INITIAL = { opacity: 0 }

// =============================================================================
// Surface Content
// =============================================================================

export interface SurfaceContentProps {
  children?: React.ReactNode
  className?: string
}

export function SurfaceContent({ children, className }: SurfaceContentProps) {
  const { spec, adapter, surfaceId, isMorphing } = useMorphChatContext()
  const prefersReducedMotion = useReducedMotion()

  // Emit MORPH_DONE after animation settles
  const morphTimerRef = React.useRef<ReturnType<typeof setTimeout>>()
  React.useEffect(() => {
    if (isMorphing) {
      clearTimeout(morphTimerRef.current)
      // Wait for animation duration + stagger to finish, then signal machine
      const totalMs = (MORPH_DURATION + STAGGER_DELAY * 7) * 1000 + 50
      morphTimerRef.current = setTimeout(() => {
        sendSurfaceEvent(surfaceId, { type: 'MORPH_DONE' })
      }, totalMs)
    }
    return () => clearTimeout(morphTimerRef.current)
  }, [isMorphing, surfaceId])

  // Scroll position preservation
  const threadScrollRef = React.useRef<number>(0)
  const threadContainerRef = React.useRef<HTMLDivElement>(null)

  // Save scroll position before morph
  React.useEffect(() => {
    if (threadContainerRef.current) {
      threadScrollRef.current = threadContainerRef.current.scrollTop
    }
  }, [spec._tag]) // trigger on spec change

  // Restore scroll position after morph
  React.useEffect(() => {
    if (threadContainerRef.current && threadScrollRef.current > 0) {
      threadContainerRef.current.scrollTop = threadScrollRef.current
    }
  })

  // Keyboard shortcuts scoped by spec.keyboardShortcuts axis
  const onKeyDown = useKeyboardShortcuts({
    scope: spec.keyboardShortcuts,
    adapter,
  })

  // Select animation variants based on reduced motion
  const exitAnim = prefersReducedMotion ? REDUCED_EXIT : BAND_EXIT
  const enterAnim = prefersReducedMotion ? REDUCED_ENTER : BAND_ENTER
  const initialAnim = prefersReducedMotion ? REDUCED_INITIAL : BAND_INITIAL
  const transition = prefersReducedMotion
    ? { duration: 0.15, ease: 'easeOut' as const }
    : { duration: MORPH_DURATION, ease: EASE_MORPH }

  // Stagger delay factory
  const stagger = (index: number) =>
    prefersReducedMotion
      ? { duration: 0.15, ease: 'easeOut' as const }
      : { duration: MORPH_DURATION, ease: EASE_MORPH, delay: index * STAGGER_DELAY }

  // Layout constraints from spec — animated with spring bounds
  const constraintStyle = React.useMemo(() => ({
    maxHeight: spec.maxHeight ?? undefined,
    maxWidth: spec.maxWidth ?? undefined,
    minHeight: spec.minHeight ?? undefined,
  }), [spec.maxHeight, spec.maxWidth, spec.minHeight])

  // ── Band visibility from spec ─────────────────────────

  const showFrameChrome = spec.frameChrome !== 'none'
  const showHeader = spec.connectionStatus !== 'hidden' || spec.agentSelector !== 'hidden'
  const showThread = spec.thread !== 'none'
  const showInlineTasks = spec.inlineTasks !== 'hidden'
  const showComposer = spec.composer !== 'none'

  // Band index for stagger (only count visible bands)
  let bandIndex = 0

  return (
    <LayoutGroup id={`morphchat-${surfaceId}`}>
      <motion.div
        layout={!prefersReducedMotion}
        transition={prefersReducedMotion ? transition : SPRING_BOUNDS}
        className={cn(
          'morphchat-surface relative flex flex-col',
          'bg-black text-neutral-200',
          className,
        )}
        style={{
          maxHeight: constraintStyle.maxHeight,
          maxWidth: constraintStyle.maxWidth,
          minHeight: constraintStyle.minHeight,
        }}
        data-morphchat-spec={spec._tag}
        onKeyDown={onKeyDown}
        tabIndex={-1}
      >
        <AnimatePresence mode="popLayout">
          {/* ── Band 1: Frame Chrome ─────────────────── */}
          {showFrameChrome && (
            <motion.div
              key="band-frame-chrome"
              layoutId="morphchat-frame-chrome"
              initial={initialAnim}
              animate={enterAnim}
              exit={exitAnim}
              transition={stagger(bandIndex++)}
            >
              <FrameChromeView />
            </motion.div>
          )}

          {/* ── Band 2: Header (connection + agent) ──── */}
          {showHeader && (
            <motion.div
              key="band-header"
              layoutId="morphchat-header"
              initial={initialAnim}
              animate={enterAnim}
              exit={exitAnim}
              transition={stagger(bandIndex++)}
              className="flex items-center gap-2 px-3 py-1.5 border-b border-neutral-800/50"
            >
              {spec.connectionStatus !== 'hidden' && <ConnectionView />}
              <div className="flex-1" />
              {spec.agentSelector !== 'hidden' && <AgentSelectorView />}
            </motion.div>
          )}

          {/* ── Band 3: Status Banners ───────────────── */}
          <motion.div
            key="band-status"
            layoutId="morphchat-status"
            transition={stagger(bandIndex++)}
          >
            <StatusBannerView />
          </motion.div>

          {/* ── Band 4: Thread ───────────────────────── */}
          {showThread && (
            <motion.div
              key="band-thread"
              layoutId="morphchat-thread"
              ref={threadContainerRef}
              initial={initialAnim}
              animate={enterAnim}
              exit={exitAnim}
              transition={stagger(bandIndex++)}
              className="flex-1 min-h-0 flex flex-col"
            >
              <ThreadView />
            </motion.div>
          )}

          {/* ── Band 5: Inline Tasks ─────────────────── */}
          {showInlineTasks && (
            <motion.div
              key="band-inline-tasks"
              layoutId="morphchat-inline-tasks"
              initial={initialAnim}
              animate={enterAnim}
              exit={exitAnim}
              transition={stagger(bandIndex++)}
            >
              <InlineTasksView />
            </motion.div>
          )}

          {/* ── Band 6: Command Band ─────────────────── */}
          <motion.div
            key="band-commands"
            layoutId="morphchat-commands"
            transition={stagger(bandIndex++)}
          >
            <CommandBandView />
          </motion.div>

          {/* ── Band 7: Composer ──────────────────────── */}
          {showComposer && (
            <motion.div
              key="band-composer"
              layoutId="morphchat-composer"
              initial={initialAnim}
              animate={enterAnim}
              exit={exitAnim}
              transition={stagger(bandIndex++)}
              className="border-t border-neutral-800/50"
            >
              <ComposerView />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Slot overrides from consumer ──────────── */}
        {children}
      </motion.div>
    </LayoutGroup>
  )
}

SurfaceContent.displayName = 'MorphChat.SurfaceContent'
