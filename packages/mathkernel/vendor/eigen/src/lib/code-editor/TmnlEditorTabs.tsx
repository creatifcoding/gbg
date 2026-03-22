/**
 * TmnlEditorTabs — VANTA-Styled Tab Bar
 *
 * Custom tab bar for the code editor with:
 * - Machined groove dividers (consistent with BarLayout)
 * - Dirty indicator: pulsing amber dot
 * - Active tab: cyan top-border glow
 * - Close button: rose on hover
 * - Pin indicator
 * - Keyboard navigation (Ctrl+Tab to cycle)
 *
 * @module code-editor/TmnlEditorTabs
 */

import React, { useCallback } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { VANTA_COLORS } from '@/components/portal/tokens'
import {
  editorStateAtom,
  activeTabAtom,
  closeTab,
  setActiveTab,
  togglePin,
} from './atoms'
import type { EditorTab, TabId } from './schemas'

// =============================================================================
// Tab Item
// =============================================================================

interface TabItemProps {
  tab: EditorTab
  isActive: boolean
  onSelect: () => void
  onClose: () => void
  onTogglePin: () => void
}

function TabItem({ tab, isActive, onSelect, onClose, onTogglePin }: TabItemProps) {
  return (
    <div
      onClick={onSelect}
      onDoubleClick={onTogglePin}
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0 12px',
        height: '100%',
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none',
        borderRight: `1px solid ${VANTA_COLORS.surface.border}`,
        background: isActive ? VANTA_COLORS.surface.base : 'transparent',
        color: isActive ? VANTA_COLORS.text.primary : VANTA_COLORS.text.muted,
        transition: 'background 150ms ease, color 150ms ease',
        minWidth: 0,
        maxWidth: '200px',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = VANTA_COLORS.surface.elevated
          e.currentTarget.style.color = VANTA_COLORS.text.primary
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = VANTA_COLORS.text.muted
        }
      }}
    >
      {/* Active indicator — cyan top border */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: VANTA_COLORS.accent.cyan,
            boxShadow: `0 0 6px ${VANTA_COLORS.accent.cyanGlow}`,
          }}
        />
      )}

      {/* Pin indicator */}
      {tab.pinned && (
        <span
          style={{
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: VANTA_COLORS.text.tertiary,
            flexShrink: 0,
          }}
          title="Pinned"
        >
          📌
        </span>
      )}

      {/* Dirty indicator — pulsing amber dot */}
      {tab.dirty && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: VANTA_COLORS.accent.amber,
            boxShadow: `0 0 4px ${VANTA_COLORS.accent.amberGlow}`,
            flexShrink: 0,
            animation: 'tmnl-pulse-amber 2s ease-in-out infinite',
          }}
          title="Unsaved changes"
        />
      )}

      {/* Tab label */}
      <span
        style={{
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1,
          minWidth: 0,
        }}
      >
        {tab.label}
      </span>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          borderRadius: '2px',
          border: 'none',
          background: 'transparent',
          color: VANTA_COLORS.text.muted,
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          fontSize: 'var(--tmnl-text-xs, 12px)',
          lineHeight: 1,
          transition: 'background 100ms, color 100ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = VANTA_COLORS.accent.roseGlow
          e.currentTarget.style.color = VANTA_COLORS.accent.rose
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = VANTA_COLORS.text.muted
        }}
        title={`Close ${tab.label}`}
        aria-label={`Close ${tab.label}`}
      >
        ✕
      </button>
    </div>
  )
}

// =============================================================================
// Tab Bar
// =============================================================================

export interface TmnlEditorTabsProps {
  /** Height of the tab bar */
  height?: number
}

export function TmnlEditorTabs({ height = 32 }: TmnlEditorTabsProps) {
  const stateResult = useAtomValue(editorStateAtom)
  const state =
    stateResult && 'value' in stateResult ? stateResult.value : null

  const activeResult = useAtomValue(activeTabAtom)
  const activeTab =
    activeResult && 'value' in activeResult ? activeResult.value : null

  const handleSelect = useCallback((id: TabId) => {
    setActiveTab(id)
  }, [])

  const handleClose = useCallback((id: TabId) => {
    closeTab(id)
  }, [])

  const handleTogglePin = useCallback((id: TabId) => {
    togglePin(id)
  }, [])

  if (!state || state.tabs.length === 0) {
    return (
      <div
        style={{
          height,
          background: VANTA_COLORS.surface.void,
          borderBottom: `1px solid ${VANTA_COLORS.surface.border}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '12px',
        }}
      >
        <span
          style={{
            fontFamily: '"Share Tech Mono", monospace',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: VANTA_COLORS.text.muted,
          }}
        >
          No open files
        </span>
      </div>
    )
  }

  return (
    <div
      role="tablist"
      style={{
        height,
        background: VANTA_COLORS.surface.void,
        borderBottom: `1px solid ${VANTA_COLORS.surface.border}`,
        display: 'flex',
        alignItems: 'stretch',
        overflow: 'hidden',
      }}
    >
      {state.tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTab?.id}
          onSelect={() => handleSelect(tab.id)}
          onClose={() => handleClose(tab.id)}
          onTogglePin={() => handleTogglePin(tab.id)}
        />
      ))}

      {/* Spacer fills remaining width */}
      <div style={{ flex: 1, borderBottom: 'none' }} />

      {/* Keyframe animation for dirty indicator */}
      <style>{`
        @keyframes tmnl-pulse-amber {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export default TmnlEditorTabs
