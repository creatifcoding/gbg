/**
 * DragGuideOverlay
 *
 * Imperative DOM layer for snap guides and dock preview during drag.
 * Renders invisible elements that are painted by the modifier hooks.
 * Absolutely no React re-renders during drag — all mutations are
 * via ref.current.style.
 *
 * @module
 */

import { memo, forwardRef, type RefObject } from 'react'

export interface DragGuideOverlayProps {
  /** Dock preview rectangle ref */
  dockPreviewRef: RefObject<HTMLDivElement | null>
  /** Dock zone label ref */
  dockPreviewLabelRef: RefObject<HTMLDivElement | null>
  /** Vertical snap guide ref */
  guideVRef: RefObject<HTMLDivElement | null>
  /** Horizontal snap guide ref */
  guideHRef: RefObject<HTMLDivElement | null>
}

export const DragGuideOverlay = memo(function DragGuideOverlay({
  dockPreviewRef,
  dockPreviewLabelRef,
  guideVRef,
  guideHRef,
}: DragGuideOverlayProps) {
  return (
    <div
      data-slot="drag-guide-overlay"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2147483600 }}
    >
      {/* Dock preview zone */}
      <div
        ref={dockPreviewRef}
        style={{
          position: 'fixed',
          opacity: 0,
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.45)',
          boxShadow: 'inset 0 0 0 1px rgba(16, 185, 129, 0.15)',
        }}
      />

      {/* Dock zone label */}
      <div
        ref={dockPreviewLabelRef}
        style={{
          position: 'fixed',
          opacity: 0,
          padding: '2px 6px',
          borderRadius: 2,
          border: '1px solid rgba(16, 185, 129, 0.55)',
          background: 'rgba(6, 18, 12, 0.82)',
          color: 'rgba(167, 243, 208, 0.95)',
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      />

      {/* Vertical snap guide */}
      <div
        ref={guideVRef}
        style={{
          position: 'fixed',
          width: 1,
          opacity: 0,
          background: 'rgba(22, 163, 74, 0.85)',
          boxShadow: '0 0 0 1px rgba(22, 163, 74, 0.15)',
        }}
      />

      {/* Horizontal snap guide */}
      <div
        ref={guideHRef}
        style={{
          position: 'fixed',
          height: 1,
          opacity: 0,
          background: 'rgba(22, 163, 74, 0.85)',
          boxShadow: '0 0 0 1px rgba(22, 163, 74, 0.15)',
        }}
      />
    </div>
  )
})
