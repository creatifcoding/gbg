import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  inlineTaskExpandedTasksByScopeAtom,
  toInlineTaskUiStateKey,
} from '@/lib/conductor/atoms'
import { RvnChatInlineTaskThread, RvnChatMessageAttachmentLane } from '@/lib/rvn/chat/msg'
import type { ConductorChatMessage } from './ConductorAgentChatService'
import type { ChatExpansionLevel } from './chat-surface-types'
import './styles/conductor-agent-chat.rvn.css'
import './styles/conductor-agent-chat.thread.css'
import './styles/conductor-agent-chat.composer.css'

export type { ChatExpansionLevel } from './chat-surface-types'
export type ChatMode = 'terminal' | 'ai'
export type ThinkingLevel = 'none' | 'low' | 'med' | 'high'
export type ConductorConnectionState = 'offline' | 'connecting' | 'online' | 'reconnecting' | 'resyncing'
export type ConductorMessageLifecycleState =
  | 'idle'
  | 'typing'
  | 'send_accepted'
  | 'assistant_streaming'
  | 'assistant_finalized'
  | 'error'

export interface ConductorChatAgentOption {
  id: string
  name: string
  role: string
  model: string
  status: string
}

export interface ConductorSlashCommand {
  id: string
  command: string
  description: string
}

export interface ConductorMentionEntity {
  id: string
  label: string
  subtitle: string
}

export interface ConductorAgentChatSubmit {
  text: string
  mode: ChatMode
  thinkingLevel: ThinkingLevel
  targetAgentId: string
  mentions: string[]
  voiceOriginated: boolean
}

export interface ConductorChatStatusRow {
  id: string
  tone: 'info' | 'warn' | 'error'
  text: string
}

export interface ConductorAgentChatRootProps extends ComponentPropsWithoutRef<'section'> {
  title: string
  agents: ReadonlyArray<ConductorChatAgentOption>
  activeAgentId: string
  onActiveAgentChange: (agentId: string) => void
  messages: ReadonlyArray<ConductorChatMessage>
  slashCommands?: ReadonlyArray<ConductorSlashCommand>
  mentionEntities?: ReadonlyArray<ConductorMentionEntity>
  statusRows?: ReadonlyArray<ConductorChatStatusRow>
  streamingMessageId?: string | null
  draft?: string
  onDraftChange?: (next: string) => void
  threadScrollTop?: number
  onThreadScrollTopChange?: (next: number) => void
  expansionLevel?: ChatExpansionLevel
  onToggleExpansion?: (next: ChatExpansionLevel, targetAgentId: string) => void
  connectionState?: ConductorConnectionState
  messageState?: ConductorMessageLifecycleState
  sessionLabel?: string
  quickActions?: ReadonlyArray<string>
  disabled?: boolean
  onSend: (payload: ConductorAgentChatSubmit) => void | Promise<void>
  onPause?: (targetAgentId: string) => void | Promise<void>
  onReconnect?: (targetAgentId: string) => void | Promise<void>
  onResetSession?: (targetAgentId: string) => void | Promise<void>
  onExitChat?: (targetAgentId: string) => void | Promise<void>
  onBreakout?: (message: ConductorChatMessage) => void
  children: ReactNode
}

interface ConductorAgentChatContextValue {
  title: string
  agents: ReadonlyArray<ConductorChatAgentOption>
  activeAgentId: string
  onActiveAgentChange: (agentId: string) => void
  messages: ReadonlyArray<ConductorChatMessage>
  statusRows: ReadonlyArray<ConductorChatStatusRow>
  streamingMessageId: string | null
  quickActions: ReadonlyArray<string>
  slashCommands: ReadonlyArray<ConductorSlashCommand>
  mentionEntities: ReadonlyArray<ConductorMentionEntity>
  onBreakout?: (message: ConductorChatMessage) => void
  draft: string
  setDraft: (value: string) => void
  threadScrollTop: number
  onThreadScrollTopChange?: (next: number) => void
  expansionLevel: ChatExpansionLevel
  onToggleExpansion?: (next: ChatExpansionLevel, targetAgentId: string) => void
  connectionState: ConductorConnectionState
  messageState: ConductorMessageLifecycleState
  sessionLabel?: string
  mode: ChatMode
  setMode: (mode: ChatMode) => void
  thinkingLevel: ThinkingLevel
  setThinkingLevel: (level: ThinkingLevel) => void
  disabled: boolean
  isSending: boolean
  submit: (overrideText?: string, voiceOriginated?: boolean) => Promise<void>
  onPause?: (targetAgentId: string) => void | Promise<void>
  onReconnect?: (targetAgentId: string) => void | Promise<void>
  onResetSession?: (targetAgentId: string) => void | Promise<void>
  onExitChat?: (targetAgentId: string) => void | Promise<void>
}

