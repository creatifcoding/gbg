/**
 * Toast card — compact 22px card with inline expand/collapse.
 *
 * The toast IS the detail view. Click to expand → shows category-specific
 * detail component inline. Click again or dismiss → collapse to 22px.
 *
 * Compact sizing:
 *   height: 22px collapsed
 *   font:   12px  (var(--tmnl-text-xs))
 *   icon:   11px lucide (from category registry)
 *   pad:    px-2 py-0.5
 *   radius: rounded (4px)
 *
 * No modal. No backdrop blur. Solid vantablack bg.
 *
 * @module morphchat/components/status-banner/toast-card
 */

import { memo, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Ban, X } from 'lucide-react'
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
  CARD_ICON_STROKE,
  ENTER_TRANSITION, EXIT_TRANSITION, EXIT_CURVE,
} from './constants'

import { categoryOf } from '@/lib/harness/error-detail/category-registry'
import { matchCategory } from '@/lib/harness/error-detail/category-matcher'
import { ErrorDetailProvider } from '@/lib/harness/error-detail/detail-context'
import type { HarnessErrorCode } from '@/lib/harness/error-codes'
import type { ErrorDetailActions, ErrorDetailMeta, ErrorDetailState } from '@/lib/harness/error-detail/types'

export interface ToastCardProps {
  item: StatusRowLike
  index: number
  totalCount: number
  isCancelled: boolean
  /** Stack hover-expand (all cards visible) */
  stackExpanded: boolean
  narrow: boolean
  showRecoveryActions: boolean
  /** Currently inline-expanded card ID (only one at a time) */
  inlineExpandedId: string | null
  onInlineExpand: (id: string | null) => void
  onDismiss: (id: string) => void
  onReconnect: () => void
  onNewSession?: () => void
  sessionId?: string | null
  /** All visible items (for badge worst-severity) */
  allItems?: ReadonlyArray<StatusRowLike>
}

