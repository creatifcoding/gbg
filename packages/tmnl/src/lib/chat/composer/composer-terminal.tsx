/**
 * Composer.Terminal — Inline terminal widget for the composer area.
 *
 * Shows a mini ghostty-web terminal connected to the most recent active
 * shell session. When no session exists, shows a prompt to spawn one.
 *
 * Two states:
 *   - Collapsed: ~150px, 4–6 rows, overview of current session
 *   - Expanded: ~400px, 12+ rows, full interactive terminal
 *
 * Uses the same two-channel pattern as InteractiveShellTerminalView:
 *   HOT:  subscribeShellData → terminal.write()
 *   COLD: useAtomValue(session.status$) → React re-renders
 *
 * @module chat/composer/composer-terminal
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import {
  Maximize2,
  Minimize2,
  ExternalLink,
  Terminal as TerminalIcon,
  XCircle,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import {
  activeSessionIds$,
  shellSessionFamily,
  subscribeShellData,
  sendShellInput,
  sendShellResize,
  sendShellKill,
} from '@/lib/harness/interactive-shell/shell-session-atoms'
import {
  TerminalCore,
  type TerminalCoreRef,
} from '@/lib/chat/msg/tool-block/renderers/terminal/terminal-core'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const COLLAPSED_HEIGHT = 150
const EXPANDED_HEIGHT = 400
const TRANSITION = { duration: 0.25, ease: [0.32, 0.72, 0, 1] as const }

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface ComposerTerminalProps {
  /** Called when user wants to open the terminal in a full panel */
  onPopOut?: (sessionId: string) => void
  /** Additional class name */
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const ComposerTerminal: FC<ComposerTerminalProps> = ({
  onPopOut,
  className,
}) => {
  const [expanded, setExpanded] = useState(false)
  const termRef = useRef<TerminalCoreRef>(null)

  // ── Pick the most recent active session ─────────────────────────────
  const sessionIds = useAtomValue(activeSessionIds$)
  const activeSessionId = useMemo(() => {
    // Walk backwards to find the most recent running session
    for (let i = sessionIds.length - 1; i >= 0; i--) {
      return sessionIds[i]!
    }
    return null
  }, [sessionIds])

  // ── If we have a session, subscribe to its atoms ────────────────────
  if (!activeSessionId) {
    return <EmptyTerminalPlaceholder className={className} />
  }

  return (
    <ActiveTerminalView
      key={activeSessionId}
      sessionId={activeSessionId}
      expanded={expanded}
      onToggleExpand={() => setExpanded((p) => !p)}
      onPopOut={onPopOut}
      termRef={termRef}
      className={className}
    />
  )
}

ComposerTerminal.displayName = 'Composer.Terminal'

// ─────────────────────────────────────────────────────────────────────────────
// Empty state — no active sessions
// ─────────────────────────────────────────────────────────────────────────────

