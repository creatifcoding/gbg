import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Archive,
  Clock,
  Download,
  MessageSquare,
  Star,
  Trash2,
} from 'lucide-react'
import {
  VANTA_ANIMATION,
  VANTA_TYPOGRAPHY,
} from '@/components/portal/tokens'

export interface SessionCardSession {
  sessionId: string
  name: string
  autoTitle: string
  previewSnippet: string
  messageCount: number
  modelId: string
  provider: string
  tags: string[]
  status: 'active' | 'archived' | 'starred'
  starred: boolean
  createdAt: number
  updatedAt: number
}

export interface SessionCardProps {
  session: SessionCardSession
  isActive: boolean
  onResume: () => void
  onRename: (name: string) => void
  onStar: () => void
  onArchive: () => void
  onDelete: () => void
  onExport: () => void
}

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'

function formatRelativeTime(timestamp: number): string {
  const deltaMs = timestamp - Date.now()
  const abs = Math.abs(deltaMs)
  if (abs < 45_000) return 'just now'

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day

  if (abs < hour) return rtf.format(Math.round(deltaMs / minute), 'minute')
  if (abs < day) return rtf.format(Math.round(deltaMs / hour), 'hour')
  if (abs < week) return rtf.format(Math.round(deltaMs / day), 'day')
  return rtf.format(Math.round(deltaMs / week), 'week')
}

export function SessionCard({
  session,
  isActive,
  onResume,
  onRename,
  onStar,
  onArchive,
  onDelete,
  onExport,
}: SessionCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(session.name || session.autoTitle)
  const renameRef = useRef<HTMLDivElement>(null)

  const title = session.name.trim() || session.autoTitle.trim() || 'Untitled session'

  useEffect(() => {
    if (!isRenaming) {
      setDraftName(title)
    }
  }, [title, isRenaming])

  useEffect(() => {
    if (!isRenaming || !renameRef.current) return
    renameRef.current.focus()
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(renameRef.current)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [isRenaming])

  const relativeTime = useMemo(() => formatRelativeTime(session.updatedAt), [session.updatedAt])

  const commitRename = () => {
    const nextName = draftName.trim()
    setIsRenaming(false)
    if (!nextName || nextName === title) return
    onRename(nextName)
  }

  const cancelRename = () => {
    setDraftName(title)
    setIsRenaming(false)
  }

  return (
    <motion.div
      layout
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.16 }}
      onClick={onResume}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onResume()
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        borderRadius: 8,
        background: 'oklch(0.07 0 0)',
        border: `1px solid ${isHovered ? 'oklch(0.18 0 0)' : 'oklch(0.12 0 0)'}`,
        borderLeft: isActive ? '3px solid oklch(0.7 0.15 195)' : `1px solid ${isHovered ? 'oklch(0.18 0 0)' : 'oklch(0.12 0 0)'}`,
        boxShadow: isHovered ? '0 8px 24px rgba(0, 0, 0, 0.35)' : '0 2px 10px rgba(0, 0, 0, 0.2)',
        cursor: 'pointer',
        transition: [
          VANTA_ANIMATION.transition.colors,
          VANTA_ANIMATION.transition.shadow,
          VANTA_ANIMATION.transition.transform,
        ].join(', '),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 84 }}>
          {isRenaming ? (
            <div
              ref={renameRef}
              contentEditable
              suppressContentEditableWarning
              onClick={(event) => event.stopPropagation()}
              onInput={(event) => {
                setDraftName((event.target as HTMLDivElement).textContent ?? '')
              }}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitRename()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  cancelRename()
                }
              }}
              style={{
                fontFamily: MONO,
                fontSize: 'var(--tmnl-text-sm, 14px)',
                color: 'oklch(0.9 0 0)',
                lineHeight: 1.35,
                outline: 'none',
                borderRadius: 4,
                border: '1px solid oklch(0.2 0 0)',
                background: 'oklch(0.08 0 0)',
                padding: '2px 6px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {draftName}
            </div>
          ) : (
            <div
              onDoubleClick={(event) => {
                event.stopPropagation()
                setIsRenaming(true)
              }}
              title="Double-click to rename"
              style={{
                fontFamily: MONO,
                fontSize: 'var(--tmnl-text-sm, 14px)',
                color: 'oklch(0.9 0 0)',
                lineHeight: 1.35,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button
            type="button"
            aria-label={session.starred ? 'Unstar session' : 'Star session'}
            onClick={(event) => {
              event.stopPropagation()
              onStar()
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: session.starred ? 'oklch(0.83 0.16 90)' : 'oklch(0.45 0 0)',
              padding: 0,
              display: 'flex',
              cursor: 'pointer',
            }}
          >
            <Star
              size={14}
              fill={session.starred ? 'oklch(0.83 0.16 90)' : 'transparent'}
            />
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: 'oklch(0.52 0 0)',
              fontFamily: VANTA_TYPOGRAPHY.family.sans,
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          >
            <Clock size={12} />
            <span>{relativeTime}</span>
          </div>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontFamily: VANTA_TYPOGRAPHY.family.sans,
          fontSize: 'var(--tmnl-text-xs, 12px)',
          color: 'oklch(0.62 0 0)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}
      >
        {session.previewSnippet.trim() || 'No preview available yet.'}
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          paddingRight: 82,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            borderRadius: 999,
            border: '1px solid oklch(0.14 0 0)',
            background: 'oklch(0.09 0 0)',
            color: 'oklch(0.66 0 0)',
            padding: '2px 8px',
            fontFamily: MONO,
            fontSize: 'var(--tmnl-text-xs, 12px)',
          }}
        >
          <MessageSquare size={12} />
          {session.messageCount}
        </span>

        <span
          style={{
            borderRadius: 999,
            border: '1px solid oklch(0.14 0 0)',
            background: 'oklch(0.09 0 0)',
            color: 'oklch(0.73 0.03 210)',
            padding: '2px 8px',
            fontFamily: MONO,
            fontSize: 'var(--tmnl-text-xs, 12px)',
          }}
        >
          {session.provider}:{session.modelId}
        </span>

        {session.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            style={{
              borderRadius: 999,
              border: '1px solid oklch(0.14 0 0)',
              background: 'oklch(0.08 0 0)',
              color: 'oklch(0.56 0 0)',
              padding: '2px 8px',
              fontFamily: VANTA_TYPOGRAPHY.family.sans,
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <AnimatePresence>
        {isHovered && !isRenaming && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute',
              right: 10,
              bottom: 10,
              display: 'flex',
              gap: 4,
            }}
          >
            <ActionIconButton
              icon={<Archive size={13} />}
              label={session.status === 'archived' ? 'Unarchive session' : 'Archive session'}
              onClick={onArchive}
            />
            <ActionIconButton
              icon={<Trash2 size={13} />}
              label="Delete session"
              onClick={onDelete}
              danger
            />
            <ActionIconButton
              icon={<Download size={13} />}
              label="Export session"
              onClick={onExport}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

interface ActionIconButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}

function ActionIconButton({ icon, label, onClick, danger = false }: ActionIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      style={{
        border: '1px solid oklch(0.16 0 0)',
        background: 'oklch(0.09 0 0)',
        color: danger ? 'oklch(0.72 0.18 25)' : 'oklch(0.58 0 0)',
        borderRadius: 6,
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: VANTA_ANIMATION.transition.colors,
      }}
    >
      {icon}
    </button>
  )
}

SessionCard.displayName = 'MorphChat.SessionCard'