export const ToastCard = memo(function ToastCard({
  item, index, totalCount, isCancelled,
  stackExpanded, narrow, showRecoveryActions,
  inlineExpandedId, onInlineExpand,
  onDismiss, onReconnect, onNewSession, sessionId, allItems,
}: ToastCardProps) {
  const depth = Math.min(index, VISIBLE_CARDS - 1)
  const isFront = index === 0
  const isHidden = !stackExpanded && index >= VISIBLE_CARDS
  const tone = TONE_STYLES[item.tone] ?? TONE_STYLES.info
  const bg = TONE_BG[item.tone] ?? TONE_BG.info
  const displayText = stackExpanded ? item.text : truncateStatus(item.text)
  const staggerDelay = `${index * STAGGER_MS}ms`
  const isInlineExpanded = inlineExpandedId === item.id

  // Category visual config
  const catConfig = useMemo(
    () => item.code ? categoryOf(item.code as HarnessErrorCode) : null,
    [item.code],
  )
  const CategoryIcon = isCancelled ? Ban : (catConfig?.Icon ?? tone.IconComponent)
  const iconColor = isCancelled ? undefined : (catConfig?.accent ?? undefined)

  // Match dispatch for expanded detail component
  const categoryMatch = useMemo(
    () => item.code ? matchCategory(item.code as HarnessErrorCode) : null,
    [item.code],
  )

  const swipe = useSwipe(() => onDismiss(item.id))

  // Click to toggle inline expansion (collapsed cards only, not during swipe)
  const handleCardClick = useCallback(() => {
    if (swipe.swiping || isCancelled) return
    onInlineExpand(isInlineExpanded ? null : item.id)
  }, [swipe.swiping, isCancelled, isInlineExpanded, item.id, onInlineExpand])

  // Detail provider state
  const detailState = useMemo<ErrorDetailState | null>(() => {
    if (!item.code) return null
    return {
      code: item.code as HarnessErrorCode,
      message: item.text.replace(/^\[[^\]]+\]\s*/, ''), // strip [code] prefix
      at: typeof item.details === 'object' && item.details && 'at' in item.details
        ? (item.details as any).at as number
        : Date.now(),
      details: item.details,
    }
  }, [item.code, item.text, item.details])

  const detailActions = useMemo<ErrorDetailActions>(() => ({
    onDismiss: () => {
      onInlineExpand(null)
      onDismiss(item.id)
    },
    onReconnect,
    onNewSession,
  }), [item.id, onDismiss, onInlineExpand, onReconnect, onNewSession])

  const detailMeta = useMemo<ErrorDetailMeta>(() => ({
    config: catConfig ?? categoryOf('stream-error' as HarnessErrorCode),
    sessionId,
  }), [catConfig, sessionId])

  return (
    <motion.div
      layout
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
        layout: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
        y: ENTER_TRANSITION,
        x: swipe.swiping ? { duration: 0 } : EXIT_TRANSITION,
        opacity: swipe.swiping ? { duration: 0 } : { duration: 0.2, ease: EXIT_CURVE },
        filter: { duration: 0.2, ease: EXIT_CURVE },
      }}
      className={cn(
        'relative overflow-hidden touch-pan-y',
        'flex flex-col rounded border font-mono min-w-0',
        isHidden && 'invisible pointer-events-none',
        swipe.swiping && 'cursor-grabbing select-none',
        !isInlineExpanded && 'cursor-pointer',
      )}
      style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        zIndex: isInlineExpanded ? 110 : 100 - index,
        background: catConfig?.bgTint ?? bg,
        border: `1px solid ${catConfig?.borderTint ?? 'rgba(255,255,255,0.06)'}`,
        boxShadow: isInlineExpanded ? '0 4px 20px rgba(0,0,0,0.5)' : tone.glow,
        marginTop: index === 0 ? 0 : stackExpanded ? EXPANDED_GAP : CARD_OVERLAP,
        transform: stackExpanded ? 'scale(1)' : `scale(${1 - depth * CARD_SCALE_STEP})`,
        opacity: stackExpanded ? 1 : isFront ? 1 : Math.max(0.35, 1 - depth * CARD_OPACITY_STEP),
        transformOrigin: 'top center',
        transition: swipe.swiping ? 'none' : [
          `margin-top 200ms ease-out ${staggerDelay}`,
          `transform 200ms ease-out ${staggerDelay}`,
          `opacity 200ms ease-out ${staggerDelay}`,
        ].join(', '),
        willChange: 'transform, opacity, margin-top',
        // Accent stripe on collapsed cards
        borderLeft: isInlineExpanded ? undefined : `2px solid ${catConfig?.accent ?? 'transparent'}`,
      }}
      onPointerDown={isInlineExpanded ? undefined : swipe.handlePointerDown}
      onPointerMove={isInlineExpanded ? undefined : swipe.handlePointerMove}
      onPointerUp={isInlineExpanded ? undefined : swipe.handlePointerUp}
      onClick={isInlineExpanded ? undefined : handleCardClick}
    >
      {/* ─── Collapsed row (always visible) ─── */}
      {!isInlineExpanded && (
        <div className={cn(
          'flex items-center min-w-0',
          narrow ? 'gap-1 px-1.5 py-px' : 'gap-1.5 px-2 py-0.5',
        )} style={{ height: 22 }}>
          {/* Category icon */}
          <CategoryIcon
            size={11}
            strokeWidth={CARD_ICON_STROKE}
            className="shrink-0 relative"
            style={{ color: iconColor }}
          />

          {/* Text */}
          <span className="flex-1 min-w-0 truncate relative">
            {displayText}
          </span>

          {/* Dismiss */}
          {(stackExpanded || isFront) && (
            <BannerAction onClick={(e) => { e.stopPropagation(); onDismiss(item.id) }} title="Dismiss">
              <X size={11} strokeWidth={1.5} />
            </BannerAction>
          )}

          {/* Collapsed badge — front card only */}
          {!stackExpanded && isFront && (
            <CountBadge count={totalCount} items={allItems} />
          )}
        </div>
      )}

      {/* ─── Inline expanded detail ─── */}
      {isInlineExpanded && categoryMatch && detailState && (
        <ErrorDetailProvider state={detailState} actions={detailActions} meta={detailMeta}>
          <categoryMatch.DetailComponent />
        </ErrorDetailProvider>
      )}
    </motion.div>
  )
})

ToastCard.displayName = 'ToastCard'
