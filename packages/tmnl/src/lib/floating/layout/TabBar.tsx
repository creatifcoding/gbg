/**
 * TabBar — draggable tab strip for multi-tab panels
 *
 * SM §3.7: Terminal and chat panels use a combined header+tab bar.
 * Tabs can be dragged between panels (future: HTML5 drag).
 *
 * For now, renders a static tab bar with close buttons.
 * Tab state is managed by the parent panel via the tabs stx field.
 *
 * @module
 */

import { memo, useCallback, type ReactNode, type RefObject } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
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
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onTabReorder,
  onNewTab,
  addButtonRef,
  rightSlot,
}: TabBarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !onTabReorder) return

    const oldIndex = tabs.findIndex(t => t.id === active.id)
    const newIndex = tabs.findIndex(t => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(tabs.map(t => t.id), oldIndex, newIndex)
    onTabReorder(reordered)
  }, [tabs, onTabReorder])

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
      {/* Tabs — sortable */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tabs.map(t => t.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              flex: 1,
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            {tabs.map((tab) => (
              <SortableTabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onClick={onTabClick}
                onClose={onTabClose}
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
        </SortableContext>
      </DndContext>

      {/* Right slot (for float button, etc.) */}
      {rightSlot && (
        <div style={{ display: 'flex', alignItems: 'center', paddingRight: 4, flexShrink: 0 }}>
          {rightSlot}
        </div>
      )}
    </div>
  )
})


