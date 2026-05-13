import { type FC, useCallback, useEffect, useMemo, useRef } from 'react'
import { useAtomSet, useAtomValue } from '@effect-atom/atom-react'
import { Effect, ManagedRuntime, Option, Stream } from 'effect'

import {
  ChatDataProvider,
  ExtensionUIResponse,
  PiProvider,
  SendMessageOptions,
  type ExtensionUIRequest,
  type ProviderState,
} from '@/lib/ai-core'
import {
  FoldablePanel,
  FoldablePanelProvider,
  createFoldablePanelAtoms,
} from '@/lib/foldable-panel'
import type { PanelBadge } from '@/lib/foldable-panel/types'
import {
  copChatActiveBreakoutAtom,
  copChatBreakoutRequestIdAtom,
  copChatConnectionStateAtom,
  copChatErrorAtom,
  copChatExtensionDraftsAtom,
  copChatInputAtom,
  copChatIsStreamingAtom,
  copChatMessagesAtom,
  copChatPendingCountAtom,
  copChatPendingExtensionUIAtom,
  copChatResolvingIdsAtom,
  type CopChatMessageRow,
} from '../atoms/chatPanelAtoms'

const PANEL_ID = 'cop-chat'
const NODE_ID = 'cop-chat-panel'

const BADGE: PanelBadge = {
  tag: 'custom',
  label: 'COP Chat',
  color: '#c8e4d8',
}

type CopChatRuntime = ManagedRuntime.ManagedRuntime<ChatDataProvider, never>

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const mapMessages = (messages: readonly unknown[]): readonly CopChatMessageRow[] =>
  messages
    .map((raw, index) => {
      const record = asRecord(raw)
      const id = asString(record.id) ?? `message-${index}`
      const roleRaw = asString(record.role) ?? 'unknown'
      const role: CopChatMessageRow['role'] =
        roleRaw === 'user' || roleRaw === 'assistant' || roleRaw === 'system' ? roleRaw : 'unknown'

      const text = asString(record.text) ?? ''
      const thinking = asString(record.thinking)
      const isStreaming = Boolean(record.isStreaming)
      const createdAt = typeof record.createdAt === 'number' ? record.createdAt : Date.now()

      return {
        id,
        role,
        text,
        thinking,
        isStreaming,
        createdAt,
      } satisfies CopChatMessageRow
    })
    .filter((message) => message.text.length > 0 || (message.thinking ?? '').length > 0 || message.role === 'system')

const payloadTitle = (request: ExtensionUIRequest): string => {
  const payload = asRecord(request.payload)
  return (
    asString(payload.title) ??
    asString(payload.message) ??
    `${request.method} requested`
  )
}

const payloadMessage = (request: ExtensionUIRequest): string | null => {
  const payload = asRecord(request.payload)
  return asString(payload.message)
}

const payloadOptions = (request: ExtensionUIRequest): readonly string[] => {
  const payload = asRecord(request.payload)
  const raw = payload.options
  if (!Array.isArray(raw)) return []
  return raw.filter((entry): entry is string => typeof entry === 'string')
}

const roleColor: Record<CopChatMessageRow['role'], string> = {
  user: '#3b82f6',
  assistant: '#c8e4d8',
  system: '#f59e0b',
  unknown: '#6b7280',
}

const roleLabel: Record<CopChatMessageRow['role'], string> = {
  user: 'USER',
  assistant: 'ASSISTANT',
  system: 'SYSTEM',
  unknown: 'EVENT',
}

