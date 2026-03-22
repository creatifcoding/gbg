/**
 * SessionSidebar Component
 *
 * Collapsible sidebar showing session list with search, create, and import/export.
 * Uses RVN dark theme tokens for consistent styling.
 *
 * @example
 * ```tsx
 * <SessionSidebar />
 *
 * // Or with custom width
 * <SessionSidebar width={280} />
 * ```
 */

import { type CSSProperties, type ComponentPropsWithoutRef, useCallback, useRef, useState } from 'react'
import { useSessionContext } from './SessionProvider'
import { RVN_DARK, darkLabelStyle, darkButtonStyle } from '../rvn/rvn-tokens'
import type { SessionMetadata } from '../../schemas/session'

// =============================================================================
// Types
// =============================================================================

export interface SessionSidebarProps extends Omit<ComponentPropsWithoutRef<'aside'>, 'children'> {
  /** Sidebar width when expanded */
  width?: number
  /** Show import/export buttons */
  showImportExport?: boolean
}

// =============================================================================
// Styles
// =============================================================================

const sidebarStyle = (expanded: boolean, width: number): CSSProperties => ({
  width: expanded ? width : 0,
  minWidth: expanded ? width : 0,
  height: '100%',
  background: RVN_DARK.bg,
  borderRight: expanded ? `1px solid ${RVN_DARK.border}` : 'none',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'width 0.2s ease, min-width 0.2s ease',
})

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px',
  borderBottom: `1px solid ${RVN_DARK.borderLight}`,
  background: RVN_DARK.bgHeader,
}

const titleStyle: CSSProperties = {
  ...darkLabelStyle,
  margin: 0,
}

const newButtonStyle: CSSProperties = {
  ...darkButtonStyle,
  padding: '4px 8px',
  fontSize: '12px',
}

const searchContainerStyle: CSSProperties = {
  padding: '8px 12px',
  borderBottom: `1px solid ${RVN_DARK.borderSubtle}`,
}

const searchInputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: RVN_DARK.bgSecondary,
  border: `1px solid ${RVN_DARK.borderLight}`,
  borderRadius: '4px',
  color: RVN_DARK.text,
  fontSize: '12px',
  fontFamily: 'inherit',
  outline: 'none',
}

const listStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '4px 0',
}

const sessionItemStyle = (isActive: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  cursor: 'pointer',
  background: isActive ? RVN_DARK.bgHeader : 'transparent',
  borderLeft: isActive ? `2px solid ${RVN_DARK.success}` : '2px solid transparent',
  transition: 'background 0.15s, border-color 0.15s',
})

const sessionIndicatorStyle = (isActive: boolean): CSSProperties => ({
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: isActive ? RVN_DARK.success : RVN_DARK.borderLight,
  flexShrink: 0,
})

const sessionTitleStyle: CSSProperties = {
  flex: 1,
  fontSize: '12px',
  color: RVN_DARK.text,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const sessionDateStyle: CSSProperties = {
  fontSize: '10px',
  color: RVN_DARK.textSubtle,
  flexShrink: 0,
}

const footerStyle: CSSProperties = {
  padding: '8px 12px',
  borderTop: `1px solid ${RVN_DARK.borderLight}`,
  display: 'flex',
  gap: '8px',
}

const footerButtonStyle: CSSProperties = {
  ...darkButtonStyle,
  flex: 1,
  fontSize: '10px',
  padding: '4px',
}

const emptyStateStyle: CSSProperties = {
  padding: '24px 12px',
  textAlign: 'center',
  color: RVN_DARK.textMuted,
  fontSize: '12px',
}

// =============================================================================
// Helpers
// =============================================================================

const formatDate = (date: Date): string => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return 'Yesterday'
  } else if (days < 7) {
    return `${days}d ago`
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

interface SessionItemProps {
  session: SessionMetadata
  isActive: boolean
  onSelect: (id: string) => void
}

function SessionItem({ session, isActive, onSelect }: SessionItemProps) {
  return (
    <div
      style={sessionItemStyle(isActive)}
      onClick={() => onSelect(session.id)}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = RVN_DARK.bgHeader
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(session.id)
        }
      }}
      aria-selected={isActive}
    >
      <span style={sessionIndicatorStyle(isActive)} aria-hidden="true" />
      <span style={sessionTitleStyle}>{session.title}</span>
      <span style={sessionDateStyle}>{formatDate(session.updatedAt)}</span>
    </div>
  )
}

// =============================================================================
// Component
// =============================================================================

/**
 * Collapsible sidebar with session list
 *
 * Features:
 * - Session list with active indicator
 * - Search/filter sessions
 * - Create new session button
 * - Import/export buttons
 * - Keyboard navigation
 */
export function SessionSidebar({
  width = 240,
  showImportExport = true,
  style,
  ...props
}: SessionSidebarProps) {
  const { session, sessions } = useSessionContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const handleSelect = useCallback(
    (id: string) => {
      sessions.open(id)
    },
    [sessions]
  )

  const handleCreate = useCallback(() => {
    sessions.createNew()
  }, [sessions])

  const handleExport = useCallback(async () => {
    const json = await session.exportJson()
    if (json) {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `session-${session.session?.id || 'export'}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [session])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        await sessions.importJson(text)
      } catch (err) {
        console.error('Failed to import session:', err)
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [sessions]
  )

  return (
    <aside
      style={{ ...sidebarStyle(sessions.sidebarExpanded, width), ...style }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Sessions sidebar"
      data-state={sessions.sidebarExpanded ? 'open' : 'closed'}
      {...props}
    >
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={titleStyle}>Sessions</h2>
        <button
          style={{
            ...newButtonStyle,
            background: isHovered ? RVN_DARK.bgSecondary : 'transparent',
          }}
          onClick={handleCreate}
          aria-label="Create new session"
        >
          + New
        </button>
      </div>

      {/* Search */}
      <div style={searchContainerStyle}>
        <input
          type="search"
          placeholder="Search sessions..."
          value={sessions.searchQuery}
          onChange={(e) => sessions.setSearchQuery(e.target.value)}
          style={searchInputStyle}
          aria-label="Search sessions"
        />
      </div>

      {/* Session List */}
      <div style={listStyle} role="listbox" aria-label="Session list">
        {sessions.filteredSessions.length === 0 ? (
          <div style={emptyStateStyle}>
            {sessions.searchQuery ? 'No sessions match your search' : 'No sessions yet'}
          </div>
        ) : (
          sessions.filteredSessions.map((s) => (
            <SessionItem
              key={s.id}
              session={s}
              isActive={s.id === sessions.activeSessionId}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>

      {/* Footer with Import/Export */}
      {showImportExport && (
        <div style={footerStyle}>
          <button
            style={footerButtonStyle}
            onClick={handleImportClick}
            aria-label="Import session"
          >
            Import
          </button>
          <button
            style={{
              ...footerButtonStyle,
              opacity: session.session ? 1 : 0.5,
            }}
            onClick={handleExport}
            disabled={!session.session}
            aria-label="Export session"
          >
            Export
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        </div>
      )}
    </aside>
  )
}

SessionSidebar.displayName = 'SessionSidebar'
