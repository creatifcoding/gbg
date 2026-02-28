/**
 * Status Banner View — liquid-glass card-stack toasts for harness status.
 *
 * Material: Dark liquid glass (backdrop blur + SVG feTurbulence refraction +
 * specular inner glow). Procedural displacement — no external maps needed.
 *
 * Stack model: physical deck of cards.
 * - Collapsed: front card visible, back cards peek via negative margin overlap
 * - Expanded on hover: stagger cascade fans cards out (~30ms per card)
 * - Entry: slide down from top (150ms ease-out) via AnimatePresence
 * - Exit: slide out right (150ms ease-in) via AnimatePresence
 * - Auto-dismiss by tone (info 3s, warn 4.5s, error 7s)
 *
 * Engine: Hybrid — Framer Motion for enter/exit, CSS transitions for stack.
 *
 * @module morphchat/components/status-banner-view
 */

import * as React from 'react'
import { Atom } from '@effect-atom/atom'
import { useAtomValue } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Ban, Info, Maximize2, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatErrorDetailsModal } from '@/lib/chat/status'
import { useMorphChatContext } from './surface-context'

// ─── Card stack constants ────────────────────────────────────────────────────

/** Negative margin for collapsed card overlap (px) */
const CARD_OVERLAP = -24
/** Scale reduction per depth level in collapsed stack */
const CARD_SCALE_STEP = 0.04
/** Opacity reduction per depth level in collapsed stack */
const CARD_OPACITY_STEP = 0.15
/** Max visible cards in collapsed stack */
const VISIBLE_CARDS = 3
/** Gap between cards when expanded (px) */
const EXPANDED_GAP = 6
/** Stagger delay per card on expand/collapse (ms) */
const STAGGER_MS = 30

// ─── Swipe-to-dismiss constants (Sonner-grade) ──────────────────────────────

/** Distance threshold for swipe dismiss (px) */
const SWIPE_THRESHOLD = 45
/** Velocity threshold for momentum dismiss (px/ms) — Sonner uses 0.11 */
const VELOCITY_THRESHOLD = 0.11
/** Damping factor when dragging in non-dismiss direction */
const DRAG_DAMPING = 0.3

// ─── FM transition presets ───────────────────────────────────────────────────

/** Entry: slide down — fast start, smooth settle. Custom curve > built-in ease-out */
const ENTER_CURVE = [0.32, 0.72, 0, 1] as const
const ENTER_TRANSITION = { duration: 0.15, ease: ENTER_CURVE }

/**
 * Exit: swipe-out — continues from current drag position.
 * Custom curve: strong deceleration, element "launched" from finger.
 * 200ms matches Sonner's TIME_BEFORE_UNMOUNT.
 */
const EXIT_CURVE = [0.32, 0.72, 0, 1] as const
const EXIT_TRANSITION = { duration: 0.2, ease: EXIT_CURVE }

// ─── Liquid glass SVG filter (procedural, no external assets) ────────────────

const LIQUID_GLASS_FILTER_ID = 'tmnl-liquid-toast'

/**
 * Inline SVG defining the liquid glass refraction filter.
 * Uses feTurbulence for procedural noise + feDisplacementMap for subtle warping.
 * Rendered once, referenced by all toast cards via CSS `filter: url(#id)`.
 */