export const CopChatPanel: FC = () => {
  const panelAtoms = useMemo(() => createFoldablePanelAtoms(PANEL_ID), [])

  const runtimeRef = useRef<CopChatRuntime | null>(null)
  const disposedRef = useRef(false)

  const connectionState = useAtomValue(copChatConnectionStateAtom)
  const messages = useAtomValue(copChatMessagesAtom)
  const input = useAtomValue(copChatInputAtom)
  const isStreaming = useAtomValue(copChatIsStreamingAtom)
  const error = useAtomValue(copChatErrorAtom)
  const pendingRequests = useAtomValue(copChatPendingExtensionUIAtom)
  const pendingCount = useAtomValue(copChatPendingCountAtom)
  const resolvingIds = useAtomValue(copChatResolvingIdsAtom)
  const drafts = useAtomValue(copChatExtensionDraftsAtom)
  const breakoutRequest = useAtomValue(copChatActiveBreakoutAtom)

  const setConnectionState = useAtomSet(copChatConnectionStateAtom)
  const setMessages = useAtomSet(copChatMessagesAtom)
  const setInput = useAtomSet(copChatInputAtom)
  const setIsStreaming = useAtomSet(copChatIsStreamingAtom)
  const setError = useAtomSet(copChatErrorAtom)
  const setPending = useAtomSet(copChatPendingExtensionUIAtom)
  const setResolvingIds = useAtomSet(copChatResolvingIdsAtom)
  const setDrafts = useAtomSet(copChatExtensionDraftsAtom)
  const setBreakoutRequestId = useAtomSet(copChatBreakoutRequestIdAtom)

  const syncProviderState = useCallback(
    (state: ProviderState, pending: readonly ExtensionUIRequest[]) => {
      setMessages(mapMessages(state.messages))
      setIsStreaming(state.isStreaming)
      setError(state.error)
      setPending(pending)

      if (pending.length === 0) {
        setBreakoutRequestId(null)
      }
    },
    [setBreakoutRequestId, setError, setIsStreaming, setMessages, setPending]
  )

  useEffect(() => {
    disposedRef.current = false

    const runtime = ManagedRuntime.make(
      PiProvider.browserWebSocketLayer({
        nodeId: NODE_ID,
        role: 'general',
      })
    )

    runtimeRef.current = runtime
    setConnectionState('connecting')

    runtime
      .runPromise(
        Effect.gen(function* () {
          const provider = yield* ChatDataProvider
          const initial = yield* provider.getState
          const initialPending = provider.getPendingExtensionUI
            ? yield* provider.getPendingExtensionUI
            : []

          yield* Effect.sync(() => {
            syncProviderState(initial, initialPending)
            setConnectionState('ready')
          })

          yield* Stream.runForEach(provider.stateChanges, (next) =>
            Effect.gen(function* () {
              const pending = provider.getPendingExtensionUI
                ? yield* provider.getPendingExtensionUI
                : []

              yield* Effect.sync(() => {
                syncProviderState(next, pending)
              })
            })
          )
        })
      )
      .catch((cause) => {
        if (disposedRef.current) return
        const message = cause instanceof Error ? cause.message : String(cause)
        setError(message)
        setConnectionState('error')
      })

    return () => {
      disposedRef.current = true
      const runtimeToDispose = runtimeRef.current
      runtimeRef.current = null
      if (runtimeToDispose) {
        runtimeToDispose.dispose().catch(() => undefined)
      }
    }
  }, [setConnectionState, setError, syncProviderState])

  const refreshPending = useCallback(async () => {
    const runtime = runtimeRef.current
    if (!runtime) return

    const nextPending = await runtime.runPromise(
      Effect.gen(function* () {
        const provider = yield* ChatDataProvider
        if (!provider.getPendingExtensionUI) return [] as readonly ExtensionUIRequest[]
        return yield* provider.getPendingExtensionUI
      })
    )

    setPending(nextPending)
  }, [setPending])

  const sendMessage = useCallback(async () => {
    const runtime = runtimeRef.current
    if (!runtime || input.trim().length === 0 || isStreaming) return

    setError(null)

    await runtime
      .runPromise(
        Effect.gen(function* () {
          const provider = yield* ChatDataProvider
          yield* provider.sendMessage(
            new SendMessageOptions({
              text: input.trim(),
              systemPrompt: Option.none(),
              attachments: [],
            })
          )
        })
      )
      .then(() => {
        setInput('')
      })
      .catch((cause) => {
        const message = cause instanceof Error ? cause.message : String(cause)
        setError(message)
      })
  }, [input, isStreaming, setError, setInput])

  const clearConversation = useCallback(async () => {
    const runtime = runtimeRef.current
    if (!runtime) return

    await runtime
      .runPromise(
        Effect.gen(function* () {
          const provider = yield* ChatDataProvider
          yield* provider.clear
        })
      )
      .then(() => {
        setDrafts({})
        setBreakoutRequestId(null)
      })
      .catch((cause) => {
        const message = cause instanceof Error ? cause.message : String(cause)
        setError(message)
      })
  }, [setBreakoutRequestId, setDrafts, setError])

  const abortStream = useCallback(async () => {
    const runtime = runtimeRef.current
    if (!runtime) return

    await runtime
      .runPromise(
        Effect.gen(function* () {
          const provider = yield* ChatDataProvider
          yield* provider.abort
        })
      )
      .catch((cause) => {
        const message = cause instanceof Error ? cause.message : String(cause)
        setError(message)
      })
  }, [setError])

  const respondToRequest = useCallback(
    async (request: ExtensionUIRequest, response: ExtensionUIResponse) => {
      const runtime = runtimeRef.current
      if (!runtime) return

      setResolvingIds([...resolvingIds, request.requestId])
      setError(null)

      await runtime
        .runPromise(
          Effect.gen(function* () {
            const provider = yield* ChatDataProvider
            if (!provider.respondExtensionUI) {
              return yield* Effect.fail(new Error('Provider does not expose extension UI responses'))
            }
            yield* provider.respondExtensionUI(response)
          })
        )
        .then(() => refreshPending())
        .catch((cause) => {
          const message = cause instanceof Error ? cause.message : String(cause)
          setError(message)
        })
        .finally(() => {
          setResolvingIds(resolvingIds.filter((id) => id !== request.requestId))
        })
    },
    [refreshPending, resolvingIds, setError, setResolvingIds]
  )

  const sendConfirm = useCallback(
    async (request: ExtensionUIRequest, confirmed: boolean) => {
      await respondToRequest(
        request,
        new ExtensionUIResponse({
          requestId: request.requestId,
          kind: 'confirm',
          value: Option.none(),
          confirmed: Option.some(confirmed),
        })
      )
    },
    [respondToRequest]
  )

  const sendCancel = useCallback(
    async (request: ExtensionUIRequest) => {
      await respondToRequest(
        request,
        new ExtensionUIResponse({
          requestId: request.requestId,
          kind: 'cancel',
          value: Option.none(),
          confirmed: Option.none(),
        })
      )
    },
    [respondToRequest]
  )

  const sendValue = useCallback(
    async (request: ExtensionUIRequest) => {
      const value = drafts[request.requestId] ?? ''
      await respondToRequest(
        request,
        new ExtensionUIResponse({
          requestId: request.requestId,
          kind: 'value',
          value: Option.some(value),
          confirmed: Option.none(),
        })
      )
    },
    [drafts, respondToRequest]
  )

  const updateDraft = useCallback(
    (requestId: string, value: string) => {
      setDrafts({
        ...drafts,
        [requestId]: value,
      })
    },
    [drafts, setDrafts]
  )

  return (
    <FoldablePanelProvider panelId={PANEL_ID} atoms={panelAtoms} badge={BADGE}>
      <FoldablePanel
        panelId={PANEL_ID}
        badge={BADGE}
        expandedHeight={520}
        customName="COP Chat — Pi Remote"
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: breakoutRequest ? '1fr 320px' : '1fr',
          height: '100%',
          minHeight: 0,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: '1px solid rgba(200,228,216,0.08)',
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  color: connectionState === 'ready' ? '#10b981' : connectionState === 'error' ? '#ef4444' : '#f59e0b',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--tmnl-font-mono, monospace)',
                  letterSpacing: '0.05em',
                }}>
                  {connectionState}
                </span>
                <span style={{
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  color: 'rgba(200,228,216,0.5)',
                  fontFamily: 'var(--tmnl-font-mono, monospace)',
                }}>
                  pending dialogs: {pendingCount}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={abortStream}
                  disabled={!isStreaming}
                  style={{
                    border: '1px solid rgba(245,158,11,0.4)',
                    background: 'rgba(245,158,11,0.15)',
                    color: '#f59e0b',
                    fontSize: 'var(--tmnl-text-xs, 12px)',
                    fontFamily: 'var(--tmnl-font-mono, monospace)',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    cursor: isStreaming ? 'pointer' : 'not-allowed',
                    opacity: isStreaming ? 1 : 0.4,
                  }}
                >
                  abort
                </button>
                <button
                  onClick={clearConversation}
                  style={{
                    border: '1px solid rgba(200,228,216,0.2)',
                    background: 'rgba(200,228,216,0.05)',
                    color: '#c8e4d8',
                    fontSize: 'var(--tmnl-text-xs, 12px)',
                    fontFamily: 'var(--tmnl-font-mono, monospace)',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    cursor: 'pointer',
                  }}
                >
                  clear
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '6px 12px',
                borderBottom: '1px solid rgba(239,68,68,0.25)',
                background: 'rgba(239,68,68,0.08)',
                color: '#ef4444',
                fontSize: 'var(--tmnl-text-xs, 12px)',
                fontFamily: 'var(--tmnl-font-mono, monospace)',
              }}>
                ERROR: {error}
              </div>
            )}

            <div style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderBottom: '1px solid rgba(200,228,216,0.08)',
            }}>
              {messages.length === 0 && (
                <div style={{
                  padding: '16px',
                  border: '1px dashed rgba(200,228,216,0.2)',
                  color: 'rgba(200,228,216,0.4)',
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  fontFamily: 'var(--tmnl-font-mono, monospace)',
                  lineHeight: 1.6,
                }}>
                  No messages yet. Ask for status, alarms, or work orders.
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    border: `1px solid ${roleColor[message.role]}33`,
                    background: `${roleColor[message.role]}11`,
                    padding: '8px 10px',
                  }}
                >
                  <div style={{
                    fontSize: 'var(--tmnl-text-xs, 12px)',
                    fontFamily: 'var(--tmnl-font-mono, monospace)',
                    color: roleColor[message.role],
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}>
                    {roleLabel[message.role]}{message.isStreaming ? ' • streaming' : ''}
                  </div>
                  {message.text.length > 0 && (
                    <div style={{
                      fontSize: 'var(--tmnl-text-sm, 14px)',
                      color: 'rgba(200,228,216,0.9)',
                      fontFamily: 'var(--tmnl-font-mono, monospace)',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                    }}>
                      {message.text}
                    </div>
                  )}
                  {message.thinking && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 'var(--tmnl-text-xs, 12px)',
                      color: 'rgba(200,228,216,0.45)',
                      fontFamily: 'var(--tmnl-font-mono, monospace)',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {message.thinking}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {pendingRequests.length > 0 && (
              <div style={{
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                borderBottom: '1px solid rgba(200,228,216,0.08)',
                maxHeight: 210,
                overflowY: 'auto',
              }}>
                {pendingRequests.map((request) => {
                  const busy = resolvingIds.includes(request.requestId)
                  const options = payloadOptions(request)

                  return (
                    <div
                      key={request.requestId}
                      style={{
                        border: '1px solid rgba(245,158,11,0.35)',
                        background: 'rgba(245,158,11,0.08)',
                        padding: '8px 10px',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}>
                        <span style={{
                          fontSize: 'var(--tmnl-text-xs, 12px)',
                          fontFamily: 'var(--tmnl-font-mono, monospace)',
                          color: '#f59e0b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}>
                          {request.method}
                        </span>
                        <button
                          onClick={() => setBreakoutRequestId(request.requestId)}
                          style={{
                            border: '1px solid rgba(245,158,11,0.4)',
                            background: 'rgba(245,158,11,0.15)',
                            color: '#f59e0b',
                            fontSize: 'var(--tmnl-text-xs, 12px)',
                            fontFamily: 'var(--tmnl-font-mono, monospace)',
                            padding: '1px 8px',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                          }}
                        >
                          breakout
                        </button>
                      </div>

                      <div style={{
                        fontSize: 'var(--tmnl-text-sm, 14px)',
                        color: 'rgba(245,158,11,0.95)',
                        fontFamily: 'var(--tmnl-font-mono, monospace)',
                        marginBottom: 4,
                      }}>
                        {payloadTitle(request)}
                      </div>

                      {payloadMessage(request) && (
                        <div style={{
                          fontSize: 'var(--tmnl-text-xs, 12px)',
                          color: 'rgba(245,158,11,0.75)',
                          fontFamily: 'var(--tmnl-font-mono, monospace)',
                          marginBottom: 6,
                        }}>
                          {payloadMessage(request)}
                        </div>
                      )}

                      {options.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                          {options.map((option) => (
                            <button
                              key={option}
                              onClick={() => updateDraft(request.requestId, option)}
                              style={{
                                border: '1px solid rgba(245,158,11,0.4)',
                                background: 'rgba(245,158,11,0.12)',
                                color: '#fbbf24',
                                fontSize: 'var(--tmnl-text-xs, 12px)',
                                fontFamily: 'var(--tmnl-font-mono, monospace)',
                                padding: '1px 6px',
                                cursor: 'pointer',
                              }}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}

                      {request.method === 'confirm' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            disabled={busy}
                            onClick={() => sendConfirm(request, true)}
                            style={{
                              border: '1px solid rgba(16,185,129,0.45)',
                              background: 'rgba(16,185,129,0.15)',
                              color: '#10b981',
                              fontSize: 'var(--tmnl-text-xs, 12px)',
                              fontFamily: 'var(--tmnl-font-mono, monospace)',
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              cursor: busy ? 'not-allowed' : 'pointer',
                              opacity: busy ? 0.5 : 1,
                            }}
                          >
                            confirm
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => sendCancel(request)}
                            style={{
                              border: '1px solid rgba(239,68,68,0.45)',
                              background: 'rgba(239,68,68,0.15)',
                              color: '#ef4444',
                              fontSize: 'var(--tmnl-text-xs, 12px)',
                              fontFamily: 'var(--tmnl-font-mono, monospace)',
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              cursor: busy ? 'not-allowed' : 'pointer',
                              opacity: busy ? 0.5 : 1,
                            }}
                          >
                            cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            value={drafts[request.requestId] ?? ''}
                            onChange={(event) => updateDraft(request.requestId, event.target.value)}
                            placeholder="response"
                            style={{
                              flex: 1,
                              border: '1px solid rgba(245,158,11,0.35)',
                              background: 'rgba(0,0,0,0.3)',
                              color: '#fbbf24',
                              fontSize: 'var(--tmnl-text-xs, 12px)',
                              fontFamily: 'var(--tmnl-font-mono, monospace)',
                              padding: '2px 6px',
                              outline: 'none',
                            }}
                          />
                          <button
                            disabled={busy}
                            onClick={() => sendValue(request)}
                            style={{
                              border: '1px solid rgba(16,185,129,0.45)',
                              background: 'rgba(16,185,129,0.15)',
                              color: '#10b981',
                              fontSize: 'var(--tmnl-text-xs, 12px)',
                              fontFamily: 'var(--tmnl-font-mono, monospace)',
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              cursor: busy ? 'not-allowed' : 'pointer',
                              opacity: busy ? 0.5 : 1,
                            }}
                          >
                            send
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: 8,
              padding: '8px 12px',
              alignItems: 'flex-end',
            }}>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder="Ask about work orders, alarms, or request agent actions..."
                style={{
                  flex: 1,
                  minHeight: 56,
                  maxHeight: 120,
                  resize: 'vertical',
                  border: '1px solid rgba(200,228,216,0.2)',
                  background: 'rgba(0,0,0,0.45)',
                  color: '#c8e4d8',
                  fontSize: 'var(--tmnl-text-sm, 14px)',
                  fontFamily: 'var(--tmnl-font-mono, monospace)',
                  padding: '6px 8px',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => void sendMessage()}
                disabled={input.trim().length === 0 || isStreaming}
                style={{
                  border: '1px solid rgba(200,228,216,0.35)',
                  background: 'rgba(200,228,216,0.12)',
                  color: '#c8e4d8',
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  fontFamily: 'var(--tmnl-font-mono, monospace)',
                  textTransform: 'uppercase',
                  padding: '4px 10px',
                  cursor: input.trim().length === 0 || isStreaming ? 'not-allowed' : 'pointer',
                  opacity: input.trim().length === 0 || isStreaming ? 0.45 : 1,
                  height: 28,
                }}
              >
                send
              </button>
            </div>
          </div>

          {breakoutRequest && (
            <div style={{
              borderLeft: '1px solid rgba(245,158,11,0.35)',
              background: 'rgba(245,158,11,0.07)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 10px',
                borderBottom: '1px solid rgba(245,158,11,0.3)',
              }}>
                <span style={{
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  color: '#f59e0b',
                  fontFamily: 'var(--tmnl-font-mono, monospace)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  Breakout Dialog
                </span>
                <button
                  onClick={() => setBreakoutRequestId(null)}
                  style={{
                    border: '1px solid rgba(245,158,11,0.4)',
                    background: 'rgba(245,158,11,0.15)',
                    color: '#f59e0b',
                    fontSize: 'var(--tmnl-text-xs, 12px)',
                    fontFamily: 'var(--tmnl-font-mono, monospace)',
                    textTransform: 'uppercase',
                    padding: '1px 8px',
                    cursor: 'pointer',
                  }}
                >
                  close
                </button>
              </div>

              <div style={{
                padding: '10px',
                overflowY: 'auto',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                <div style={{
                  fontSize: 'var(--tmnl-text-sm, 14px)',
                  color: '#fbbf24',
                  fontFamily: 'var(--tmnl-font-mono, monospace)',
                }}>
                  {payloadTitle(breakoutRequest)}
                </div>
                {payloadMessage(breakoutRequest) && (
                  <div style={{
                    fontSize: 'var(--tmnl-text-xs, 12px)',
                    color: 'rgba(245,158,11,0.85)',
                    fontFamily: 'var(--tmnl-font-mono, monospace)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {payloadMessage(breakoutRequest)}
                  </div>
                )}

                <div style={{
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  color: 'rgba(245,158,11,0.8)',
                  fontFamily: 'var(--tmnl-font-mono, monospace)',
                  textTransform: 'uppercase',
                }}>
                  method: {breakoutRequest.method}
                </div>

                {breakoutRequest.method !== 'confirm' && (
                  <textarea
                    value={drafts[breakoutRequest.requestId] ?? ''}
                    onChange={(event) => updateDraft(breakoutRequest.requestId, event.target.value)}
                    placeholder="Enter response value"
                    style={{
                      minHeight: 120,
                      border: '1px solid rgba(245,158,11,0.35)',
                      background: 'rgba(0,0,0,0.35)',
                      color: '#fbbf24',
                      fontSize: 'var(--tmnl-text-sm, 14px)',
                      fontFamily: 'var(--tmnl-font-mono, monospace)',
                      padding: '8px',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {breakoutRequest.method === 'confirm' ? (
                    <>
                      <button
                        onClick={() => sendConfirm(breakoutRequest, true)}
                        style={{
                          border: '1px solid rgba(16,185,129,0.45)',
                          background: 'rgba(16,185,129,0.15)',
                          color: '#10b981',
                          fontSize: 'var(--tmnl-text-xs, 12px)',
                          fontFamily: 'var(--tmnl-font-mono, monospace)',
                          textTransform: 'uppercase',
                          padding: '4px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        confirm
                      </button>
                      <button
                        onClick={() => sendCancel(breakoutRequest)}
                        style={{
                          border: '1px solid rgba(239,68,68,0.45)',
                          background: 'rgba(239,68,68,0.15)',
                          color: '#ef4444',
                          fontSize: 'var(--tmnl-text-xs, 12px)',
                          fontFamily: 'var(--tmnl-font-mono, monospace)',
                          textTransform: 'uppercase',
                          padding: '4px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => sendValue(breakoutRequest)}
                        style={{
                          border: '1px solid rgba(16,185,129,0.45)',
                          background: 'rgba(16,185,129,0.15)',
                          color: '#10b981',
                          fontSize: 'var(--tmnl-text-xs, 12px)',
                          fontFamily: 'var(--tmnl-font-mono, monospace)',
                          textTransform: 'uppercase',
                          padding: '4px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        send value
                      </button>
                      <button
                        onClick={() => sendCancel(breakoutRequest)}
                        style={{
                          border: '1px solid rgba(239,68,68,0.45)',
                          background: 'rgba(239,68,68,0.15)',
                          color: '#ef4444',
                          fontSize: 'var(--tmnl-text-xs, 12px)',
                          fontFamily: 'var(--tmnl-font-mono, monospace)',
                          textTransform: 'uppercase',
                          padding: '4px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </FoldablePanel>
    </FoldablePanelProvider>
  )
}
