/**
 * ScrollStrip primitives.
 *
 * @module floating/layout/scroll-strip/components/primitives
 */

import { memo, forwardRef } from 'react'
import { PANEL } from '../../../tokens'
import type { ColumnWidth } from '../../../types/strip'

/** Custom scroller — scrollbar-hidden, TMNL-themed, ref-forwarded */
export const StripScroller = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function StripScroller({ style, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      {...props}
      style={{
        ...style,
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
        background: PANEL.bg,
      }}
      data-scroll-strip-scroller
    >
      {children}
    </div>
  )
})

/** List wrapper — ref-forwarded, flex row for full-height children */
export const StripList = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function StripList({ style, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      {...props}
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
      }}
      data-scroll-strip-list
    >
      {children}
    </div>
  )
})

/** Bottom status bar with focused width + hint legend. */
export const StripStatus = memo(function StripStatus({
  columnCount,
  focusedIndex,
  focusedWidth,
}: {
  columnCount: number
  focusedIndex: number
  focusedWidth: ColumnWidth | null
}) {
  return (
    <div
      data-strip-status
      style={{
        height: 24,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingInline: 12,
        background: PANEL.headerBg,
        borderTop: `1px solid ${PANEL.border}`,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        color: PANEL.textMuted,
      }}
    >
      <span>
        <span style={{ color: PANEL.textStrong }}>{columnCount}</span> columns
      </span>
      <span style={{ color: PANEL.border, fontSize: 10 }}>│</span>
      <span>
        focus:{' '}
        <span style={{ color: PANEL.accentCyan }}>
          {focusedIndex >= 0 ? focusedIndex + 1 : '—'}
        </span>
      </span>
      {focusedWidth && (
        <>
          <span style={{ color: PANEL.border, fontSize: 10 }}>│</span>
          <span>
            width: <span style={{ color: PANEL.textStrong }}>{focusedWidth}</span>
          </span>
        </>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: PANEL.textMuted, opacity: 0.6 }}>
          Alt+H/L focus · Alt+Shift+H/L swap · Alt+D width · Alt+W collapse · Alt+Enter spawn
        </span>
      </div>
    </div>
  )
})
