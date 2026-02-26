/**
 * TMNL Markdown Structural Elements — blockquote, hr, img.
 *
 * Animated:
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
import {
  EASE_OUT,
  EASE_GENTLE,
  DURATION_ENTER,
  DURATION_ENTER_HEAVY,
} from './motion'

// ─── Blockquote ─────────────────────────────────────────────────────────────
// Purpose: "set apart" — the quote slides in from the left, matching the
// border-l accent. Communicates visual separation from surrounding text.

type BlockquoteProps = WithNode<JSX.IntrinsicElements['blockquote']>

export const MdBlockquote = memo<BlockquoteProps>(
  ({ children, className, node, ...props }) => {
    const reduced = useReducedMotion()

    return (
      <motion.blockquote
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: DURATION_ENTER, ease: EASE_OUT }}
        className={cn(
          'border-l-2 border-cyan-500/40 pl-3 my-2',
          'text-neutral-400 italic',
          className,
        )}
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
// Purpose: "pause, breathe" — the rule grows from center outward,
// making the visual break feel intentional, not abrupt.

type HrProps = WithNode<JSX.IntrinsicElements['hr']>

export const MdHr = memo<HrProps>(
  ({ className, node, ...props }) => {
    const reduced = useReducedMotion()

    return (
      <motion.hr
        initial={reduced ? { opacity: 0 } : { opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: DURATION_ENTER_HEAVY, ease: EASE_OUT }}
        className={cn(
          'border-0 h-px my-4',
          'bg-gradient-to-r from-transparent via-neutral-700/60 to-transparent',
          // scaleX origin from center
          'origin-center',
          className,
        )}
        data-tmnl-md="horizontal-rule"
        {...props}
      />
    )
  },
  sameClassAndNode,
)
MdHr.displayName = 'TmnlMd.Hr'

// ─── Image ──────────────────────────────────────────────────────────────────
// Purpose: soften lazy-load pop-in. The image fades in on load rather than
// appearing instantly, making the arrival feel intentional.

type ImgProps = WithNode<JSX.IntrinsicElements['img']> & {
  src?: string
  alt?: string
}

export const MdImg = memo<ImgProps>(
  ({ src, alt, className, node, ...props }) => {
    const [loaded, setLoaded] = useState(false)
    const onLoad = useCallback(() => setLoaded(true), [])

    return (
      <span className="block my-3" data-tmnl-md="image">
        <motion.img
          src={src}
          alt={alt ?? ''}
          loading="lazy"
          onLoad={onLoad}
          initial={{ opacity: 0 }}
          animate={loaded ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: DURATION_ENTER, ease: EASE_GENTLE }}
          className={cn(
            'max-w-full rounded border border-neutral-800/40',
            className,
          )}
          {...props}
        />
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
