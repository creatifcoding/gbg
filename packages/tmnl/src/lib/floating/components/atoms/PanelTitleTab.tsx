/**
 * PanelTitleTab — tab container with title + close button
 *
 * MorphChat DNA: font-mono, tracking-wider, uppercase title.
 * Hairline borders with alpha. Subtle tab background.
 *
 * @module
 */

import { memo, type ReactNode } from 'react'
import { usePanelContext } from '../../context/PanelContext'
import { PANEL } from '../../tokens'
import { PanelTitle } from './PanelTitle'
import { PanelTabClose } from './PanelTabClose'

export interface PanelTitleTabProps {
  children?: ReactNode
}

/** 6-dot grip icon — subtle drag affordance */
const GripIcon = memo(function GripIcon() {
  return (
    <svg
      width="8" height="14" viewBox="0 0 8 14"
      fill={PANEL.btnIdle}
      style={{ opacity: 0.4, flexShrink: 0 }}
    >
      <circle cx="2" cy="2" r="1" />
      <circle cx="6" cy="2" r="1" />
      <circle cx="2" cy="7" r="1" />
      <circle cx="6" cy="7" r="1" />
      <circle cx="2" cy="12" r="1" />
      <circle cx="6" cy="12" r="1" />
    </svg>
  )
})

export const PanelTitleTab = memo(function PanelTitleTab({ children }: PanelTitleTabProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', maxWidth: '70%', minWidth: 0, paddingLeft: 6, paddingRight: 4 }}>
      <GripIcon />
      <div
        data-slot="panel-title-tab"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          maxWidth: '100%',
          minWidth: 0,
          height: '100%',
          paddingInline: 10,
          borderLeft: `1px solid ${PANEL.border}`,
          borderRight: `1px solid ${PANEL.border}`,
          backgroundColor: PANEL.tabBg,
        }}
      >
        {children ?? (
          <>
            <PanelTitle />
            <PanelTabClose />
          </>
        )}
      </div>
    </div>
  )
})
