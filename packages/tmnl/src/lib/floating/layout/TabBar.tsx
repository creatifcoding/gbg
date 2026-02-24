/**
 * TabBar v2 — draggable tab strip for multi-tab panels
 *
 * Architecture change from v1:
 *   - NO nested DndContext — SortableContext only, participates in root DndContext
 *   - Sortable IDs namespaced as `tab:{hostPanelId}:{tabId}` to avoid collisions
 *   - Data payload on each sortable item enables type-based drag discrimination
 *   - Tab reorder, cross-panel transfer, and tear-off all flow through the root provider
 *
 * SM §3.7: Terminal and chat panels use a combined header+tab bar.
 *
 * @module
 */

import { memo, useCallback, type ReactNode, type RefObject } from 'react'
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { LayoutGroup } from 'motion/react'
import { PANEL } from '../tokens'
import { SortableTabItem } from './SortableTabItem'

// =============================================================================
// Types
// =============================================================================

export interface Tab {
  /** Unique tab ID */
  id: string
  /** Display label */
  label: string
  /** Whether this tab is active */
  active?: boolean
  /** Whether tab can be closed */
  closable?: boolean
}

export interface TabBarProps {
  /** Host panel ID — used for sortable ID namespacing and layoutId scoping */
  hostPanelId: string
  /** Tabs to render */
  tabs: Tab[]
  /** Active tab ID */
  activeTabId?: string
  /** Tab click handler */
  onTabClick?: (tabId: string) => void
  /** Tab close handler */
  onTabClose?: (tabId: string) => void
  /** Tab reorder handler — receives new ordered array of tab IDs */
  onTabReorder?: (tabIds: string[]) => void
  /** Tab rename handler — receives tabId and new title */
  onTabRename?: (tabId: string, newTitle: string) => void
  /** Tab context menu handler */
  onTabContextMenu?: (tabId: string, event: React.MouseEvent) => void
  /** New tab handler (renders + button) */
  onNewTab?: () => void
  /** Ref forwarded to the "+" button */
  addButtonRef?: RefObject<HTMLButtonElement | null>
  /** Additional right-side content */
  rightSlot?: ReactNode
}

// =============================================================================
// Component
// =============================================================================

export const TabBar = memo(function TabBar({
  hostPanelId,
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onTabReorder,
  onTabRename,
  onTabContextMenu,
  onNewTab,
  addButtonRef,
  rightSlot,
}: TabBarProps) {
  // Namespace sortable IDs to avoid collision with panel draggable IDs
  const sortableIds = tabs.map(t => `tab:${hostPanelId}:${t.id}`)

  return (
    <div
      data-slot="tab-bar"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: PANEL.headerHeight,
        backgroundColor: PANEL.headerBg,
        borderBottom: `1px solid ${PANEL.border}`,
        flexShrink: 0,
        overflow: 'hidden',
        gap: 0,
      }}
    >
      {/* Tabs — sortable within root DndContext (no nested DndContext!) */}
      <SortableContext
        items={sortableIds}
        strategy={horizontalListSortingStrategy}
      >
        <LayoutGroup id={`tab-bar-${hostPanelId}`}>
          <div
            data-slot="tab-strip"
            style={{
              display: 'flex',
              alignItems: 'stretch',
              flex: 1,
              overflow: 'hidden',
              minWidth: 0,
              position: 'relative',
            }}
          >
            {tabs.map((tab) => (
              <SortableTabItem
                key={tab.id}
                tab={tab}
                hostPanelId={hostPanelId}
                isActive={tab.id === activeTabId}
                onClick={onTabClick}
                onClose={onTabClose}
                onRename={onTabRename}
                onContextMenu={onTabContextMenu}
              />
            ))}

            {/* New tab button */}
            {onNewTab && (
              <button
                ref={addButtonRef}
                type="button"
                title="New tab"
                onClick={onNewTab}
                data-slot="tab-add-button"
                style={{
                  width: 28,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderLeft: `1px solid transparent`,
                  background: 'transparent',
                  color: PANEL.btnIdle,
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontSize: 'var(--tmnl-text-sm, 14px)',
                  transition: 'color 150ms ease-out, background 150ms ease-out, transform 150ms ease-out, border-color 150ms ease-out',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = PANEL.accentCyan
                  e.currentTarget.style.background = `${PANEL.accentCyan}0a`
                  e.currentTarget.style.borderLeftColor = PANEL.border
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = PANEL.btnIdle
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderLeftColor = 'transparent'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                onMouseDown={e => {
                  e.currentTarget.style.transform = 'scale(0.9)'
                }}
                onMouseUp={e => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="6" y1="2" x2="6" y2="10" />
                  <line x1="2" y1="6" x2="10" y2="6" />
                </svg>
              </button>
            )}
          </div>
        </LayoutGroup>
      </SortableContext>

      {/* Right slot (for float button, etc.) */}
      {rightSlot && (
        <div style={{ display: 'flex', alignItems: 'center', paddingRight: 4, flexShrink: 0 }}>
          {rightSlot}
        </div>
      )}
    </div>
  )
})
