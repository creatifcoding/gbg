/**
 * TabDragGhost — translucent tab clone rendered inside DragOverlay
 *
 * Two states:
 *   1. Reorder mode (default): tab-shaped ghost with cyan border
 *   2. Tear-off mode: ghost morphs to panel silhouette with spring physics
 *
 * @module floating/layout/TabDragGhost
 */

import { memo } from 'react'
import { motion } from 'motion/react'
import { PANEL } from '../tokens'

export interface TabDragGhostProps {
  /** Tab display label */
  label: string
  /** Whether the drag has crossed the tear-off threshold */
  isTearOff: boolean
}

export const TabDragGhost = memo(function TabDragGhost({
  label,
  isTearOff,
}: TabDragGhostProps) {
  return (
    <motion.div
      layout
      animate={{
        width: isTearOff ? 200 : 'auto',
        height: isTearOff ? 120 : PANEL.headerHeight,
        borderRadius: isTearOff ? PANEL.radius : 4,
        opacity: isTearOff ? 0.7 : 0.85,
      }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 28,
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: isTearOff ? PANEL.bg : PANEL.tabBg,
        border: `1px solid ${isTearOff ? PANEL.borderActive : PANEL.accentCyan}`,
        boxShadow: isTearOff ? PANEL.floatGlow : '0 4px 16px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        pointerEvents: 'none',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
      }}
    >
      {/* Tab label header — always visible */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          height: PANEL.headerHeight,
          flexShrink: 0,
          fontSize: 'var(--tmnl-text-xs, 12px)',
          color: PANEL.textStrong,
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          borderBottom: isTearOff ? `1px solid ${PANEL.border}` : 'none',
        }}
      >
        {label}
      </div>

      {/* Panel body silhouette — visible only in tear-off mode */}
      {isTearOff && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05, duration: 0.15 }}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.02)',
          }}
        />
      )}
    </motion.div>
  )
})