function LiquidGlassFilterDefs() {
  return (
    <svg
      aria-hidden
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        <filter
          id={LIQUID_GLASS_FILTER_ID}
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          {/* Procedural noise pattern — subtle, organic displacement */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.014"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          {/* Warp source through noise — scale 5 = subtle liquid edge distortion */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}

// ─── Local row shape ─────────────────────────────────────────────────────────

type BannerTone = 'info' | 'warn' | 'error'

interface StatusRowLike {
  readonly id: string
  readonly tone: BannerTone
  readonly text: string
  readonly code?: string
  readonly details?: unknown
  readonly source?: 'mock' | 'harness' | 'surface'
}

const EMPTY_ROWS = Atom.make<ReadonlyArray<StatusRowLike>>([])
const STATUS_ROW_MAX = 180

function truncateStatus(text: string): string {
  if (text.length <= STATUS_ROW_MAX) return text
  return `${text.slice(0, STATUS_ROW_MAX - 1)}…`
}

function parseErrorPayload(raw: unknown): { code?: string; summary: string; details: string } {
  if (typeof raw === 'string') {
    const bracket = raw.match(/^\s*\[([^\]]+)\]\s*(.*)$/)
    if (bracket) {
      const code = bracket[1]?.trim()
      const message = bracket[2]?.trim() ?? ''
      return { code: code || undefined, summary: `${code ? `[${code}] ` : ''}${message}`.trim(), details: raw }
    }
    try {
      const parsed = JSON.parse(raw) as { code?: string; message?: string }
      if (typeof parsed?.message === 'string') {
        return {
          code: typeof parsed.code === 'string' ? parsed.code : undefined,
          summary: `${parsed.code ? `[${parsed.code}] ` : ''}${parsed.message}`,
          details: JSON.stringify(parsed, null, 2),
        }
      }
    } catch { /* plain string */ }
    return { summary: raw, details: raw }
  }
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>
    const code = typeof rec.code === 'string' ? rec.code : undefined
    const message = typeof rec.message === 'string' ? rec.message : JSON.stringify(rec)
    return { code, summary: `${code ? `[${code}] ` : ''}${message}`, details: JSON.stringify(rec, null, 2) }
  }
  return { summary: String(raw), details: String(raw) }
}

// ─── Tone styling ────────────────────────────────────────────────────────────
// Tint applied OVER the liquid glass base. Background uses low-alpha tint so
// the backdrop-blur + refraction shows through, but enough opacity that
// stacked cards don't bleed content through each other.

const TONE_STYLES: Record<BannerTone, {
  /** Border + tinted background + text color */
  card: string
  /** Inset box-shadow for specular inner glow, tone-tinted */
  glow: string
  icon: string
  IconComponent: typeof Info
}> = {
  info: {
    card: 'border-neutral-700/40 text-neutral-200',
    glow: 'inset 0 1px 14px rgba(255,255,255,0.03), 0 6px 24px rgba(0,0,0,0.6)',
    icon: 'text-neutral-400',
    IconComponent: Info,
  },
  warn: {
    card: 'border-amber-600/30 text-amber-100',
    glow: 'inset 0 1px 14px rgba(245,158,11,0.06), 0 6px 24px rgba(0,0,0,0.6)',
    icon: 'text-amber-400',
    IconComponent: AlertTriangle,
  },
  error: {
    card: 'border-red-600/30 text-red-100',
    glow: 'inset 0 1px 14px rgba(239,68,68,0.06), 0 6px 24px rgba(0,0,0,0.6)',
    icon: 'text-red-400',
    IconComponent: XCircle,
  },
}

/**
 * Per-tone background tint — vantablack base.
 * Near-opaque so stacked cards never bleed through each other.
 * Just enough transparency (0.88) for backdrop-blur to register
 * as a subtle luminous edge, not a frosted pane.
 */
const TONE_BG: Record<BannerTone, string> = {
  info: 'rgba(4, 4, 8, 0.88)',
  warn: 'rgba(8, 5, 2, 0.88)',
  error: 'rgba(10, 3, 3, 0.88)',
}

// ─── Error code → tone ───────────────────────────────────────────────────────

const ERROR_SEVERITY: Record<string, BannerTone> = {
  'pi-ai-stream-init-failed': 'error',
  'pi-ai-stream-failed': 'error',
  'stream-timeout': 'error',
  'stream-result-timeout': 'error',
  'pi-ai-stream-result-failed': 'error',
  'session-missing': 'error',
  'stream-error': 'error',
  'tool-round-limit-exceeded': 'warn',
  'tool-use-without-calls': 'warn',
  'model-catalog-failed': 'warn',
}

function toneForCode(code: string): BannerTone {
  return ERROR_SEVERITY[code] ?? 'error'
}

// ─── Component ───────────────────────────────────────────────────────────────

const EMPTY_LAST_ERROR = Atom.make<{ code: string; message: string; at: number } | null>(null)
const EMPTY_CANCELLED_AT = Atom.make<number | null>(null)

export function StatusBannerView() {
  const { adapter } = useMorphChatContext()

  const connection = useAtomValue(adapter.connection$)
  const statusRowsAtom = (adapter.statusRows$ as typeof EMPTY_ROWS | undefined) ?? EMPTY_ROWS
  const adapterRows = useAtomValue(statusRowsAtom)
  const lastErrorAtom = ((adapter as any).lastError$ as typeof EMPTY_LAST_ERROR | undefined) ?? EMPTY_LAST_ERROR
  const lastError = useAtomValue(lastErrorAtom)
  const cancelledAtAtom = ((adapter as any).cancelledAt$ as typeof EMPTY_CANCELLED_AT | undefined) ?? EMPTY_CANCELLED_AT
  const cancelledAt = useAtomValue(cancelledAtAtom)

  const [activeRow, setActiveRow] = React.useState<StatusRowLike | null>(null)

  // ── Row assembly ────────────────────────────────────────────────────────
  const rows = React.useMemo<ReadonlyArray<StatusRowLike>>(() => {
    if (adapterRows.length > 0) return adapterRows
    const out: StatusRowLike[] = []
    if (lastError) {
      out.push({
        id: `last-error-${lastError.code}-${lastError.at}`,
        tone: toneForCode(lastError.code),
        text: `[${lastError.code}] ${lastError.message}`,
        code: lastError.code, details: lastError, source: 'harness',
      })
    }
    if (connection.phase === 'error') {
      const parsed = parseErrorPayload((connection as any).error ?? 'stream error')
      out.push({
        id: `conn-error-${parsed.code ?? 'unknown'}-${parsed.summary}`,
        tone: 'error', text: `HARNESS ${parsed.summary}`,
        code: parsed.code, details: parsed.details, source: 'harness',
      })
    }
    if (connection.phase === 'reconnecting') {
      out.push({
        id: `conn-reconnecting-${connection.reconnectAttempt ?? 0}`,
        tone: 'warn',
        text: `HARNESS reconnecting${connection.reconnectAttempt ? ` (attempt ${connection.reconnectAttempt})` : ''}`,
        source: 'harness',
      })
    }
    return out
  }, [adapterRows, connection.phase, connection.reconnectAttempt, (connection as any).error, lastError])

  const showRecoveryActions = connection.phase === 'error' || connection.phase === 'reconnecting'

  // ── Expand: split into immediate visual + deferred content ──────────────
  // The container data-attribute drives CSS visual stacking (margin/scale/opacity)
  // immediately. React content changes (text expand, action buttons) are deferred
  // via useTransition so the compositor isn't blocked by React reconciliation.
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = React.useState(false)
  const deferredExpanded = React.useDeferredValue(expanded)
  const [, startTransition] = React.useTransition()

  const handleMouseEnter = React.useCallback(() => {
    // Immediate: toggle data-attr for CSS-driven visual animation
    containerRef.current?.setAttribute('data-expanded', 'true')
    // Deferred: React content expansion (actions, full text, badge hide)
    startTransition(() => setExpanded(true))
  }, [startTransition])

  const handleMouseLeave = React.useCallback(() => {
    containerRef.current?.setAttribute('data-expanded', 'false')
    startTransition(() => setExpanded(false))
  }, [startTransition])

  // ── Dismiss lifecycle ───────────────────────────────────────────────────
  const dismissTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [dismissedIds, setDismissedIds] = React.useState<ReadonlySet<string>>(new Set())

  const dismissToast = React.useCallback((id: string) => {
    setDismissedIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    const timer = dismissTimersRef.current.get(id)
    if (timer) { clearTimeout(timer); dismissTimersRef.current.delete(id) }
  }, [])

  const toastRows = React.useMemo(
    () => rows.filter((r) => !r.text.startsWith('[sid]')),
    [rows],
  )
  const cancelledToastId = cancelledAt != null ? `cancelled-${cancelledAt}` : null

  // GC dismissed IDs
  React.useEffect(() => {
    const knownIds = new Set(toastRows.map((r) => r.id))
    if (cancelledToastId) knownIds.add(cancelledToastId)
    setDismissedIds((prev) => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) { if (knownIds.has(id)) next.add(id); else changed = true }
      return changed ? next : prev
    })
    for (const [id, timer] of dismissTimersRef.current.entries()) {
      if (!knownIds.has(id)) { clearTimeout(timer); dismissTimersRef.current.delete(id) }
    }
  }, [toastRows, cancelledToastId])

  // Auto-dismiss timers — errors NEVER auto-dismiss, everything else 30s
  React.useEffect(() => {
    for (const row of toastRows) {
      if (dismissedIds.has(row.id) || dismissTimersRef.current.has(row.id)) continue
      // Errors persist until manually dismissed or swiped away
      if (row.tone === 'error') continue
      const timer = setTimeout(() => dismissToast(row.id), 30_000)
      dismissTimersRef.current.set(row.id, timer)
    }
  }, [toastRows, dismissedIds, dismissToast])

  React.useEffect(() => () => {
    for (const timer of dismissTimersRef.current.values()) clearTimeout(timer)
    dismissTimersRef.current.clear()
  }, [])

  // ── Visible items ───────────────────────────────────────────────────────
  const allItems: StatusRowLike[] = React.useMemo(() => {
    const items: StatusRowLike[] = []
    if (cancelledToastId && !dismissedIds.has(cancelledToastId)) {
      items.push({ id: cancelledToastId, tone: 'info', text: 'Cancelled', source: 'harness' })
    }
    for (const row of toastRows) {
      if (!dismissedIds.has(row.id)) items.push(row)
    }
    return items
  }, [toastRows, cancelledToastId, dismissedIds])

  if (allItems.length === 0) return null

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* SVG filter definitions — rendered once */}
      <LiquidGlassFilterDefs />

      {/* Card stack container — hover drives CSS visual stacking immediately,
           React content expansion (actions, full text) is deferred via useTransition */}
      <div
        ref={containerRef}
        data-slot="morphchat-status-toasts"
        data-expanded={expanded}
        data-count={allItems.length}
        className="relative flex flex-col"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <AnimatePresence mode="popLayout">
          {allItems.map((item, index) => (
            <ToastCard
              key={item.id}
              item={item}
              index={index}
              totalCount={allItems.length}
              isCancelled={item.id === cancelledToastId}
              expanded={deferredExpanded}
              showRecoveryActions={showRecoveryActions}
              onExpand={setActiveRow}
              onDismiss={dismissToast}
              onReconnect={() => Effect.runPromise(adapter.reconnect()).catch(() => {})}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Error details modal */}
      <ChatErrorDetailsModal
        open={activeRow != null}
        onOpenChange={(open) => { if (!open) setActiveRow(null) }}
        title={activeRow?.code ? `Harness Error [${activeRow.code}]` : 'Harness Error'}
        summary={activeRow?.text ?? ''}
        details={activeRow?.details ?? activeRow?.text ?? ''}
        severity={(activeRow?.tone ?? 'error') as 'info' | 'warn' | 'error'}
        viewVariant="surface"
        adapterVariant={activeRow?.source === 'mock' ? 'mock' : activeRow?.source === 'harness' ? 'harness' : 'generic'}
        onReconnect={() => Effect.runPromise(adapter.reconnect()).catch(() => {})}
      />
    </>
  )
}

