import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  inlineTaskExpandedTasksByScopeAtom,
  toInlineTaskUiStateKey,
} from '@/lib/conductor/atoms'
import { RvnChatInlineTaskThread, RvnChatMessageAttachmentLane } from '@/lib/rvn/chat/msg'
import { RvnConductorChat } from './RvnConductorChat'
import type { ChatExpansionLevel } from './chat-surface-types'
import {
  DEFAULT_RVN_HARNESS_QUICK_ACTIONS,
  DEFAULT_RVN_HARNESS_SLASH_COMMANDS,
  extractMentions,
  mapRvnModeToExpansionLevel,
  toRvnHarnessChatViewModel,
  type RvnHarnessChatMode,
  type RvnHarnessChatSurfaceProps,
  type RvnHarnessThinkingLevel,
} from './rvn-harness-chat-view-model'

function RvnHarnessAssistantInlineTaskAttachment({
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

export function RvnHarnessChatSurface({
  nodeId,
  title,
  agents,
  activeAgentId,
  onActiveAgentChange,
  messages,
  slashCommands = DEFAULT_RVN_HARNESS_SLASH_COMMANDS,
  mentionEntities = [],
  statusRows = [],
  streamingMessageId = null,
  draft: controlledDraft,
  onDraftChange,
  threadScrollTop = 0,
  onThreadScrollTopChange,
  expansionLevel = 'l3',
  onToggleExpansion,
  connectionState = 'connecting',
  messageState = 'idle',
  sessionLabel,
  quickActions = DEFAULT_RVN_HARNESS_QUICK_ACTIONS,
  disabled = false,
  onSend,
  onPause,
  onReconnect,
  onResetSession,
  onExitChat,
  onBreakout,
}: RvnHarnessChatSurfaceProps) {
  const [internalDraft, setInternalDraft] = useState('')
  const [mode, setMode] = useState<RvnHarnessChatMode>('ai')
  const [thinkingLevel, setThinkingLevel] = useState<RvnHarnessThinkingLevel>('med')
  const [isSending, setIsSending] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const [dismissedSuggestionsDraft, setDismissedSuggestionsDraft] = useState<string | null>(null)
  const [agentMenuOpen, setAgentMenuOpen] = useState(false)

  const threadElementId = useId()
  const composerElementId = useId()
  const reconnectElementId = useId()

  const draft = controlledDraft ?? internalDraft
  const setDraft = useCallback(
    (next: string) => {
      setDismissedSuggestionsDraft(null)
      if (onDraftChange) {
        onDraftChange(next)
        return
      }
      setInternalDraft(next)
    },
    [onDraftChange],
  )

  const viewModel = useMemo(
    () =>
      toRvnHarnessChatViewModel({
        expansionLevel,
        draft,
        statusRows,
        agents,
        activeAgentId,
        messages,
        streamingMessageId,
        slashCommands,
        mentionEntities,
      }),
    [
      expansionLevel,
      draft,
      statusRows,
      agents,
      activeAgentId,
      messages,
      streamingMessageId,
      slashCommands,
      mentionEntities,
    ],
  )

  const suggestionsSuppressed = dismissedSuggestionsDraft !== null && dismissedSuggestionsDraft === draft
  const suggestions = suggestionsSuppressed ? [] : viewModel.suggestions
  const highlightedSuggestionIndex = suggestions.length === 0
    ? 0
    : Math.min(activeSuggestionIndex, suggestions.length - 1)

  const isStreamingActive = streamingMessageId !== null || isSending
  const composerIsDisabled = disabled || isSending
  const primaryDisabled = isStreamingActive
    ? !onPause
    : composerIsDisabled || draft.trim().length === 0

  const inlineTaskThreadId = `node:${activeAgentId}`

  useEffect(() => {
    const element = document.getElementById(threadElementId)
    if (!(element instanceof HTMLDivElement)) {
      return
    }

    if (Math.abs(element.scrollTop - threadScrollTop) <= 2) {
      return
    }

    element.scrollTop = threadScrollTop
  }, [threadElementId, threadScrollTop])

  const focusComposer = useCallback(() => {
    const element = document.getElementById(composerElementId)
    if (!(element instanceof HTMLDivElement)) {
      return
    }

    element.focus()

    const selection = window.getSelection?.()
    if (!selection) {
      return
    }

    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [composerElementId])

  const submit = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? draft).trim()
      if (!text || composerIsDisabled || isSending) {
        return
      }

      setIsSending(true)
      try {
        await onSend({
          text,
          mode,
          thinkingLevel,
          targetAgentId: activeAgentId,
          mentions: extractMentions(text),
          voiceOriginated: false,
        })

        if (!overrideText) {
          setDraft('')
        }
      } finally {
        setIsSending(false)
      }
    },
    [activeAgentId, composerIsDisabled, draft, isSending, mode, onSend, setDraft, thinkingLevel],
  )

  const applySuggestion = useCallback(
    (index: number) => {
      const suggestion = suggestions[index]
      if (!suggestion) {
        return
      }

      setDismissedSuggestionsDraft(null)
      setActiveSuggestionIndex(0)
      setDraft(suggestion.replacement)
      focusComposer()
    },
    [focusComposer, setDraft, suggestions],
  )

  const onComposerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (suggestions.length > 0) {
        event.preventDefault()
        setActiveSuggestionIndex(0)
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

      if (viewModel.shouldShowReconnectAction) {
        event.preventDefault()
        document.getElementById(reconnectElementId)?.focus()
      }

      return
    }

    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveSuggestionIndex((current) => (current + 1) % suggestions.length)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveSuggestionIndex((current) => (current - 1 + suggestions.length) % suggestions.length)
        return
      }

      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault()
        applySuggestion(highlightedSuggestionIndex)
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (isStreamingActive) {
        if (onPause) {
          void onPause(activeAgentId)
        }
      } else {
        void submit()
      }
    }
  }

  return (
    <RvnConductorChat.Root
      nodeId={nodeId}
      mode={viewModel.rvnMode}
      onModeChange={(nextMode) => {
        if (!onToggleExpansion) {
          return
        }
        onToggleExpansion(mapRvnModeToExpansionLevel(nextMode), activeAgentId)
      }}
      onExitChat={() => {
        if (onExitChat) {
          void onExitChat(activeAgentId)
        }
      }}
    >
      <RvnConductorChat.Header.Root>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <strong style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>{title}</strong>
          <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)', color: '#475569' }}>
            node: {nodeId}
          </span>
        </div>

        <RvnConductorChat.Header.AgentSwitch style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={agentMenuOpen}
            aria-controls={`${nodeId}-rvn-harness-agent-menu`}
            onClick={() => setAgentMenuOpen((value) => !value)}
            style={{
              border: '1px solid #000',
              borderRadius: 0,
              padding: '2px 8px',
              background: '#fff',
              fontFamily: 'var(--rvn-font-mono)',
              fontSize: 'var(--tmnl-text-xs, 12px)',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            agent: {viewModel.activeAgent?.name ?? 'none'} ▾
          </button>

          {agentMenuOpen ? (
            <div
              id={`${nodeId}-rvn-harness-agent-menu`}
              role="listbox"
              aria-label="Select active conductor agent"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 4px)',
                zIndex: 4,
                border: '1px solid #000',
                background: '#fff',
                minWidth: 220,
                display: 'grid',
                gap: 2,
                padding: 4,
              }}
            >
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  role="option"
                  aria-selected={agent.id === activeAgentId}
                  onClick={() => {
                    onActiveAgentChange(agent.id)
                    setAgentMenuOpen(false)
                  }}
                  style={{
                    border: '1px solid #000',
                    borderRadius: 0,
                    background: agent.id === activeAgentId ? '#eef2ff' : '#fff',
                    textAlign: 'left',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    display: 'grid',
                    gap: 2,
                    fontFamily: 'var(--rvn-font-mono)',
                    fontSize: 'var(--tmnl-text-xs, 12px)',
                  }}
                >
                  <span>{agent.name}</span>
                  <span style={{ color: '#475569' }}>{agent.role} · {agent.model}</span>
                </button>
              ))}
            </div>
          ) : null}
        </RvnConductorChat.Header.AgentSwitch>

        <RvnConductorChat.Header.SessionStatus>
          <span>{connectionState}</span>
          <span>·</span>
          <span>{messageState}</span>
          {sessionLabel ? (
            <>
              <span>·</span>
              <span title={sessionLabel}>{sessionLabel}</span>
            </>
          ) : null}
        </RvnConductorChat.Header.SessionStatus>

        <RvnConductorChat.Header.ResetSession
          onClick={() => {
            if (onResetSession) {
              void onResetSession(activeAgentId)
            }
          }}
          disabled={!onResetSession}
        >
          Reset Session
        </RvnConductorChat.Header.ResetSession>

        <RvnConductorChat.Header.ResetSession
          aria-label={expansionLevel === 'l3' ? 'Collapse from full chat view' : 'Expand to full chat view'}
          onClick={() => {
            if (!onToggleExpansion) {
              return
            }
            const nextLevel: ChatExpansionLevel = expansionLevel === 'l3' ? 'l2' : 'l3'
            onToggleExpansion(nextLevel, activeAgentId)
          }}
          disabled={!onToggleExpansion}
        >
          {expansionLevel === 'l3' ? 'Collapse L2' : 'Expand L3'}
        </RvnConductorChat.Header.ResetSession>

        {expansionLevel === 'l3' ? (
          <RvnConductorChat.Header.ExitL3
            aria-label="Exit chat"
            title="Exit chat"
            onClick={() => {
              if (onExitChat) {
                void onExitChat(activeAgentId)
              }
            }}
            disabled={!onExitChat}
          >
            Exit
          </RvnConductorChat.Header.ExitL3>
        ) : null}
      </RvnConductorChat.Header.Root>

      <RvnConductorChat.Thread.Root
        id={threadElementId}
        onScroll={(event) => {
          if (onThreadScrollTopChange) {
            onThreadScrollTopChange(event.currentTarget.scrollTop)
          }
        }}
      >
        {statusRows.map((row) => (
          <RvnConductorChat.Thread.StatusRow
            key={row.id}
            tone={row.tone}
            role={row.tone === 'error' ? 'alert' : 'status'}
            aria-live={row.tone === 'error' ? 'assertive' : 'polite'}
          >
            {row.text}
          </RvnConductorChat.Thread.StatusRow>
        ))}

        {viewModel.messages.length === 0 ? (
          <RvnConductorChat.Thread.StatusRow tone="info">
            ◇ No messages yet. Use /commands or @mentions.
          </RvnConductorChat.Thread.StatusRow>
        ) : (
          viewModel.messages.map((message) => {
            const breakoutFooter = message.role === 'assistant' && onBreakout
              ? (
                  <RvnConductorChat.Thread.BreakoutAction
                    onClick={() => {
                      const source = messages.find((entry) => entry.id === message.id)
                      if (source) {
                        onBreakout(source)
                      }
                    }}
                  >
                    ▶ Panel
                  </RvnConductorChat.Thread.BreakoutAction>
                )
              : undefined

            if (message.role === 'user') {
              return (
                <RvnConductorChat.Thread.UserMessage key={message.id} at={message.atLabel}>
                  {message.text}
                </RvnConductorChat.Thread.UserMessage>
              )
            }

            if (message.role === 'assistant') {
              return (
                <RvnConductorChat.Thread.AssistantMessage
                  key={message.id}
                  at={message.atLabel}
                  footer={breakoutFooter}
                >
                  {message.streaming ? (
                    <RvnConductorChat.Thread.AssistantMessage.StreamingBody>
                      {message.text}▌
                    </RvnConductorChat.Thread.AssistantMessage.StreamingBody>
                  ) : (
                    <RvnConductorChat.Thread.AssistantMessage.FinalBody>
                      {message.text}
                    </RvnConductorChat.Thread.AssistantMessage.FinalBody>
                  )}

                  <RvnHarnessAssistantInlineTaskAttachment
                    threadId={inlineTaskThreadId}
                    messageAnchorId={message.id}
                    streaming={message.streaming}
                    expansionLevel={expansionLevel}
                  />
                </RvnConductorChat.Thread.AssistantMessage>
              )
            }

            return (
              <RvnConductorChat.Thread.SystemMessage
                key={message.id}
                at={message.atLabel}
                footer={breakoutFooter}
              >
                {message.text}
              </RvnConductorChat.Thread.SystemMessage>
            )
          })
        )}
      </RvnConductorChat.Thread.Root>

      <RvnConductorChat.Composer.Root>
        {viewModel.shouldShowQuickActions ? (
          <RvnConductorChat.Composer.SuggestionRail>
            {quickActions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => {
                  setDraft(action)
                  focusComposer()
                }}
                style={{
                  border: '1px solid #000',
                  borderRadius: 0,
                  padding: '2px 8px',
                  background: '#fff',
                  fontFamily: 'var(--rvn-font-mono)',
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  cursor: 'pointer',
                }}
              >
                {action}
              </button>
            ))}
          </RvnConductorChat.Composer.SuggestionRail>
        ) : null}

        {suggestions.length > 0 ? (
          <RvnConductorChat.Composer.SuggestionPopup role="listbox" aria-label="Composer suggestions">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.key}
                type="button"
                role="option"
                aria-selected={index === highlightedSuggestionIndex}
                onClick={() => applySuggestion(index)}
                style={{
                  border: '1px solid #000',
                  borderRadius: 0,
                  background: index === highlightedSuggestionIndex ? '#ecfeff' : '#fff',
                  display: 'grid',
                  gap: 2,
                  width: '100%',
                  textAlign: 'left',
                  padding: '4px 6px',
                  fontFamily: 'var(--rvn-font-mono)',
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  cursor: 'pointer',
                  marginBottom: 4,
                }}
              >
                <span>{suggestion.title}</span>
                <span style={{ color: '#475569' }}>{suggestion.subtitle}</span>
              </button>
            ))}
          </RvnConductorChat.Composer.SuggestionPopup>
        ) : null}

        <RvnConductorChat.Composer.ContentEditable
          id={composerElementId}
          value={draft}
          onValueChange={setDraft}
          onKeyDown={onComposerKeyDown}
          disabled={composerIsDisabled}
          aria-label="Conductor message composer"
        />

        <div
          data-slot="rvn-harness-chat-toolbar"
          style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}
        >
          <div role="group" aria-label="Composer mode and insert controls" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['terminal', 'ai'] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={mode === candidate}
                aria-label={candidate === 'ai' ? 'AI mode' : 'Terminal mode'}
                onClick={() => setMode(candidate)}
                disabled={composerIsDisabled}
                style={{
                  border: '1px solid #000',
                  borderRadius: 0,
                  background: mode === candidate ? '#eef2ff' : '#fff',
                  padding: '2px 8px',
                  fontFamily: 'var(--rvn-font-mono)',
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  cursor: 'pointer',
                }}
              >
                {candidate === 'ai' ? 'AI' : 'Terminal'}
              </button>
            ))}

            <button
              type="button"
              aria-label={`Thinking level ${thinkingLevel}`}
              onClick={() => {
                const next: RvnHarnessThinkingLevel =
                  thinkingLevel === 'none'
                    ? 'low'
                    : thinkingLevel === 'low'
                      ? 'med'
                      : thinkingLevel === 'med'
                        ? 'high'
                        : 'none'
                setThinkingLevel(next)
              }}
              disabled={composerIsDisabled}
              style={{
                border: '1px solid #000',
                borderRadius: 0,
                background: '#fff',
                padding: '2px 8px',
                fontFamily: 'var(--rvn-font-mono)',
                fontSize: 'var(--tmnl-text-xs, 12px)',
                cursor: 'pointer',
              }}
            >
              ◈ {thinkingLevel}
            </button>

            <button
              type="button"
              aria-label="Insert slash command"
              onClick={() => {
                setDraft(draft.startsWith('/') ? draft : '/')
                focusComposer()
              }}
              disabled={composerIsDisabled}
              style={{
                border: '1px solid #000',
                borderRadius: 0,
                background: '#fff',
                padding: '2px 8px',
                fontFamily: 'var(--rvn-font-mono)',
                fontSize: 'var(--tmnl-text-xs, 12px)',
                cursor: 'pointer',
              }}
            >
              /cmd
            </button>

            <button
              type="button"
              aria-label="Insert entity mention"
              onClick={() => {
                setDraft(`${draft}@`)
                focusComposer()
              }}
              disabled={composerIsDisabled}
              style={{
                border: '1px solid #000',
                borderRadius: 0,
                background: '#fff',
                padding: '2px 8px',
                fontFamily: 'var(--rvn-font-mono)',
                fontSize: 'var(--tmnl-text-xs, 12px)',
                cursor: 'pointer',
              }}
            >
              @entity
            </button>
          </div>

          <div role="group" aria-label="Composer transport controls" style={{ display: 'flex', gap: 6 }}>
            {viewModel.shouldShowReconnectAction ? (
              <RvnConductorChat.Composer.ReconnectAction
                id={reconnectElementId}
                aria-label="Reconnect node chat"
                onClick={() => {
                  if (onReconnect) {
                    void onReconnect(activeAgentId)
                  }
                }}
                disabled={!onReconnect}
              >
                Reconnect
              </RvnConductorChat.Composer.ReconnectAction>
            ) : null}

            <RvnConductorChat.Composer.PrimaryAction
              aria-label={isStreamingActive ? 'Pause stream' : 'Send message'}
              disabled={primaryDisabled}
              onClick={() => {
                if (isStreamingActive) {
                  if (onPause) {
                    void onPause(activeAgentId)
                  }
                  return
                }

                void submit()
              }}
            >
              {isStreamingActive ? 'Pause' : 'Send'}
            </RvnConductorChat.Composer.PrimaryAction>
          </div>
        </div>
      </RvnConductorChat.Composer.Root>
    </RvnConductorChat.Root>
  )
}

RvnHarnessChatSurface.displayName = 'RvnHarnessChatSurface'

export type { RvnHarnessChatSurfaceProps }
