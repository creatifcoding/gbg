import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  Clock,
  Download,
  GitFork,
  MessageSquare,
  Star,
  Tags,
  Trash2,
} from 'lucide-react'
import {
  VANTA_ANIMATION,
  VANTA_TYPOGRAPHY,
} from '@/components/portal/tokens'
import type { DrawerSessionListItem, SessionSourceKind } from '@/lib/morphchat/atoms/session-manager'

export type SessionCardSession = DrawerSessionListItem

export interface SessionCardProps {
  session: SessionCardSession
  isActive: boolean
  onResume: () => void
  onRename: (name: string) => void
  onStar: () => void
  onArchive: () => void
  onDelete: () => void
  onExport: () => void
  onFork: () => void
  onEnrich: (patch: { readonly description?: string; readonly tags?: ReadonlyArray<string> }) => void
}

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'

const SOURCE_LABEL: Record<SessionSourceKind, string> = {
  harness: 'harness',
  'pi-cli': 'pi-cli',
  local: 'local',
}

const SOURCE_COLOR: Record<SessionSourceKind, string> = {
  harness: 'oklch(0.68 0.12 195)',
  'pi-cli': 'oklch(0.76 0.14 150)',
  local: 'oklch(0.72 0.11 285)',
}

function isFiniteTimestamp(timestamp: unknown): timestamp is number {
  return typeof timestamp === 'number' && Number.isFinite(timestamp)
}

