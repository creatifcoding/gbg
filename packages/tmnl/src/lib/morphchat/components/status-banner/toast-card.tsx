/**
 * Toast card — compact 22px card with swipe-to-dismiss.
 *
 * Compact sizing:
 *   height: 22px  (was ~32px)
 *   font:   12px  (was 14px)
 *   icon:   12px  (was 15px)
 *   pad:    px-2 py-0.5  (was px-3 py-1.5)
 *   radius: rounded (4px)  (was rounded-lg/8px)
 *
 * No liquid glass SVG filter. No backdrop-blur. Solid vantablack bg.
 *
 * @module morphchat/components/status-banner/toast-card
 */

import { memo } from 'react'
import { motion } from 'motion/react'
import { Ban, Maximize2, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatusRowLike } from './types'
import { TONE_STYLES, TONE_BG } from './tone-styles'
import { truncateStatus } from './parse-error'
import { BannerAction } from './banner-action'
import { CountBadge } from './count-badge'
import { useSwipe } from './hooks'
import {
  CARD_OVERLAP, CARD_SCALE_STEP, CARD_OPACITY_STEP,
  VISIBLE_CARDS, EXPANDED_GAP, STAGGER_MS,
  CARD_ICON_SIZE, CARD_ICON_STROKE,
  ENTER_TRANSITION, EXIT_TRANSITION, EXIT_CURVE,
} from './constants'

export interface ToastCardProps {
  item: StatusRowLike
  index: number
  totalCount: number
  isCancelled: boolean
  expanded: boolean
  narrow: boolean
  showRecoveryActions: boolean
  onExpand: (row: StatusRowLike) => void
  onDismiss: (id: string) => void
  onReconnect: () => void
}

export const ToastCard = memo(function ToastCard({
  item, index, totalCount, isCancelled, expanded, narrow,
  showRecoveryActions, onExpand, onDismiss, onReconnect,
}: ToastCardProps) {
  const depth = Math.min(index, VISIBLE_CARDS - 1)
  const isFront = index === 0
  const isHidden = !expanded && index >= VISIBLE_CARDS
  const tone = TONE_STYLES[item.tone] ?? TONE_STYLES.info
  const bg = TONE_BG[item.tone] ?? TONE_BG.info
  const Icon = isCancelled ? Ban : tone.IconComponent
  const displayText = expanded ? item.text : truncateStatus(item.text)
  const canExpand = !!item.details || item.text.length > 180
  const staggerDelay = `${index * STAGGER_MS}ms`

  const swipe = useSwipe(() => onDismiss(item.id))

  return (
    <motion.div
      initial={{ y: '-100%', opacity: 0 }}
      animate={{
        y: 0,
        x: swipe.swiping || swipe.swipedOut ? swipe.swipeX : 0,
        opacity: swipe.opacity,
        filter: swipe.blur > 0 ? `blur(${swipe.blur}px)` : 'blur(0px)',
      }}
      exit={{
        x: swipe.swipedOut ? swipe.swipeX + 300 : '110%',
        opacity: 0,
        filter: 'blur(3px)',
      }}
      transition={{
        y: ENTER_TRANSITION,
        x: swipe.swiping ? { duration: 0 } : EXIT_TRANSITION,
        opacity: swipe.swiping ? { duration: 0 } : { duration: 0.2, ease: EXIT_CURVE },
        filter: { duration: 0.2, ease: EXIT_CURVE },
      }}
      className={cn(
        'relative overflow-hidden touch-pan-y',
        'flex items-center rounded border font-mono min-w-0',
        narrow ? 'gap-1 px-1.5 py-px' : 'gap-1.5 px-2 py-0.5',
        tone.card,
        isHidden && 'invisible pointer-events-none',
        swipe.swiping && 'cursor-grabbing select-none',
      )}
      style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        zIndex: 100 - index,
        background: bg,
        boxShadow: tone.glow,
        marginTop: index === 0 ? 0 : expanded ? EXPANDED_GAP : CARD_OVERLAP,
        transform: expanded ? 'scale(1)' : `scale(${1 - depth * CARD_SCALE_STEP})`,
        opacity: expanded ? 1 : isFront ? 1 : Math.max(0.35, 1 - depth * CARD_OPACITY_STEP),
        transformOrigin: 'top center',
        transition: swipe.swiping ? 'none' : [
          `margin-top 200ms ease-out ${staggerDelay}`,
          `transform 200ms ease-out ${staggerDelay}`,
          `opacity 200ms ease-out ${staggerDelay}`,
        ].join(', '),
        willChange: 'transform, opacity, margin-top',
      }}
      onPointerDown={swipe.handlePointerDown}
      onPointerMove={swipe.handlePointerMove}
      onPointerUp={swipe.handlePointerUp}
    >
      {/* Icon */}
      <Icon
        size={CARD_ICON_SIZE}
        strokeWidth={CARD_ICON_STROKE}
        className={cn('shrink-0 relative', isCancelled ? 'text-neutral-500' : tone.icon)}
      />

      {/* Text */}
      <span className={cn(
        'flex-1 min-w-0 relative',
        expanded ? 'whitespace-pre-wrap break-words' : 'truncate',
      )}>
        {displayText}
      </span>

      {/* Actions — front card always, all when expanded */}
      {(expanded || isFront) && (
        <div className="flex items-center gap-0.5 shrink-0 relative">
          {canExpand && !isCancelled && (
            <BannerAction onClick={() => onExpand(item)} title="View full error payload">
              <Maximize2 size={11} strokeWidth={1.5} />
            </BannerAction>
          )}
          {!isCancelled && item.source === 'harness' && (showRecoveryActions || item.code === 'session-missing') && (
            <BannerAction onClick={onReconnect} title="Reconnect">
              <RefreshCw size={11} strokeWidth={1.5} />
            </BannerAction>
          )}
          <BannerAction onClick={() => onDismiss(item.id)} title="Dismiss">
            <X size={11} strokeWidth={1.5} />
          </BannerAction>
        </div>
      )}

      {/* Collapsed badge */}
      {!expanded && isFront && <CountBadge count={totalCount} />}
    </motion.div>
  )
})

ToastCard.displayName = 'ToastCard'