StatusBannerView.displayName = 'MorphChat.StatusBannerView'

// ─── Toast Card (memoized) ───────────────────────────────────────────────────

interface ToastCardProps {
  item: StatusRowLike
  index: number
  totalCount: number
  isCancelled: boolean
  /** Deferred expanded state — controls content (text, actions), not visual stack */
  expanded: boolean
  showRecoveryActions: boolean
  onExpand: (row: StatusRowLike) => void
  onDismiss: (id: string) => void
  onReconnect: () => void
}

/**
 * Individual toast card. Memoized so only cards whose props actually change
 * re-render. Visual stack animation (margin, scale, opacity) is driven by
 * CSS via the parent container's `data-expanded` attribute — no React
 * re-render needed for the hover animation itself.
 */
const ToastCard = React.memo(function ToastCard({
  item, index, totalCount, isCancelled, expanded,
  showRecoveryActions, onExpand, onDismiss, onReconnect,
}: ToastCardProps) {
  const depth = Math.min(index, VISIBLE_CARDS - 1)
  const isFront = index === 0
  const isHidden = !expanded && index >= VISIBLE_CARDS
  const tone = TONE_STYLES[item.tone] ?? TONE_STYLES.info
  const bg = TONE_BG[item.tone] ?? TONE_BG.info
  const Icon = isCancelled ? Ban : tone.IconComponent
  const displayText = expanded ? item.text : truncateStatus(item.text)
  const canExpand = !!item.details || item.text.length > STATUS_ROW_MAX
  const staggerDelay = `${index * STAGGER_MS}ms`

  // ── Swipe-to-dismiss gesture ───────────────────────────────────────────
  const pointerStartRef = React.useRef<{ x: number; y: number; t: number } | null>(null)
  const [swipeX, setSwipeX] = React.useState(0)
  const [swiping, setSwiping] = React.useState(false)
  const [swipedOut, setSwipedOut] = React.useState(false)

  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    // Pointer capture: drag continues even if cursor leaves the card
    (e.target as HTMLElement).setPointerCapture(e.pointerId)
    pointerStartRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    setSwiping(true)
  }, [])

  const handlePointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!pointerStartRef.current || !swiping) return
    const dx = e.clientX - pointerStartRef.current.x
    const dy = e.clientY - pointerStartRef.current.y

    // Only track horizontal swipe — if vertical is dominant, bail
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 10) return

    // Rightward: free movement. Leftward: damped resistance (rubber band)
    const dampedX = dx >= 0 ? dx : dx * DRAG_DAMPING
    setSwipeX(dampedX)
  }, [swiping])

  const handlePointerUp = React.useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId)
    if (!pointerStartRef.current || !swiping) {
      setSwiping(false)
      return
    }

    const dx = e.clientX - pointerStartRef.current.x
    const dt = performance.now() - pointerStartRef.current.t
    const velocity = Math.abs(dx) / dt

    // Momentum dismiss: distance OR velocity exceeds threshold
    if (dx > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      setSwipedOut(true)
      // Delay actual removal to let the exit animation play (200ms)
      setTimeout(() => onDismiss(item.id), 200)
    } else {
      // Snap back — no dismiss
      setSwipeX(0)
    }

    setSwiping(false)
    pointerStartRef.current = null
  }, [swiping, onDismiss, item.id])

  // ── Derived animation values ───────────────────────────────────────────
  // During swipe: direct tracking. On swipe-out: FM takes over via exit.
  // Opacity fades proportionally to swipe distance for visual continuity.
  const swipeOpacity = swipedOut ? 0 : swiping ? Math.max(0, 1 - Math.abs(swipeX) / 200) : 1
  // Blur bridge during exit — masks imperfections (Kowalski rule)
  const swipeBlur = swipedOut ? 2 : swiping ? Math.min(2, Math.abs(swipeX) / 80) : 0

  return (
    <motion.div
      // ── FM lifecycle ───────────────────────────────────
      // Entry: slide down from top
      initial={{ y: '-100%', opacity: 0 }}
      animate={{
        y: 0,
        // During swipe, FM animate tracks live swipeX. Outside swipe, 0.
        x: swiping || swipedOut ? swipeX : 0,
        opacity: swipeOpacity,
        filter: swipeBlur > 0 ? `blur(${swipeBlur}px)` : 'blur(0px)',
      }}
      // Exit: continue from current swipe position + launch offscreen
      exit={{
        x: swipedOut ? swipeX + 300 : '110%',
        opacity: 0,
        filter: 'blur(3px)',
      }}
      transition={{
        // Entry: custom curve, fast
        y: ENTER_TRANSITION,
        // Exit / swipe-out: Sonner-matched 200ms curve
        x: swiping
          ? { duration: 0 } // During drag: zero latency, direct tracking
          : EXIT_TRANSITION,
        opacity: swiping
          ? { duration: 0 }
          : { duration: 0.2, ease: EXIT_CURVE },
        filter: { duration: 0.2, ease: EXIT_CURVE },
      }}
      // ── Card styling ───────────────────────────────────
      className={cn(
        'relative overflow-hidden touch-pan-y',
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono min-w-0',
        tone.card,
        isHidden && 'invisible pointer-events-none',
        swiping && 'cursor-grabbing select-none',
      )}
      style={{
        fontSize: 'var(--tmnl-text-sm, 14px)',
        zIndex: 100 - index,
        // ── Glass material ─────────────────────────────
        background: bg,
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        boxShadow: tone.glow,
        // ── Card stack: CSS transitions for visual stacking ──
        marginTop: index === 0 ? 0 : expanded ? EXPANDED_GAP : CARD_OVERLAP,
        transform: expanded ? 'scale(1)' : `scale(${1 - depth * CARD_SCALE_STEP})`,
        opacity: expanded ? 1 : isFront ? 1 : Math.max(0.35, 1 - depth * CARD_OPACITY_STEP),
        transformOrigin: 'top center',
        transition: swiping ? 'none' : [
          `margin-top 200ms ease-out ${staggerDelay}`,
          `transform 200ms ease-out ${staggerDelay}`,
          `opacity 200ms ease-out ${staggerDelay}`,
        ].join(', '),
        willChange: 'transform, opacity, margin-top',
      }}
      // ── Pointer capture swipe handlers ─────────────────
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Liquid glass refraction — front card + expanded only */}
      {(isFront || expanded) && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            backdropFilter: 'blur(1px)',
            WebkitBackdropFilter: 'blur(1px)',
            filter: `url(#${LIQUID_GLASS_FILTER_ID})`,
            mixBlendMode: 'soft-light',
            opacity: 0.5,
          }}
        />
      )}

      {/* Content */}
      <Icon
        size={15}
        strokeWidth={1.5}
        className={cn('shrink-0 relative', isCancelled ? 'text-neutral-500' : tone.icon)}
      />
      <span className={cn(
        'flex-1 min-w-0 relative',
        expanded ? 'whitespace-pre-wrap break-words' : 'truncate',
      )}>
        {displayText}
      </span>

      {/* Actions: front card always, all cards when expanded */}
      {(expanded || isFront) && (
        <div className="flex items-center gap-1 shrink-0 relative">
          {canExpand && !isCancelled && (
            <BannerAction onClick={() => onExpand(item)} title="View full error payload">
              <Maximize2 size={13} strokeWidth={1.5} />
            </BannerAction>
          )}
          {!isCancelled && item.source === 'harness' && (showRecoveryActions || item.code === 'session-missing') && (
            <BannerAction onClick={onReconnect} title="Reconnect">
              Reconnect
            </BannerAction>
          )}
          <BannerAction onClick={() => onDismiss(item.id)} title="Dismiss">
            <X size={13} strokeWidth={1.5} />
          </BannerAction>
        </div>
      )}

      {/* Collapsed: count badge */}
      {!expanded && isFront && totalCount > 1 && (
        <span
          className="relative shrink-0 inline-flex items-center justify-center rounded-full bg-neutral-800/70 text-neutral-200 tabular-nums"
          style={{
            fontSize: 'var(--tmnl-text-xs, 12px)',
            minWidth: 22, height: 22, padding: '0 6px',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {totalCount}
        </span>
      )}
    </motion.div>
  )
})

ToastCard.displayName = 'ToastCard'

// ─── Banner Action Button ────────────────────────────────────────────────────

function BannerAction({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded border',
        'border-white/12 hover:border-white/25',
        'text-neutral-200 hover:text-white',
        'transition-colors duration-150 active:scale-[0.97]',
        'font-mono',
        'backdrop-blur-sm',
      )}
      style={{
        fontSize: 'var(--tmnl-text-sm, 14px)',
        background: 'rgba(255,255,255,0.06)',
      }}
    >
      {children}
    </button>
  )
}
