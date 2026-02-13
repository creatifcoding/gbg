/**
 * Transfer v2 — Feedback Animations
 *
 * Ephemeral visual feedback for transfer events using the animation library.
 * Accept flash, reject shake, copy badge.
 *
 * See: src/lib/transfer/docs/redesign/04-transfer-trait-wiring.md §Feedback Animations
 *
 * @since v2
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import type { TransferFeedbackEvent } from './schemas'

// ── Accept Flash ─────────────────────────────────────────────

/**
 * Ephemeral opacity flash on transfer accept.
 * Returns opacity value (0–1) that pulses then fades.
 */
export function useAcceptFlash(lastEvent: TransferFeedbackEvent | null) {
  const [flashOpacity, setFlashOpacity] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (lastEvent?._tag !== 'Accepted') return

    setFlashOpacity(1)
    timerRef.current = setTimeout(() => setFlashOpacity(0), 400)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [lastEvent])

  return flashOpacity
}

// ── Reject Shake ─────────────────────────────────────────────

/**
 * Ephemeral horizontal shake on transfer reject.
 * Returns translateX offset that settles to 0.
 */
export function useRejectShake(lastEvent: TransferFeedbackEvent | null) {
  const [shakeX, setShakeX] = useState(0)
  const frameRef = useRef<number>()

  useEffect(() => {
    if (lastEvent?._tag !== 'Rejected') return

    let start: number | null = null
    const duration = 300
    const amplitude = 6

    const animate = (ts: number) => {
      if (start === null) start = ts
      const elapsed = ts - start
      const progress = Math.min(elapsed / duration, 1)
      // Damped oscillation
      const decay = 1 - progress
      const oscillation = Math.sin(progress * Math.PI * 4) * decay * amplitude
      setShakeX(oscillation)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        setShakeX(0)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [lastEvent])

  return shakeX
}

// ── Copy Badge ───────────────────────────────────────────────

/**
 * Ephemeral "Copied N tasks" badge.
 * Returns { visible, tokenCount } that auto-clears after duration.
 */
export function useCopyBadge(lastEvent: TransferFeedbackEvent | null, durationMs = 1200) {
  const [badge, setBadge] = useState<{ visible: boolean; tokenCount: number }>({
    visible: false,
    tokenCount: 0,
  })
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (lastEvent?._tag !== 'Copied') return

    setBadge({ visible: true, tokenCount: lastEvent.tokenCount })
    timerRef.current = setTimeout(() => {
      setBadge((prev) => ({ ...prev, visible: false }))
    }, durationMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [lastEvent, durationMs])

  return badge
}

// ── Combined Feedback Hook ───────────────────────────────────

/**
 * All three feedback hooks combined.
 * Returns state values for CSS/style application.
 */
export function useTransferFeedback(lastEvent: TransferFeedbackEvent | null) {
  const flashOpacity = useAcceptFlash(lastEvent)
  const shakeX = useRejectShake(lastEvent)
  const copyBadge = useCopyBadge(lastEvent)

  return { flashOpacity, shakeX, copyBadge }
}
