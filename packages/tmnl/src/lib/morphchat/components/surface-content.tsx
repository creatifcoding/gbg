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

import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
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
import { StatusBannerView } from './status-banner'
import { useSurfaceWidth } from '@/lib/chat/hooks/use-surface-width'

// =============================================================================
// Animation Constants
// =============================================================================

/** iOS-style easing curve */
const EASE_MORPH = [0.32, 0.72, 0, 1] as const

/** Morph duration in seconds (strict snappiness budget) */
const MORPH_DURATION = 0.16

/** Keep stagger disabled on operational surfaces */
const STAGGER_DELAY = 0

/** Bounds transition for intentional morph only */
const SPRING_BOUNDS = { type: 'spring' as const, stiffness: 520, damping: 48, mass: 0.75 }

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
  children?: ReactNode
  className?: string
}

export function SurfaceContent({ children, className }: SurfaceContentProps) {
  const { spec, adapter, surfaceId, isMorphing } = useMorphChatContext()
  const prefersReducedMotion = useReducedMotion()
  const shouldAnimateMorph = isMorphing && !prefersReducedMotion

  // ── Width-tier measurement (shared by thread + composer) ──
  const surfaceRef = useRef<HTMLDivElement>(null)
  const widthTier = useSurfaceWidth(surfaceRef)

  // Emit MORPH_DONE after animation settles
  const morphTimerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (isMorphing) {
      clearTimeout(morphTimerRef.current)
      // Fast completion for routine preset shifts
      const totalMs = (MORPH_DURATION + STAGGER_DELAY * 7) * 1000 + 40
      morphTimerRef.current = setTimeout(() => {
        sendSurfaceEvent(surfaceId, { type: 'MORPH_DONE' })
      }, totalMs)
    }
    return () => clearTimeout(morphTimerRef.current)
  }, [isMorphing, surfaceId])

  // Scroll position preservation
  const threadScrollRef = useRef<number>(0)
  const threadContainerRef = useRef<HTMLDivElement>(null)

  // Save scroll position before morph
  useEffect(() => {
    if (threadContainerRef.current) {
      threadScrollRef.current = threadContainerRef.current.scrollTop
    }
  }, [spec._tag]) // trigger on spec change

  // Restore scroll position after morph
  useEffect(() => {
    if (threadContainerRef.current && threadScrollRef.current > 0) {
      threadContainerRef.current.scrollTop = threadScrollRef.current
    }
  })

  // Keyboard shortcuts scoped by spec.keyboardShortcuts axis
  const onKeyDown = useKeyboardShortcuts({
    scope: spec.keyboardShortcuts,
    adapter,
  })

  // Select animation variants based on policy + reduced motion
  const exitAnim = shouldAnimateMorph ? BAND_EXIT : REDUCED_EXIT
  const enterAnim = shouldAnimateMorph ? BAND_ENTER : REDUCED_ENTER
  const initialAnim = shouldAnimateMorph ? BAND_INITIAL : REDUCED_INITIAL
  const transition = shouldAnimateMorph
    ? { duration: MORPH_DURATION, ease: EASE_MORPH }
    : { duration: 0.1, ease: 'linear' as const }

  // Stagger delay factory (disabled for operational snappiness)
  const stagger = (index: number) =>
    shouldAnimateMorph
      ? { duration: MORPH_DURATION, ease: EASE_MORPH, delay: index * STAGGER_DELAY }
      : { duration: 0.1, ease: 'linear' as const }

  // Layout constraints from spec — animated with spring bounds
  const constraintStyle = useMemo(() => ({
    maxHeight: spec.maxHeight ?? undefined,
    maxWidth: spec.maxWidth ?? undefined,
    minHeight: spec.minHeight ?? undefined,
  }), [spec.maxHeight, spec.maxWidth, spec.minHeight])

  // ── Band visibility from spec ─────────────────────────

  const showFrameChrome = spec.frameChrome !== 'none'
  const showThread = spec.thread !== 'none'
  const showInlineTasks = spec.inlineTasks !== 'hidden'
  const showComposer = spec.composer !== 'none'

  // Band index for stagger (only count visible bands)
  let bandIndex = 0

  return (
    <LayoutGroup id={`morphchat-${surfaceId}`}>
      <motion.div
        ref={surfaceRef}
        layout={shouldAnimateMorph}
        transition={shouldAnimateMorph ? SPRING_BOUNDS : transition}
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
        <AnimatePresence mode={shouldAnimateMorph ? 'popLayout' : 'sync'}>
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

          {/* ── Band 2+3: Status toasts overlay thread ─ */}
          {showThread && (
            <motion.div
              key="band-thread"
              layoutId="morphchat-thread"
              ref={threadContainerRef}
              initial={initialAnim}
              animate={enterAnim}
              exit={exitAnim}
              transition={stagger(bandIndex++)}
              className="flex-1 min-h-0 flex flex-col relative"
            >
              {/* Status toasts — absolute overlay, no layout shift */}
              <div className="absolute inset-x-0 top-0 z-10 px-3 py-1 pointer-events-none">
                <div className="pointer-events-auto">
                  <StatusBannerView />
                </div>
              </div>
              <ThreadView widthTier={widthTier} />
            </motion.div>
          )}

          {/* ── Band 4: Inline Tasks ─────────────────── */}
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

          {/* ── Band 5: Command Band ─────────────────── */}
          {/* ── Band 6: Composer ──────────────────────── */}
          {showComposer && (
            <motion.div
              key="band-composer"
              layoutId="morphchat-composer"
              initial={initialAnim}
              animate={enterAnim}
              exit={exitAnim}
              transition={stagger(bandIndex++)}
              className=""
            >
              <ComposerView widthTier={widthTier} />
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
