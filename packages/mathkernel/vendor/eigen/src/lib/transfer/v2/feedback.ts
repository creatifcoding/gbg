/**
 * Transfer v2 — Feedback Animations
 *
 * Scoped anime.js v4 animations for transfer events.
 * Each surface gets a createScope bound to its root ref.
 * Layout animations for enter/exit of dropped tokens.
 * Registered methods callable from atom subscriptions.
 *
 * See: src/lib/transfer/docs/redesign/04-transfer-trait-wiring.md
 *
 * @since v2
 */
import { useEffect, useRef, type RefObject } from 'react'
import { createScope, animate, createLayout, stagger } from 'animejs'
import type { TransferFeedbackEvent } from './schemas'

// ── Types ────────────────────────────────────────────────────

export interface TransferFeedbackScope {
  /** Flash accept: pulse green outline + opacity pop */
  flashAccept: (count: number) => void
  /** Shake reject: horizontal oscillation on target */
  shakeReject: (reason?: string) => void
  /** Copy badge: fade-up badge with count */
  showCopyBadge: (count: number) => void
  /** Dispatch from a feedback event */
  dispatch: (event: TransferFeedbackEvent) => void
  /** Cleanup everything */
  revert: () => void
}

// ── Hook: useTransferFeedbackScope ───────────────────────────

/**
 * Creates an anime.js scope bound to a root ref.
 * Returns registered methods for accept/reject/copy feedback.
 *
 * Usage:
 * ```tsx
 * const rootRef = useRef<HTMLDivElement>(null)
 * const feedback = useTransferFeedbackScope(rootRef)
 *
 * // On transfer accept:
 * feedback.current?.dispatch({ _tag: 'Accepted', tokenCount: 3, targetId: 'composer' })
 * ```
 */
export function useTransferFeedbackScope(
  rootRef: RefObject<HTMLElement | null>,
): RefObject<TransferFeedbackScope | null> {
  const feedbackRef = useRef<TransferFeedbackScope | null>(null)
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)

  useEffect(() => {
    if (!rootRef.current) return

    const scope = createScope({ root: rootRef.current })
      .add((self) => {
        // ── Accept Flash ───────────────────────────────
        self.add('flashAccept', (count: number) => {
          animate('[data-transfer-target]', {
            outline: [
              '2px solid rgba(0, 229, 255, 0.8)',
              '2px solid rgba(0, 229, 255, 0)',
            ],
            duration: 400,
            ease: 'out(3)',
          })
        })

        // ── Reject Shake ───────────────────────────────
        self.add('shakeReject', (_reason?: string) => {
          animate('[data-transfer-target]', {
            translateX: [
              { to: -6, duration: 50 },
              { to: 6, duration: 50 },
              { to: -4, duration: 50 },
              { to: 4, duration: 50 },
              { to: 0, duration: 80 },
            ],
            ease: 'out(2)',
          })
        })

        // ── Copy Badge ─────────────────────────────────
        self.add('showCopyBadge', (count: number) => {
          // Find or create the badge element inside the scope root
          const root = rootRef.current
          if (!root) return

          let badge = root.querySelector('.transfer-copy-badge') as HTMLElement | null
          if (!badge) {
            badge = document.createElement('div')
            badge.className = 'transfer-copy-badge'
            root.appendChild(badge)
          }

          badge.textContent = `Copied ${count} task${count > 1 ? 's' : ''}`
          badge.style.display = 'block'

          animate(badge, {
            opacity: [1, 0],
            translateY: [0, -24],
            duration: 1000,
            ease: 'out(3)',
            onComplete: () => {
              if (badge) badge.style.display = 'none'
            },
          })
        })
      })

    scopeRef.current = scope

    feedbackRef.current = {
      flashAccept: (count) => scope.methods.flashAccept(count),
      shakeReject: (reason) => scope.methods.shakeReject(reason),
      showCopyBadge: (count) => scope.methods.showCopyBadge(count),

      dispatch: (event) => {
        switch (event._tag) {
          case 'Accepted':
            scope.methods.flashAccept(event.tokenCount)
            break
          case 'Rejected':
            scope.methods.shakeReject(event.reason)
            break
          case 'Copied':
            scope.methods.showCopyBadge(event.tokenCount)
            break
        }
      },

      revert: () => scope.revert(),
    }

    return () => {
      scope.revert()
      feedbackRef.current = null
      scopeRef.current = null
    }
  }, [rootRef])

  return feedbackRef
}

// ── Hook: useTransferLayout ──────────────────────────────────

/**
 * Auto-layout for token enter/exit in a drop zone (e.g. composer).
 * Wraps createLayout with transfer-specific enter/exit states.
 *
 * Usage:
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null)
 * const layout = useTransferLayout(containerRef, '.transfer-chip')
 *
 * // When tokens change:
 * layout.current?.update(() => {
 *   // DOM mutations here — add/remove chip elements
 * })
 * ```
 */
export function useTransferLayout(
  containerRef: RefObject<HTMLElement | null>,
  childrenSelector = '.transfer-chip',
) {
  const layoutRef = useRef<ReturnType<typeof createLayout> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const layout = createLayout(containerRef.current, {
      children: childrenSelector,
      duration: 250,
      ease: 'out(3)',
      delay: stagger(30),
      enterFrom: {
        opacity: 0,
        transform: 'scale(0.8) translateY(8px)',
        duration: 200,
        ease: 'out(3)',
      },
      leaveTo: {
        opacity: 0,
        transform: 'scale(0.6) translateY(-12px)',
        duration: 180,
        ease: 'in(2)',
      },
    })

    layoutRef.current = layout

    return () => {
      layout.revert()
      layoutRef.current = null
    }
  }, [containerRef, childrenSelector])

  return layoutRef
}