const EmptyTerminalPlaceholder: FC<{ className?: string }> = ({ className }) => (
  <div
    data-slot="composer-terminal-empty"
    className={cn(
      'flex items-center justify-center gap-2',
      'bg-neutral-950 border border-neutral-800 rounded',
      'text-neutral-600 font-mono',
      className,
    )}
    style={{ height: COLLAPSED_HEIGHT, fontSize: 'var(--tmnl-text-xs, 12px)' }}
  >
    <TerminalIcon size={14} className="text-neutral-700" />
    <span>No active shell session</span>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Active terminal — connected to a live session
// ─────────────────────────────────────────────────────────────────────────────

interface ActiveTerminalViewProps {
  sessionId: string
  expanded: boolean
  onToggleExpand: () => void
  onPopOut?: (sessionId: string) => void
  termRef: React.RefObject<TerminalCoreRef | null>
  className?: string
}

const ActiveTerminalView: FC<ActiveTerminalViewProps> = ({
  sessionId,
  expanded,
  onToggleExpand,
  onPopOut,
  termRef,
  className,
}) => {
  const [ready, setReady] = useState(false)
  const [noGpu, setNoGpu] = useState(false)

  // COLD PATH — reactive metadata
  const session = shellSessionFamily(sessionId)
  const status = useAtomValue(session.status$)
  const info = useAtomValue(session.info$)
  const exitCode = useAtomValue(session.exitCode$)

  const isAlive = status === 'starting' || status === 'running'

  // HOT PATH — direct data → terminal.write()
  useEffect(() => {
    const unsub = subscribeShellData(sessionId, (data: string) => {
      termRef.current?.write(data)
    })
    return unsub
  }, [sessionId, termRef])

  // ── Callbacks ─────────────────────────────────────────────────────
  const handleData = useCallback(
    (data: string) => {
      if (!isAlive) return
      sendShellInput(sessionId, data)
    },
    [sessionId, isAlive],
  )

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (!isAlive) return
      sendShellResize(sessionId, cols, rows)
    },
    [sessionId, isAlive],
  )

  // Auto-focus when ready and alive
  useEffect(() => {
    if (ready && isAlive) {
      const id = setTimeout(() => termRef.current?.focus(), 100)
      return () => clearTimeout(id)
    }
  }, [ready, isAlive, termRef])

  const targetHeight = expanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT
  const headerHeight = 28
  const bodyHeight = targetHeight - headerHeight

  if (noGpu) {
    return (
      <div
        data-slot="composer-terminal"
        className={cn(
          'flex items-center justify-center rounded border border-neutral-800 bg-neutral-950 text-neutral-500 font-mono',
          className,
        )}
        style={{ height: COLLAPSED_HEIGHT, fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        WebGPU not available
      </div>
    )
  }

  return (
    <motion.div
      data-slot="composer-terminal"
      data-session={sessionId}
      data-expanded={expanded}
      className={cn(
        'relative overflow-hidden rounded border flex flex-col',
        'bg-[#0a0a0a]',
        isAlive ? 'border-cyan-900/40' : 'border-neutral-800',
        className,
      )}
      animate={{ height: targetHeight }}
      transition={TRANSITION}
    >
      {/* ── Toolbar overlay (top-right) ────────────────────────── */}
      <div className="absolute top-0 right-0 z-10 flex items-center gap-0.5 p-0.5">
        <ToolbarButton
          icon={expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          title={expanded ? 'Collapse terminal' : 'Expand terminal'}
          onClick={onToggleExpand}
        />
        {onPopOut && (
          <ToolbarButton
            icon={<ExternalLink size={12} />}
            title="Open in panel"
            onClick={() => onPopOut(sessionId)}
          />
        )}
        {isAlive && (
          <ToolbarButton
            icon={<XCircle size={12} />}
            title="Kill session"
            onClick={() => sendShellKill(sessionId)}
            variant="danger"
          />
        )}
      </div>

      {/* ── Session info strip ─────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-2 shrink-0 border-b border-neutral-800/40 bg-neutral-900/20"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)', height: headerHeight }}
      >
        <StatusDot status={status} />
        <span className="text-neutral-500 font-mono truncate">
          {info?.name || sessionId.slice(0, 16)}
        </span>
        {exitCode !== null && exitCode !== undefined && (
          <span className={cn(
            'font-mono',
            exitCode === 0 ? 'text-emerald-500' : 'text-red-400',
          )}>
            exit:{exitCode}
          </span>
        )}
      </div>

      {/* ── TerminalCore body ──────────────────────────────────── */}
      <div className="flex-1 min-h-0" style={{ height: bodyHeight }}>
        <TerminalCore
          ref={termRef}
          fontSize={12}
          autoFit={true}
          disableStdin={!isAlive}
          cursorBlink={isAlive}
          cursorStyle={isAlive ? 'block' : 'underline'}
          onData={handleData}
          onResize={handleResize}
          onReady={() => setReady(true)}
          onError={() => setNoGpu(true)}
        />
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────────────────────────

const StatusDot: FC<{ status: string }> = ({ status }) => {
  const color =
    status === 'running'
      ? 'bg-emerald-400'
      : status === 'starting'
        ? 'bg-yellow-400 animate-pulse'
        : status === 'error'
          ? 'bg-red-400'
          : 'bg-neutral-600'

  return <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', color)} />
}

const ToolbarButton: FC<{
  icon: React.ReactNode
  title: string
  onClick: () => void
  variant?: 'default' | 'danger'
}> = ({ icon, title, onClick, variant = 'default' }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={cn(
      'p-1 rounded transition-colors',
      variant === 'danger'
        ? 'text-neutral-600 hover:text-red-400 hover:bg-red-500/10'
        : 'text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800',
    )}
  >
    {icon}
  </button>
)
