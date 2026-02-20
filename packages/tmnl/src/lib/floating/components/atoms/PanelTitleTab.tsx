/**
 * PanelTitleTab — tab container with title + close button
 *
 * Compound component. Renders children (defaults to Title + TabClose).
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

export const PanelTitleTab = memo(function PanelTitleTab({ children }: PanelTitleTabProps) {
  const { meta } = usePanelContext()

  return (
    <div style={{ display: 'flex', alignItems: 'center', maxWidth: '70%', minWidth: 0, paddingLeft: 8, paddingRight: 4 }}>
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
          borderLeft: `1px solid ${meta.borderColor}`,
          borderRight: `1px solid ${meta.borderColor}`,
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