const defaultSlashCommands: ReadonlyArray<ConductorSlashCommand> = [
  { id: 'status', command: '/status', description: 'System status overview' },
  { id: 'status-wo', command: '/status:wo', description: 'Work order status summary' },
  { id: 'alarm', command: '/alarm', description: 'Active alarms list' },
  { id: 'escalate', command: '/escalate', description: 'Escalate work order' },
  { id: 'navigate', command: '/navigate', description: 'Navigate to location' },
]

const defaultQuickActions = ['/status', '/alarm', '@WO-4821']

const ConductorAgentChatContext = createContext<ConductorAgentChatContextValue | null>(null)

function useConductorAgentChatContext(): ConductorAgentChatContextValue {
  const ctx = useContext(ConductorAgentChatContext)
  if (!ctx) {
    throw new Error('ConductorAgentChat compound components must be used within ConductorAgentChat.Root')
  }
  return ctx
}

function cx(...tokens: ReadonlyArray<string | null | undefined | false>): string {
  return tokens.filter(Boolean).join(' ')
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@[A-Za-z0-9:_-]+/g)
  if (!matches) return []
  return matches.map((token) => token.slice(1))
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function resolveSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const candidate = (window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null
}

function ConductorAgentChatRoot({
  title,
  agents,
  activeAgentId,
  onActiveAgentChange,
  messages,
  quickActions = defaultQuickActions,
  slashCommands = defaultSlashCommands,
  mentionEntities = [],
  statusRows = [],
  streamingMessageId = null,
  draft: externalDraft,
  onDraftChange,
  threadScrollTop = 0,
  onThreadScrollTopChange,
  expansionLevel = 'l3',
  onToggleExpansion,
  connectionState = 'connecting',
  messageState = 'idle',
  sessionLabel,
  disabled = false,
  onSend,
  onPause,
  onReconnect,
  onResetSession,
  onExitChat,
  onBreakout,
  children,
  className,
  style,
  ...props
}: ConductorAgentChatRootProps) {
  const [internalDraft, setInternalDraft] = useState('')
  const [mode, setMode] = useState<ChatMode>('ai')
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('med')
  const [isSending, setIsSending] = useState(false)

  const draft = externalDraft ?? internalDraft
  const setDraft = useCallback((next: string) => {
    if (onDraftChange) {
      onDraftChange(next)
      return
    }
    setInternalDraft(next)
  }, [onDraftChange])

  const submit = async (overrideText?: string, voiceOriginated = false) => {
    const text = (overrideText ?? draft).trim()
    if (!text || disabled || isSending) return

    setIsSending(true)
    try {
      await onSend({
        text,
        mode,
        thinkingLevel,
        targetAgentId: activeAgentId,
        mentions: extractMentions(text),
        voiceOriginated,
      })
      if (!overrideText) {
        setDraft('')
      }
    } finally {
      setIsSending(false)
    }
  }

  const contextValue = useMemo<ConductorAgentChatContextValue>(
    () => ({
      title,
      agents,
      activeAgentId,
      onActiveAgentChange,
      messages,
      statusRows,
      streamingMessageId,
      quickActions,
      slashCommands,
      mentionEntities,
      onBreakout,
      draft,
      setDraft,
      threadScrollTop,
      onThreadScrollTopChange,
      expansionLevel,
      onToggleExpansion,
      connectionState,
      messageState,
      sessionLabel,
      mode,
      setMode,
      thinkingLevel,
      setThinkingLevel,
      disabled,
      isSending,
      submit,
      onPause,
      onReconnect,
      onResetSession,
      onExitChat,
    }),
    [
      title,
      agents,
      activeAgentId,
      onActiveAgentChange,
      messages,
      quickActions,
      slashCommands,
      mentionEntities,
      statusRows,
      streamingMessageId,
      onBreakout,
      draft,
      setDraft,
      threadScrollTop,
      onThreadScrollTopChange,
      expansionLevel,
      onToggleExpansion,
      connectionState,
      messageState,
      sessionLabel,
      mode,
      thinkingLevel,
      disabled,
      isSending,
      onPause,
      onReconnect,
      onResetSession,
      onExitChat,
    ],
  )

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const motionMs = prefersReducedMotion ? 0 : 220
  const threadMinHeight = expansionLevel === 'l3'
    ? 'clamp(180px, 32vh, 340px)'
    : 'clamp(140px, 24vh, 220px)'
  const panelMinHeight = expansionLevel === 'l3'
    ? 'clamp(360px, 64vh, 760px)'
    : 'clamp(280px, 48vh, 480px)'

  return (
    <ConductorAgentChatContext.Provider value={contextValue}>
      <section
        data-slot="conductor-agent-chat"
        data-expansion-level={expansionLevel}
        className={cx(
          'rvn-chat',
          'rvn-chat__frame',
          expansionLevel === 'l3' ? 'rvn-chat--l3' : 'rvn-chat--l2',
          className,
        )}
        style={{
          gridTemplateRows: `auto auto minmax(${threadMinHeight}, 1fr) auto`,
          minHeight: panelMinHeight,
          transition: `grid-template-rows ${motionMs}ms cubic-bezier(0.22, 1, 0.36, 1), min-height ${motionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          ...style,
        }}
        {...props}
      >
        {children}
      </section>
    </ConductorAgentChatContext.Provider>
  )
}

ConductorAgentChatRoot.displayName = 'ConductorAgentChat.Root'

function ConductorAgentChatHeader({ className, style, ...props }: ComponentPropsWithoutRef<'header'>) {
  const {
    title,
    agents,
    activeAgentId,
    onActiveAgentChange,
    expansionLevel,
    onToggleExpansion,
    connectionState,
    messageState,
    sessionLabel,
    onResetSession,
    onExitChat,
  } = useConductorAgentChatContext()
  const [open, setOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const activeAgent = agents.find((agent) => agent.id === activeAgentId) ?? agents[0]

  const microMotionProps = prefersReducedMotion
    ? {}
    : {
        whileHover: { y: -1 },
        whileTap: { scale: 0.98 },
        transition: { duration: 0.14, ease: 'easeOut' },
      }

  const connectionTone =
    connectionState === 'online'
      ? '#065f46'
      : connectionState === 'offline'
        ? '#7f1d1d'
        : connectionState === 'resyncing'
          ? '#1e3a8a'
          : '#78350f'

  const messageTone =
    messageState === 'error'
      ? '#7f1d1d'
      : messageState === 'assistant_streaming'
        ? '#0c4a6e'
        : messageState === 'assistant_finalized'
          ? '#14532d'
          : '#374151'

  return (
    <header
      data-slot="conductor-agent-chat-header"
      className={cx('rvn-chat__header', className)}
      style={style}
      {...props}
    >
      <div className="rvn-chat__header-main">
        <div className="rvn-chat__title">
          {title}
        </div>

        <div className="rvn-chat__status-cluster">
          <span
            className="rvn-chat__status-chip rvn-chat__status-chip--connection"
            style={{ '--cchat-chip-color': connectionTone } as CSSProperties}
          >
            {connectionState}
          </span>
          <span
            className="rvn-chat__status-chip rvn-chat__status-chip--message"
            style={{ '--cchat-chip-color': messageTone } as CSSProperties}
          >
            {messageState}
          </span>
          {sessionLabel && (
            <span
              className="rvn-chat__status-chip rvn-chat__status-chip--session"
              title={sessionLabel}
            >
              {sessionLabel}
            </span>
          )}
        </div>
      </div>

      <div className="rvn-chat__controls">
        <motion.button
          type="button"
          {...microMotionProps}
          onClick={() => {
            if (!onToggleExpansion) return
            const nextLevel: ChatExpansionLevel = expansionLevel === 'l3' ? 'l2' : 'l3'
            onToggleExpansion(nextLevel, activeAgentId)
          }}
          className="rvn-chat__control-btn rvn-chat__control-btn--expand"
          data-state={expansionLevel === 'l3' ? 'active' : 'idle'}
          aria-label={expansionLevel === 'l3' ? 'Collapse from full chat view' : 'Expand to full chat view'}
          disabled={!onToggleExpansion}
        >
          {expansionLevel === 'l3' ? 'Collapse L2' : 'Expand L3'}
        </motion.button>

        <motion.button
          type="button"
          {...microMotionProps}
          onClick={() => {
            if (onResetSession) {
              void onResetSession(activeAgentId)
            }
          }}
          disabled={!onResetSession}
          className="rvn-chat__control-btn rvn-chat__control-btn--reset"
        >
          Reset Session
        </motion.button>

        <AnimatePresence initial={false}>
          {expansionLevel === 'l3' && (
            <motion.button
              key="exit-chat"
              type="button"
              {...microMotionProps}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
              aria-label="Exit chat"
              title="Exit chat"
              onClick={() => {
                if (onExitChat) {
                  void onExitChat(activeAgentId)
                }
              }}
              disabled={!onExitChat}
              className="rvn-chat__control-btn rvn-chat__control-btn--exit"
            >
              <X size={12} strokeWidth={2} aria-hidden="true" />
            </motion.button>
          )}
        </AnimatePresence>

        <div data-slot="conductor-agent-chat-agent-selector" className="rvn-chat__agent-selector">
          <motion.button
            type="button"
            {...microMotionProps}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls="conductor-agent-chat-agent-menu"
            onClick={() => setOpen((value) => !value)}
            className="rvn-chat__agent-selector-trigger"
          >
            agent: {activeAgent?.name ?? 'none'} ▾
          </motion.button>

          <AnimatePresence>
            {open && (
              <motion.div
                key="agent-menu"
                id="conductor-agent-chat-agent-menu"
                role="listbox"
                aria-label="Select active conductor agent"
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: 'easeOut' }}
                className="rvn-chat__agent-selector-menu"
              >
                {agents.map((agent) => (
                  <button
                    type="button"
                    key={agent.id}
                    role="option"
                    aria-selected={agent.id === activeAgentId}
                    onClick={() => {
                      onActiveAgentChange(agent.id)
                      setOpen(false)
                    }}
                    data-state={agent.id === activeAgentId ? 'active' : 'idle'}
                    className="rvn-chat__agent-selector-option"
                  >
                    <span className="rvn-chat__agent-selector-option-title">
                      {agent.name}
                    </span>
                    <span className="rvn-chat__agent-selector-option-subtitle">
                      {agent.role} · {agent.model}
                    </span>
                    <span className="rvn-chat__agent-selector-option-subtitle rvn-chat__agent-selector-option-status">
                      {agent.status}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

ConductorAgentChatHeader.displayName = 'ConductorAgentChat.Header'

function ConductorAgentChatQuickActions({ className, style, ...props }: ComponentPropsWithoutRef<'div'>) {
  const { quickActions, draft, setDraft } = useConductorAgentChatContext()

  if (draft.trim().length > 0) {
    return null
  }

  return (
    <div
      data-slot="conductor-agent-chat-quick-actions"
      className={cx('rvn-chat__command-rail', className)}
      style={style}
      {...props}
    >
      {quickActions.map((action) => (
        <button
          type="button"
          key={action}
          onClick={() => setDraft(action)}
          className="rvn-chat__command-chip"
        >
          {action}
        </button>
      ))}
    </div>
  )
}

ConductorAgentChatQuickActions.displayName = 'ConductorAgentChat.QuickActions'

function ConductorAssistantInlineTaskAttachment({
  threadId,
  messageAnchorId,
  streaming,
  expansionLevel,
}: {
  threadId: string
  messageAnchorId: string
  streaming: boolean
  expansionLevel: ChatExpansionLevel
}) {
  const scopeKey = useMemo(
    () => toInlineTaskUiStateKey(threadId, messageAnchorId),
    [messageAnchorId, threadId],
  )
  const tasksAtom = useMemo(() => inlineTaskExpandedTasksByScopeAtom(scopeKey), [scopeKey])
  const tasks = useAtomValue(tasksAtom)

  if (tasks.length === 0 && !streaming) {
    return null
  }

  return (
    <RvnChatMessageAttachmentLane.Root messageAnchorId={messageAnchorId}>
      <RvnChatMessageAttachmentLane.InlineTaskThread>
        <RvnChatInlineTaskThread.VirtualizedList
          threadId={threadId}
          messageAnchorId={messageAnchorId}
          expansionLevel={expansionLevel}
          streaming={streaming}
          autoOpenOnStreaming
        />
      </RvnChatMessageAttachmentLane.InlineTaskThread>
    </RvnChatMessageAttachmentLane.Root>
  )
}

function ConductorAgentChatThread({ className, style, ...props }: ComponentPropsWithoutRef<'div'>) {
  const {
    messages,
    statusRows,
    activeAgentId,
    streamingMessageId,
    expansionLevel,
    threadScrollTop,
    onThreadScrollTopChange,
    onBreakout,
  } = useConductorAgentChatContext()

  const threadRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!threadRef.current) return

    if (Math.abs(threadRef.current.scrollTop - threadScrollTop) > 2) {
      threadRef.current.scrollTop = threadScrollTop
    }
  }, [threadScrollTop])

  const inlineTaskThreadId = `node:${activeAgentId}`

  return (
    <div
      ref={threadRef}
      data-slot="conductor-agent-chat-thread"
      className={cx('rvn-chat__thread', className)}
      onScroll={(event) => {
        if (onThreadScrollTopChange) {
          onThreadScrollTopChange(event.currentTarget.scrollTop)
        }
      }}
      style={style}
      {...props}
    >
      {statusRows.map((row) => (
        <div
          key={row.id}
          role={row.tone === 'error' ? 'alert' : 'status'}
          aria-live={row.tone === 'error' ? 'assertive' : 'polite'}
          data-slot="conductor-agent-chat-status-row"
          data-tone={row.tone}
          className="rvn-chat__alert-row"
        >
          {row.text}
        </div>
      ))}

      {messages.length === 0 ? (
        <div className="rvn-chat__empty-state">
          ◇ No messages yet. Use /commands or @mentions.
        </div>
      ) : (
        messages.map((message) => {
          const roleAccent =
            message.role === 'assistant'
              ? '#0e7490'
              : message.role === 'user'
                ? '#4338ca'
                : '#4b5563'

          const roleBackground =
            message.role === 'assistant'
              ? '#f0fdff'
              : message.role === 'user'
                ? '#eef2ff'
                : '#f5f5f5'

          const isStreamingAssistant = message.role === 'assistant' && streamingMessageId === message.id

          return (
            <article
              key={message.id}
              data-slot="conductor-agent-chat-message"
              data-role={message.role}
              className="rvn-chat__message"
              style={{
                '--cchat-msg-accent': roleAccent,
                '--cchat-msg-bg': roleBackground,
              } as CSSProperties}
            >
              <header
                data-slot="conductor-agent-chat-message-meta"
                className="rvn-chat__message-meta"
              >
                <span>{message.role}</span>
                <span>{new Date(message.at).toLocaleTimeString()}</span>
              </header>

              <div
                data-slot={
                  isStreamingAssistant
                    ? 'conductor-agent-chat-assistant-streaming-body'
                    : 'conductor-agent-chat-assistant-final-body'
                }
                className="rvn-chat__message-body"
                data-streaming={isStreamingAssistant || undefined}
              >
                {isStreamingAssistant ? `${message.text}▌` : message.text}
              </div>

              {message.role === 'assistant' ? (
                <ConductorAssistantInlineTaskAttachment
                  threadId={inlineTaskThreadId}
                  messageAnchorId={message.id}
                  streaming={isStreamingAssistant}
                  expansionLevel={expansionLevel}
                />
              ) : null}

              {message.role === 'assistant' && onBreakout && (
                <footer
                  data-slot="conductor-agent-chat-message-footer"
                  className="rvn-chat__message-footer"
                >
                  <button
                    type="button"
                    onClick={() => onBreakout(message)}
                    className="rvn-chat__breakout"
                  >
                    ▶ Panel
                  </button>
                </footer>
              )}
            </article>
          )
        })
      )}
    </div>
  )
}

ConductorAgentChatThread.displayName = 'ConductorAgentChat.Thread'

function ConductorAgentChatComposer({ className, style, ...props }: ComponentPropsWithoutRef<'div'>) {
  const {
    activeAgentId,
    draft,
    setDraft,
    mode,
    setMode,
    thinkingLevel,
    setThinkingLevel,
    disabled,
    isSending,
    slashCommands,
    mentionEntities,
    statusRows,
    streamingMessageId,
    submit,
    onPause,
    onReconnect,
  } = useConductorAgentChatContext()

  const [activeIndex, setActiveIndex] = useState(0)
  const [dismissedSuggestionsDraft, setDismissedSuggestionsDraft] = useState<string | null>(null)
  const [interimVoiceText, setInterimVoiceText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const speechRef = useRef<SpeechRecognitionLike | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const reconnectButtonRef = useRef<HTMLButtonElement | null>(null)

  const trimmed = draft.trim()
  const composerIsDisabled = disabled || isSending
  const prefersReducedMotion = useReducedMotion()

  const focusComposer = useCallback(() => {
    const element = composerRef.current
    if (!element) return

    element.focus()

    const selection = typeof window !== 'undefined' ? window.getSelection?.() : null
    if (!selection) return

    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [])

  const toolbarMotionProps = prefersReducedMotion
    ? {}
    : {
        whileHover: { y: -1 },
        whileTap: { scale: 0.98 },
        transition: { duration: 0.14, ease: 'easeOut' },
      }

  useEffect(() => {
    const element = composerRef.current
    if (!element) return

    const current = element.textContent ?? ''
    if (current !== draft) {
      element.textContent = draft
    }
  }, [draft])

  const slashQuery = useMemo(() => {
    if (!trimmed.startsWith('/')) return null
    return trimmed.slice(1).toLowerCase()
  }, [trimmed])

  const slashResults = useMemo(() => {
    if (slashQuery === null) return []
    if (slashQuery.length === 0) return slashCommands.slice(0, 6)
    return slashCommands
      .filter((command) => {
        return (
          command.command.toLowerCase().includes(slashQuery) ||
          command.description.toLowerCase().includes(slashQuery)
        )
      })
      .slice(0, 8)
  }, [slashCommands, slashQuery])

  const mentionQuery = useMemo(() => {
    const match = draft.match(/@([A-Za-z0-9:_-]*)$/)
    return match ? match[1].toLowerCase() : null
  }, [draft])

  const mentionResults = useMemo(() => {
    if (mentionQuery === null) return []
    if (mentionQuery.length === 0) return mentionEntities.slice(0, 6)
    return mentionEntities
      .filter((entity) => {
        return (
          entity.id.toLowerCase().includes(mentionQuery) ||
          entity.label.toLowerCase().includes(mentionQuery)
        )
      })
      .slice(0, 8)
  }, [mentionEntities, mentionQuery])

  const suggestionsSuppressed =
    dismissedSuggestionsDraft !== null && dismissedSuggestionsDraft === draft

  const suggestions = suggestionsSuppressed
    ? []
    : slashResults.length > 0
    ? slashResults.map((entry) => ({
        key: entry.id,
        title: entry.command,
        subtitle: entry.description,
        apply: () => {
          setDismissedSuggestionsDraft(null)
          setDraft(`${entry.command} `)
          setActiveIndex(0)
          focusComposer()
        },
      }))
    : mentionResults.map((entity) => ({
        key: entity.id,
        title: `@${entity.id}`,
        subtitle: entity.subtitle,
        apply: () => {
          setDismissedSuggestionsDraft(null)
          setDraft(draft.replace(/@[A-Za-z0-9:_-]*$/, `@${entity.id} `))
          setActiveIndex(0)
          focusComposer()
        },
      }))

  const highlightedSuggestionIndex =
    suggestions.length === 0
      ? 0
      : Math.min(activeIndex, suggestions.length - 1)

  const handleVoiceToggle = () => {
    if (!isRecording && composerIsDisabled) {
      return
    }

    if (isRecording) {
      speechRef.current?.stop()
      setIsRecording(false)
      return
    }

    const ctor = resolveSpeechRecognitionCtor()
    if (!ctor) {
      setInterimVoiceText('Voice input unavailable in this runtime.')
      return
    }

    const recognition = new ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''

      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript ?? ''
        if (index === event.results.length - 1) {
          interimText += transcript
        } else {
          finalText += `${transcript} `
        }
      }

      if (finalText.trim().length > 0) {
        const currentDraft = composerRef.current?.textContent ?? draft
        setDismissedSuggestionsDraft(null)
        setDraft(`${currentDraft} ${finalText}`.trim())
      }
      setInterimVoiceText(interimText)
    }

    recognition.onerror = (event) => {
      setInterimVoiceText(`Voice error: ${event.error}`)
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
      setInterimVoiceText('')
    }

    speechRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (suggestions.length > 0) {
        event.preventDefault()
        setActiveIndex(0)
        setDismissedSuggestionsDraft(draft)
        return
      }

      if (isStreamingActive) {
        event.preventDefault()
        if (onPause) {
          void onPause(activeAgentId)
        }
        return
      }

      if (showReconnectAction) {
        event.preventDefault()
        reconnectButtonRef.current?.focus()
        return
      }
    }

    if (suggestions.length === 0) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        void submit()
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % suggestions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length)
      return
    }

    if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
      event.preventDefault()
      suggestions[highlightedSuggestionIndex]?.apply()
      return
    }
  }

  const onComposerInput = (event: FormEvent<HTMLDivElement>) => {
    setDismissedSuggestionsDraft(null)
    setDraft(event.currentTarget.textContent ?? '')
  }

  const isStreamingActive = streamingMessageId !== null || isSending
  const showReconnectAction = statusRows.some((row) => row.tone === 'warn' || row.tone === 'error')

  const primaryDisabled = isStreamingActive
    ? !onPause
    : disabled || isSending || draft.trim().length === 0

  const handlePrimaryAction = () => {
    if (isStreamingActive) {
      if (onPause) {
        void onPause(activeAgentId)
      }
      return
    }

    void submit(undefined, isRecording)
  }

  return (
    <div
      data-slot="conductor-agent-chat-composer"
      className={cx('rvn-chat__composer', className)}
      style={style}
      {...props}
    >
      <AnimatePresence initial={false}>
        {isRecording && (
          <motion.div
            key="recording-banner"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: 'easeOut' }}
            className="rvn-chat__recording-banner"
          >
            🔴 Recording... {interimVoiceText}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {suggestions.length > 0 && (
          <motion.div
            key="composer-suggestions"
            data-slot="conductor-agent-chat-suggestions"
            role="listbox"
            aria-label="Composer suggestions"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: 'easeOut' }}
            className="rvn-chat__suggestions"
          >
            {suggestions.map((suggestion, index) => (
              <motion.button
                type="button"
                key={suggestion.key}
                role="option"
                aria-selected={index === highlightedSuggestionIndex}
                onClick={suggestion.apply}
                data-state={index === highlightedSuggestionIndex ? 'active' : 'idle'}
                whileHover={prefersReducedMotion ? undefined : { x: 1 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.995 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.12, ease: 'easeOut' }}
                className="rvn-chat__suggestion"
              >
                <span className="rvn-chat__suggestion-title">{suggestion.title}</span>
                <span className="rvn-chat__suggestion-subtitle">{suggestion.subtitle}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rvn-chat__composer-input-wrap">
        {draft.trim().length === 0 && (
          <div className="rvn-chat__composer-placeholder">
            Ask about work orders, alarms, sensors...
          </div>
        )}

        <div
          ref={composerRef}
          role="textbox"
          aria-multiline="true"
          aria-label="Conductor message composer"
          aria-disabled={composerIsDisabled}
          contentEditable={!composerIsDisabled}
          suppressContentEditableWarning
          onInput={onComposerInput}
          onKeyDown={onKeyDown}
          className="rvn-chat__composer-input"
        />
      </div>

      <div
        data-slot="conductor-agent-chat-toolbar"
        className="rvn-chat__toolbar"
      >
        <div role="group" aria-label="Composer mode and insert controls" className="rvn-chat__mode-group">
          <motion.button
            type="button"
            {...toolbarMotionProps}
            aria-pressed={mode === 'terminal'}
            aria-label="Terminal mode"
            onClick={() => setMode('terminal')}
            disabled={composerIsDisabled}
            data-state={mode === 'terminal' ? 'active' : 'idle'}
            className="rvn-chat__tool-btn"
          >
            Terminal
          </motion.button>
          <motion.button
            type="button"
            {...toolbarMotionProps}
            aria-pressed={mode === 'ai'}
            aria-label="AI mode"
            onClick={() => setMode('ai')}
            disabled={composerIsDisabled}
            data-state={mode === 'ai' ? 'active' : 'idle'}
            className="rvn-chat__tool-btn"
          >
            AI
          </motion.button>

          <motion.button
            type="button"
            {...toolbarMotionProps}
            aria-label={`Thinking level ${thinkingLevel}`}
            onClick={() => {
              const next: ThinkingLevel = thinkingLevel === 'none' ? 'low' : thinkingLevel === 'low' ? 'med' : thinkingLevel === 'med' ? 'high' : 'none'
              setThinkingLevel(next)
            }}
            disabled={composerIsDisabled}
            className="rvn-chat__tool-btn rvn-chat__tool-btn--thinking"
          >
            ◈ {thinkingLevel}
          </motion.button>

          <motion.button
            type="button"
            {...toolbarMotionProps}
            aria-label="Insert slash command"
            onClick={() => {
              setDismissedSuggestionsDraft(null)
              setDraft(draft.startsWith('/') ? draft : '/')
              focusComposer()
            }}
            disabled={composerIsDisabled}
            className="rvn-chat__tool-btn rvn-chat__tool-btn--insert"
          >
            /cmd
          </motion.button>

          <motion.button
            type="button"
            {...toolbarMotionProps}
            aria-label="Insert entity mention"
            onClick={() => {
              setDismissedSuggestionsDraft(null)
              setDraft(`${draft}@`)
              focusComposer()
            }}
            disabled={composerIsDisabled}
            className="rvn-chat__tool-btn rvn-chat__tool-btn--insert"
          >
            @entity
          </motion.button>

          <motion.button
            type="button"
            {...toolbarMotionProps}
            aria-label={isRecording ? 'Stop voice input' : 'Start voice input'}
            aria-pressed={isRecording}
            onClick={handleVoiceToggle}
            disabled={composerIsDisabled && !isRecording}
            data-state={isRecording ? 'recording' : 'idle'}
            className="rvn-chat__tool-btn rvn-chat__tool-btn--voice"
          >
            🎤
          </motion.button>
        </div>

        <div role="group" aria-label="Composer transport controls" className="rvn-chat__transport-group">
          <AnimatePresence initial={false}>
            {showReconnectAction && (
              <motion.button
                key="reconnect"
                ref={reconnectButtonRef}
                type="button"
                {...toolbarMotionProps}
                initial={prefersReducedMotion ? undefined : { opacity: 0, x: 6 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, x: 6 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: 'easeOut' }}
                aria-label="Reconnect node chat"
                onClick={() => {
                  if (onReconnect) {
                    void onReconnect(activeAgentId)
                  }
                }}
                disabled={!onReconnect}
                className="rvn-chat__reconnect"
              >
                Reconnect
              </motion.button>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            {...toolbarMotionProps}
            aria-label={isStreamingActive ? 'Pause stream' : 'Send message'}
            onClick={handlePrimaryAction}
            disabled={primaryDisabled}
            className="rvn-chat__send"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isStreamingActive ? 'pause' : 'send'}
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 4 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.14, ease: 'easeOut' }}
                style={{ display: 'inline-block' }}
              >
                {isStreamingActive ? 'Pause' : 'Send'}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </div>
  )
}

ConductorAgentChatComposer.displayName = 'ConductorAgentChat.Composer'

export const ConductorAgentChat = Object.assign(ConductorAgentChatRoot, {
  Root: ConductorAgentChatRoot,
  Header: ConductorAgentChatHeader,
  QuickActions: ConductorAgentChatQuickActions,
  Thread: ConductorAgentChatThread,
  Composer: ConductorAgentChatComposer,
})
