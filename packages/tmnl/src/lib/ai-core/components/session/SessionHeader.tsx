/**
 * SessionHeader Component
 *
 * Compact header bar showing active session with sidebar toggle and new session button.
 * Designed for collapsed sidebar state (Variant C from plan).
 *
 * @example
 * ```tsx
 * <SessionHeader />
 *
 * // With custom actions
 * <SessionHeader
 *   onRename={(title) => console.log('Renamed to:', title)}
 *   showNewButton
 * />
 * ```
 */

import {
  type CSSProperties,
  type ComponentPropsWithoutRef,
  useCallback,
  useState,
  useRef,
  useEffect,
} from 'react'
import { useSessionContext } from './SessionProvider'
import { RVN_DARK, darkLabelStyle, darkButtonStyle } from '../rvn/rvn-tokens'

// =============================================================================
// Types
// =============================================================================

export interface SessionHeaderProps extends Omit<ComponentPropsWithoutRef<'header'>, 'children'> {
  /** Show the "New" button */
  showNewButton?: boolean
  /** Show rename on click */
  allowRename?: boolean
  /** Custom rename handler */
  onRename?: (title: string) => void
}

// =============================================================================
// Styles
// =============================================================================

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  background: RVN_DARK.bgHeader,
  borderBottom: `1px solid ${RVN_DARK.border}`,
  minHeight: '40px',
}

const toggleButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  background: 'transparent',
  border: `1px solid ${RVN_DARK.borderLight}`,
  borderRadius: '4px',
  cursor: 'pointer',
  color: RVN_DARK.textMuted,
  fontSize: '12px',
  transition: 'all 0.15s',
  flexShrink: 0,
}

const sessionInfoStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
}

const indicatorStyle: CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: RVN_DARK.success,
  flexShrink: 0,
}

const titleContainerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  minWidth: 0,
  flex: 1,
}

const titleStyle: CSSProperties = {
  ...darkLabelStyle,
  fontSize: '12px',
  fontWeight: 500,
  textTransform: 'none',
  letterSpacing: 'normal',
  color: RVN_DARK.text,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
}

const titleInputStyle: CSSProperties = {
  ...titleStyle,
  background: RVN_DARK.bgSecondary,
  border: `1px solid ${RVN_DARK.border}`,
  borderRadius: '4px',
  padding: '2px 6px',
  outline: 'none',
  width: '100%',
  maxWidth: '200px',
}

const noSessionStyle: CSSProperties = {
  ...darkLabelStyle,
  fontSize: '12px',
  color: RVN_DARK.textMuted,
}

const newButtonStyle: CSSProperties = {
  ...darkButtonStyle,
  padding: '4px 10px',
  fontSize: '11px',
  flexShrink: 0,
}

// =============================================================================
// Component
// =============================================================================

/**
 * Session header with toggle and active session indicator
 *
 * Features:
 * - Sidebar toggle button
 * - Active session indicator dot
 * - Editable session title (click to rename)
 * - New session button
 */
export function SessionHeader({
  showNewButton = true,
  allowRename = true,
  onRename,
  style,
  ...props
}: SessionHeaderProps) {
  const { session, sessions } = useSessionContext()
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleToggle = useCallback(() => {
    sessions.toggleSidebar()
  }, [sessions])

  const handleCreate = useCallback(() => {
    sessions.createNew()
  }, [sessions])

  const handleTitleClick = useCallback(() => {
    if (allowRename && session.session) {
      setEditTitle(session.session.title)
      setIsEditing(true)
    }
  }, [allowRename, session.session])

  const handleTitleSubmit = useCallback(() => {
    if (editTitle.trim() && editTitle !== session.session?.title) {
      if (onRename) {
        onRename(editTitle.trim())
      } else {
        session.rename(editTitle.trim())
      }
    }
    setIsEditing(false)
  }, [editTitle, session, onRename])

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleTitleSubmit()
      } else if (e.key === 'Escape') {
        setIsEditing(false)
      }
    },
    [handleTitleSubmit]
  )

  const chevron = sessions.sidebarExpanded ? '◀' : '▶'

  return (
    <header
      style={{ ...headerStyle, ...style }}
      data-slot="session-header"
      {...props}
    >
      {/* Toggle Button */}
      <button
        style={toggleButtonStyle}
        onClick={handleToggle}
        aria-label={sessions.sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-expanded={sessions.sidebarExpanded}
        title={sessions.sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {chevron}
      </button>

      {/* Session Info */}
      <div style={sessionInfoStyle}>
        {session.session ? (
          <>
            <span style={indicatorStyle} aria-label="Active session" />
            <div style={titleContainerStyle}>
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={handleTitleKeyDown}
                  style={titleInputStyle}
                  aria-label="Session title"
                />
              ) : (
                <span
                  style={titleStyle}
                  onClick={handleTitleClick}
                  role={allowRename ? 'button' : undefined}
                  tabIndex={allowRename ? 0 : undefined}
                  onKeyDown={
                    allowRename
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleTitleClick()
                          }
                        }
                      : undefined
                  }
                  title={allowRename ? 'Click to rename' : session.session.title}
                >
                  {session.session.title}
                </span>
              )}
            </div>
          </>
        ) : (
          <span style={noSessionStyle}>No session selected</span>
        )}
      </div>

      {/* New Button */}
      {showNewButton && (
        <button
          style={newButtonStyle}
          onClick={handleCreate}
          aria-label="Create new session"
        >
          + New
        </button>
      )}
    </header>
  )
}

SessionHeader.displayName = 'SessionHeader'
