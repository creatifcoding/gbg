/**
 * TMNL Markdown Structural Elements — blockquote, hr, img.
 *
 * Animated (STATIC MODE ONLY — gated during streaming to prevent re-fire):
 *   blockquote — slide from left + fade (matches accent border metaphor)
 *   hr         — grow from center (communicates "pause, breathe")
 *   img        — fade on load (softens lazy-load pop-in)
 *
 * @module chat/msg/md-components/structural
 */

import { memo, useState, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { sameClassAndNode, sameNodePosition, type WithNode } from './types'
import { useMdContext } from './md-context'
import {
  EASE_OUT,
  EASE_GENTLE,
  DURATION_ENTER,
  DURATION_ENTER_HEAVY,
} from './motion'

// ─── Blockquote ─────────────────────────────────────────────────────────────
// Purpose: "set apart" — the quote slides in from the left, matching the
// border-l accent. Communicates visual separation from surrounding text.
// Gated: animation only in static mode to avoid re-fire during streaming.

type BlockquoteProps = WithNode<JSX.IntrinsicElements['blockquote']>

const blockquoteClasses = 'border-l-2 border-cyan-500/40 pl-3 my-2 text-neutral-400 italic'

export const MdBlockquote = memo<BlockquoteProps>(
  ({ children, className, node, ...props }) => {
    const { streaming } = useMdContext()
    const reduced = useReducedMotion()

    // During streaming: no entrance animation (avoids re-fire from block splitting)
    if (streaming) {
      return (
        <blockquote
          className={cn(blockquoteClasses, className)}
          data-tmnl-md="blockquote"
          {...props}
        >
          {children}
        </blockquote>
      )
    }

    return (
      <motion.blockquote
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: DURATION_ENTER, ease: EASE_OUT }}
        className={cn(blockquoteClasses, className)}
        data-tmnl-md="blockquote"
        {...props}
      >
        {children}
      </motion.blockquote>
    )
  },
  sameClassAndNode,
)
MdBlockquote.displayName = 'TmnlMd.Blockquote'

// ─── Horizontal Rule ────────────────────────────────────────────────────────
// Purpose: "pause, breathe" — the rule grows from center outward.
// Gated: animation only in static mode.

type HrProps = WithNode<JSX.IntrinsicElements['hr']>

const hrClasses = 'border-0 h-px my-4 bg-gradient-to-r from-transparent via-neutral-700/60 to-transparent'

export const MdHr = memo<HrProps>(
  ({ className, node, ...props }) => {
    const { streaming } = useMdContext()
    const reduced = useReducedMotion()

    if (streaming) {
      return (
        <hr
          className={cn(hrClasses, className)}
          data-tmnl-md="horizontal-rule"
          {...props}
        />
      )
    }

    return (
      <motion.hr
        initial={reduced ? { opacity: 0 } : { opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: DURATION_ENTER_HEAVY, ease: EASE_OUT }}
        className={cn(hrClasses, 'origin-center', className)}
        data-tmnl-md="horizontal-rule"
        {...props}
      />
    )
  },
  sameClassAndNode,
)
MdHr.displayName = 'TmnlMd.Hr'

// ─── Image ──────────────────────────────────────────────────────────────────
// Purpose: soften lazy-load pop-in. The image fades in on load.
// Gated: animation only in static mode.

type ImgProps = WithNode<JSX.IntrinsicElements['img']> & {
  src?: string
  alt?: string
}

export const MdImg = memo<ImgProps>(
  ({ src, alt, className, node, ...props }) => {
    const { streaming } = useMdContext()
    const [loaded, setLoaded] = useState(false)
    const onLoad = useCallback(() => setLoaded(true), [])

    const imgEl = streaming ? (
      <img
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        className={cn('max-w-full rounded border border-neutral-800/40', className)}
        {...props}
      />
    ) : (
      <motion.img
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        onLoad={onLoad}
        initial={{ opacity: 0 }}
        animate={loaded ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: DURATION_ENTER, ease: EASE_GENTLE }}
        className={cn('max-w-full rounded border border-neutral-800/40', className)}
        {...props}
      />
    )

    return (
      <span className="block my-3" data-tmnl-md="image">
        {imgEl}
        {alt && (
          <span
            className="block mt-1 text-neutral-500 italic"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {alt}
          </span>
        )}
      </span>
    )
  },
  (p, n) => p.src === n.src && p.alt === n.alt && sameNodePosition(p.node, n.node),
)
MdImg.displayName = 'TmnlMd.Img'