function formatRelativeTime(timestamp: number): string {
  if (!isFiniteTimestamp(timestamp)) return 'unknown'

  const deltaMs = timestamp - Date.now()
  const abs = Math.abs(deltaMs)
  if (!Number.isFinite(deltaMs) || !Number.isFinite(abs)) return 'unknown'
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

function formatCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`
  return String(value)
}

function compactPath(path: string): string {
  if (!path) return ''
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 2) return path
  return `…/${parts.slice(-2).join('/')}`
}

function exactTime(timestamp: number): string {
  if (!isFiniteTimestamp(timestamp)) return 'Unknown update time'
  return new Date(timestamp).toLocaleString()
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
  onFork,
  onEnrich,
}: SessionCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(session.name || session.autoTitle)
  const renameRef = useRef<HTMLDivElement>(null)

  const title = session.name.trim() || session.autoTitle.trim() || 'Untitled session'
  const sourceColor = SOURCE_COLOR[session.sourceKind]
  const isHarnessSource = session.sourceKind === 'harness'
  const relativeTime = useMemo(() => formatRelativeTime(session.updatedAt), [session.updatedAt])
  const updatedTitle = useMemo(() => exactTime(session.updatedAt), [session.updatedAt])
  const preview = session.previewSnippet.trim() || session.annotationDescription?.trim() || 'No preview available yet.'
  const provenance = session.sourceKind === 'pi-cli'
    ? compactPath(session.nodeId || session.piPath || '')
    : session.nodeId || session.role || ''
  const displayTags = [...new Set(session.tags.filter(Boolean))]
  const editableTags = displayTags.filter((tag) => tag !== 'pi-cli' && tag !== 'current-project')
  const modelBadge = session.provider && session.modelId
    ? `${session.provider}:${session.modelId}`
    : session.provider || session.modelId || 'runtime'

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

  const describeAndTag = () => {
    if (typeof window === 'undefined') return
    const description = window.prompt('Session description', session.annotationDescription ?? '')
    if (description === null) return
    const tags = window.prompt('Tags (comma separated)', editableTags.join(', '))
    if (tags === null) return

    onEnrich({
      description: description.trim() || undefined,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    })
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onResume}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onResume()
        }
      }}
      role="button"
      tabIndex={0}
      data-tmnl-session-source={session.sourceKind}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '4px minmax(0, 1fr)',
        columnGap: 8,
        padding: '8px 10px 8px 0',
        borderRadius: 6,
        background: isActive ? 'oklch(0.075 0.018 195)' : isHovered ? 'oklch(0.064 0 0)' : 'oklch(0.052 0 0)',
        border: `1px solid ${isActive ? 'oklch(0.18 0.05 195)' : isHovered ? 'oklch(0.15 0 0)' : 'oklch(0.105 0 0)'}`,
        boxShadow: 'none',
        cursor: 'pointer',
        transition: VANTA_ANIMATION.transition.colors,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          alignSelf: 'stretch',
          borderRadius: '6px 0 0 6px',
          background: isActive ? sourceColor : `color-mix(in oklch, ${sourceColor} 58%, transparent)`,
          opacity: isActive ? 1 : 0.72,
        }}
      />

      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
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
                  lineHeight: 1.28,
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
                  color: 'oklch(0.88 0 0)',
                  lineHeight: 1.28,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </div>
            )}
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              aria-label={session.starred ? 'Unstar session' : 'Star session'}
              title={session.starred ? 'Unstar session' : 'Star session'}
              onClick={(event) => {
                event.stopPropagation()
                onStar()
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: session.starred ? 'oklch(0.83 0.16 90)' : 'oklch(0.42 0 0)',
                padding: 0,
                display: 'flex',
                cursor: 'pointer',
              }}
            >
              <Star
                size={13}
                fill={session.starred ? 'oklch(0.83 0.16 90)' : 'transparent'}
              />
            </button>
            <span
              title={updatedTitle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'oklch(0.52 0 0)',
                fontFamily: MONO,
                fontSize: 'var(--tmnl-text-xs, 12px)',
                whiteSpace: 'nowrap',
              }}
            >
              <Clock size={11} />
              {relativeTime}
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto auto auto minmax(0, 1fr)',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
            color: 'oklch(0.54 0 0)',
            fontFamily: MONO,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            lineHeight: 1.1,
          }}
        >
          <span style={{ color: sourceColor }}>{SOURCE_LABEL[session.sourceKind]}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <MessageSquare size={11} />
            {formatCount(session.messageCount)}
          </span>
          <span style={{ color: 'oklch(0.66 0.035 210)', whiteSpace: 'nowrap' }}>
            {modelBadge}
          </span>
          <span
            title={session.sourceKind === 'pi-cli' ? session.piPath ?? provenance : provenance}
            style={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'oklch(0.45 0 0)',
            }}
          >
            {provenance}
          </span>
        </div>

        <p
          style={{
            margin: 0,
            fontFamily: VANTA_TYPOGRAPHY.family.sans,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: session.previewSnippet.trim() ? 'oklch(0.64 0 0)' : 'oklch(0.42 0 0)',
            lineHeight: 1.42,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
            overflowWrap: 'anywhere',
          }}
        >
          {preview}
        </p>

        {(displayTags.length > 0 || session.annotationDescription) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              flexWrap: 'wrap',
              paddingRight: isHovered ? 94 : 0,
            }}
          >
            {session.annotationDescription && (
              <TinyBadge tone="annotated">note</TinyBadge>
            )}
            {displayTags.slice(0, 4).map((tag) => (
              <TinyBadge key={tag}>{tag}</TinyBadge>
            ))}
            {displayTags.length > 4 && <TinyBadge>+{displayTags.length - 4}</TinyBadge>}
          </div>
        )}
      </div>

      {isHovered && !isRenaming && (
        <div
          style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            display: 'flex',
            gap: 4,
          }}
        >
          <ActionIconButton
            icon={<Tags size={13} />}
            label="Describe and tag session"
            onClick={describeAndTag}
          />
          {isHarnessSource && (
            <>
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
                icon={<GitFork size={13} />}
                label="Fork session"
                onClick={onFork}
              />
            </>
          )}
          <ActionIconButton
            icon={<Download size={13} />}
            label="Export session metadata"
            onClick={onExport}
          />
        </div>
      )}
    </div>
  )
}

interface TinyBadgeProps {
  readonly children: React.ReactNode
  readonly tone?: 'default' | 'annotated'
}

function TinyBadge({ children, tone = 'default' }: TinyBadgeProps) {
  return (
    <span
      style={{
        borderRadius: 3,
        border: '1px solid oklch(0.13 0 0)',
        background: tone === 'annotated' ? 'oklch(0.09 0.025 195)' : 'oklch(0.07 0 0)',
        color: tone === 'annotated' ? 'oklch(0.68 0.08 195)' : 'oklch(0.52 0 0)',
        padding: '1px 5px',
        fontFamily: MONO,
        fontSize: 'var(--tmnl-text-xs, 12px)',
        lineHeight: 1.15,
      }}
    >
      {children}
    </span>
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
        background: 'oklch(0.075 0 0)',
        color: danger ? 'oklch(0.72 0.18 25)' : 'oklch(0.58 0 0)',
        borderRadius: 5,
        width: 23,
        height: 23,
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
