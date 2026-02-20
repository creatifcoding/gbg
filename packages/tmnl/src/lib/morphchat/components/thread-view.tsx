/**
 * Thread Mode Resolver
 *
 * Maps spec.thread axis → rendered message list using src/lib/chat/msg/
 * compound components. Each mode selects different chat/ primitives
 * and applies different layout/styling.
 *
 * Scroll is delegated to ChatThreadBand from src/lib/chat/shell/ —
 * no duplicate useTailFollow here.
 *
 * @module morphchat/components/thread-view
 */

import * as React from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { ChatThreadBand, type ChatThreadAutoScrollMode } from '@/lib/chat/shell'
import { ThreadTailControls } from './thread-tail-controls'
import { useMorphChatContext } from './surface-context'
import { presentationStateFamily } from '../machines/surface-stx'
import type { ChatMessage, ChatRole, ChatMessagePart } from '../schemas/message-types'
import { getMessageParts } from '../schemas/message-types'
import type { MockChatAdapter } from '../adapters/mock-adapter'
import type { AgentTask } from '@/lib/chat/msg/inline-task-types'
import { AnalysisCard, RemediationCard } from './artifact-cards'

// Compose from src/lib/chat/msg/ — the TMNL-styled implementation library
import {
  ChatMessageShellRoot,
  ChatMessageHeaderCluster,
  ChatMessageBodyContent,
  ChatMessageFooterActions,
  ChatMessageSeverityRails,
  ChatThinkingBlock,
  ChatToolBlock,
  ChatFileAttachment,
  ChatCodeBlock,
  ChatTokenUsage,
  getChatRoleIcon,
  CHAT_ROLE_ICON_SIZE,
  CHAT_ICON_STROKE_WIDTH,
} from '@/lib/chat/msg'
import type { ChatMessageRole } from '@/lib/chat/msg'

// =============================================================================
// Pipeline detection — determines which artifact card to render
// =============================================================================

/** Heuristic: remediation tasks have IDs starting with 'rm-' */
function isRemediationPipeline(tasks: ReadonlyArray<AgentTask>): boolean {
  return tasks.length > 0 && tasks[0].taskId.startsWith('rm-')
}

// =============================================================================
// Role Mapping: MorphChat → chat/ library
// =============================================================================

/**
 * MorphChat uses 'operator'/'agent'; src/lib/chat/ uses 'user'/'assistant'.
 * This bridges the two vocabularies.
 */
function toChatRole(role: ChatRole): ChatMessageRole {
  switch (role) {
    case 'operator': return 'user'
    case 'agent': return 'assistant'
    case 'system': return 'system'
    case 'tool': return 'tool'
    default: return 'user'
  }
}

// =============================================================================
// Spec → ChatThreadBand autoScroll mapping
// =============================================================================

function resolveAutoScroll(scrollBehavior: string): ChatThreadAutoScrollMode {
  switch (scrollBehavior) {
    case 'auto-follow': return 'follow'
    case 'pinned': return 'lock'
    case 'manual':
    default: return 'off'
  }
}

// =============================================================================
// Message Renderers (per thread mode)
// =============================================================================

// =============================================================================
// Part Renderer — renders a single ChatMessagePart by _tag discriminant
// =============================================================================

function PartRenderer({
  part,
  isStreaming,
  isLatest,
}: {
  part: ChatMessagePart
  isStreaming: boolean
  isLatest: boolean
}) {
  switch (part._tag) {
    case 'text':
      return (
        <ChatMessageBodyContent>
          <ChatMessageBodyContent.Root streaming={isStreaming}>
            {part.content}
          </ChatMessageBodyContent.Root>
          {isStreaming && isLatest && <ChatMessageBodyContent.StreamCursor />}
        </ChatMessageBodyContent>
      )
    case 'thinking':
      // Convenience wrapper — Root + Trigger + Content in one call
      return (
        <ChatThinkingBlock
          content={part.content}
          isStreaming={part.isStreaming}
          durationMs={part.durationMs}
          defaultOpen={part.isStreaming}
        />
      )
    case 'tool-invocation':
      // Convenience wrapper — Root + Header + Content(Input+Output+Approval) in one call
      return (
        <ChatToolBlock
          toolCallId={part.toolCallId}
          toolName={part.toolName}
          state={part.state}
          input={part.input}
          output={part.output}
          errorText={part.errorText}
        />
      )
    case 'file':
      return (
        <ChatFileAttachment
          url={part.url}
          mediaType={part.mediaType}
          filename={part.filename}
          size={part.size}
        />
      )
    case 'code':
      return (
        <ChatCodeBlock
          code={part.code}
          language={part.language}
          filename={part.filename}
          isStreaming={isStreaming}
        />
      )
    default:
      return null
  }
}

/** Full fidelity message — role badges, timestamps, task pipelines, animations */
// ── Timestamp formatter ──────────────────────────────────

function formatTime(ts?: string): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ═══════════════════════════════════════════════════════════
// UserMessage — right-aligned, full chrome, mirrored layout
// Same structure as assistant, pushed right via ml-auto on shell.
// ═══════════════════════════════════════════════════════════

function UserMessage({ message }: { message: ChatMessage }) {
  const parts = getMessageParts(message)

  return (
    <ChatMessageShellRoot role="user">
      <ChatMessageSeverityRails role="user" placement="right">
        <ChatMessageSeverityRails.RoleIconRail role="user" streaming={false} />
      </ChatMessageSeverityRails>

      <div className="flex-1 min-w-0">
        <ChatMessageHeaderCluster align="end">
          <ChatMessageHeaderCluster.Role>{message.authorName ?? 'You'}</ChatMessageHeaderCluster.Role>
          <ChatMessageHeaderCluster.Timestamp>{formatTime(message.timestamp)}</ChatMessageHeaderCluster.Timestamp>
        </ChatMessageHeaderCluster>

        {parts.map((part, idx) => (
          <PartRenderer
            key={`${message.id}-part-${idx}`}
            part={part}
            isStreaming={false}
            isLatest={false}
          />
        ))}
      </div>
    </ChatMessageShellRoot>
  )
}

// ═══════════════════════════════════════════════════════════
// AssistantMessage — left-aligned, full fidelity
// Icon rail, header, parts, tasks, footer actions
// ═══════════════════════════════════════════════════════════

function AssistantMessage({
  message,
  isLatest,
  tasks,
}: {
  message: ChatMessage
  isLatest: boolean
  tasks?: ReadonlyArray<AgentTask>
}) {
  const chatRole = toChatRole(message.role)
  const isStreaming = message.status === 'streaming'

  const hasTasks = tasks && tasks.length > 0
  const parts = getMessageParts(message)

  return (
    <ChatMessageShellRoot role={chatRole} streaming={isStreaming}>
      <ChatMessageSeverityRails role={chatRole}>
        <ChatMessageSeverityRails.RoleIconRail role={chatRole} streaming={isStreaming} />
      </ChatMessageSeverityRails>
      <div className="flex-1 min-w-0">
        <ChatMessageHeaderCluster>
          <ChatMessageHeaderCluster.Role>{message.authorName ?? chatRole}</ChatMessageHeaderCluster.Role>
          {isStreaming && <ChatMessageHeaderCluster.StreamingBadge streaming role={chatRole} />}
        </ChatMessageHeaderCluster>

        {/* ── Structured Parts Rendering ── */}
        {parts.map((part, idx) => (
          <PartRenderer
            key={`${message.id}-part-${idx}`}
            part={part}
            isStreaming={isStreaming}
            isLatest={isLatest}
          />
        ))}

        {/* ── Artifact Cards (when message carries tasks) ── */}
        {hasTasks && (
          isRemediationPipeline(tasks!)
            ? <RemediationCard
                summary={message.content}
                messageId={message.id}
                tasks={tasks!}
              />
            : <AnalysisCard
                summary={message.content}
                messageId={message.id}
                tasks={tasks}
              />
        )}

        {/* Metadata row — timestamp always visible, extras on hover */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="font-mono text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {formatTime(message.timestamp)}
          </span>
          {message.model && (
            <span className="font-mono text-neutral-700" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {message.model}
            </span>
          )}
          {message.status === 'complete' && message.tokenUsage && (
            <ChatTokenUsage
              inputTokens={message.tokenUsage.prompt}
              outputTokens={message.tokenUsage.completion}
              totalTokens={message.tokenUsage.total}
              cachedTokens={message.tokenUsage.cacheRead}
              modelId={message.model}
              costUsd={message.tokenUsage.cost?.total}
            />
          )}
          {/* Footer actions — hover only */}
          {message.status === 'complete' && !hasTasks && (
            <div className="opacity-0 group-hover/message:opacity-100 transition-opacity duration-150">
              <ChatMessageFooterActions>
                <ChatMessageFooterActions.Group />
              </ChatMessageFooterActions>
            </div>
          )}
        </div>
      </div>
    </ChatMessageShellRoot>
  )
}

/** Compact message — tighter spacing, left-aligned for all roles */
function CompactMessage({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'operator'
  return (
    <div className="flex gap-2 px-3 py-1">
      <span
        className={cn(
          'shrink-0',
          isUser ? 'text-cyan-500' : 'text-emerald-500',
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {isUser ? (message.authorName ?? 'you') : (message.authorName ?? 'agent')}
      </span>
      <span
        className="text-neutral-300 min-w-0 break-words"
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {message.content}
      </span>
    </div>
  )
}

/** Stream-only — just the current streaming response */
function StreamOnlyMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="px-4 py-3">
      <span
        className="text-neutral-200"
        style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
      >
        {message.content}
      </span>
    </div>
  )
}

/** Log mode — monospace, timestamped, terminal-style with role icon */
function LogMessage({ message }: { message: ChatMessage }) {
  const ts = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString('en-US', { hour12: false })
    : '--:--:--'

  const Icon = getChatRoleIcon(message.role as import('@/lib/chat/msg').ChatRawRole)
  const roleColor =
    message.role === 'system' ? 'text-amber-500' :
    message.role === 'agent' ? 'text-emerald-500' :
    message.role === 'tool' ? 'text-violet-400' :
    'text-cyan-500'

  return (
    <div className="flex items-center gap-2 px-3 py-0.5 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
      <span className="text-neutral-600 shrink-0">{ts}</span>
      <Icon size={12} strokeWidth={CHAT_ICON_STROKE_WIDTH} className={cn('shrink-0', roleColor)} />
      <span className={cn('shrink-0 w-8', roleColor)}>
        {message.role.slice(0, 4).toUpperCase()}
      </span>
      <span className="text-neutral-400 min-w-0 break-all">{message.content}</span>
    </div>
  )
}

/** Card mode — each message as a distinct card surface */
function CardMessage({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'operator'
  return (
    <div className="mx-3 my-2 rounded border border-neutral-800 bg-neutral-950 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'px-1.5 py-0.5 rounded',
            isUser
              ? 'bg-cyan-500/10 text-cyan-400'
              : 'bg-emerald-500/10 text-emerald-400',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {message.authorName ?? (isUser ? 'You' : message.role)}
        </span>
        <span
          className="text-neutral-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
        </span>
      </div>
      <div className="text-neutral-200" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        {message.content}
      </div>
    </div>
  )
}

// =============================================================================
// Thread View
// =============================================================================

export function ThreadView() {
  const { spec, adapter, surfaceId } = useMorphChatContext()
  // Read machine presentation state — gate rendering during morph
  const presentationState = useAtomValue(presentationStateFamily(surfaceId))
  // Read directly from adapter atoms — adapter IS the state owner
  const messages = useAtomValue(adapter.messages$)
  const streaming = useAtomValue(adapter.streaming$)

  // Render streaming buffer as a virtual message when active.
  // Some adapters (harness) manage streaming messages directly in messages$.
  // Others (mock) only use streaming$ buffer. We only overlay the buffer when
  // messages$ doesn't already contain the streaming message.
  const displayMessages = React.useMemo(() => {
    if (!streaming.isStreaming || !streaming.buffer) return messages
    const streamingId = streaming.messageId ?? 'stream-buffer'
    const alreadyInMessages = messages.some((m) => m.id === streamingId)
    if (alreadyInMessages) return messages
    const streamMsg: ChatMessage = {
      id: streamingId,
      role: 'agent',
      authorName: 'Agent',
      content: streaming.buffer,
      timestamp: new Date().toISOString(),
      status: 'streaming',
    }
    return [...messages, streamMsg]
  }, [messages, streaming])

  // For stream-only mode, show only the latest streaming or last message
  const streamOnlyMessages = React.useMemo(() => {
    if (spec.thread !== 'stream-only') return displayMessages
    const latest = displayMessages[displayMessages.length - 1]
    return latest ? [latest] : []
  }, [spec.thread, displayMessages])

  const resolvedMessages = spec.thread === 'stream-only' ? streamOnlyMessages : displayMessages

  // Map spec.scrollBehavior → ChatThreadBand autoScroll
  const autoScroll = resolveAutoScroll(spec.scrollBehavior)

  // Task map from adapter (mock-specific, duck-typed)
  const messageTasks = (adapter as Partial<MockChatAdapter>).messageTasks

  // Select renderer per thread mode
  const messageCount = resolvedMessages.length
  const renderMessage = React.useCallback(
    (msg: ChatMessage, index: number) => {
      const isLatest = index === messageCount - 1
      const key = msg.id
      const tasks = messageTasks?.get(msg.id)

      // ── Turn gap logic: 20px between role changes, 4px same-role ──
      const prev = index > 0 ? resolvedMessages[index - 1] : null
      const isTurnChange = prev != null && prev.role !== msg.role
      const gapClass = index === 0 ? '' : isTurnChange ? 'mt-5' : 'mt-1'

      let content: React.ReactNode = null

      switch (spec.thread) {
        case 'full':
          content = msg.role === 'operator'
            ? <UserMessage message={msg} />
            : <AssistantMessage message={msg} isLatest={isLatest} tasks={tasks} />
          break
        case 'compact':
          content = <CompactMessage message={msg} />
          break
        case 'stream-only':
          content = <StreamOnlyMessage message={msg} />
          break
        case 'log':
          content = <LogMessage message={msg} />
          break
        case 'card':
          content = <CardMessage message={msg} />
          break
      }

      return content ? <div key={key} className={gapClass}>{content}</div> : null
    },
    [spec.thread, messageCount, messageTasks, resolvedMessages],
  )

  // Tail controls — rendered inside the ChatThreadBand context scope
  // but outside the scroll container
  const tailControls = spec.scrollBehavior !== 'manual'
    ? <ThreadTailControls />
    : undefined

  // Gate: during morph transition, show skeleton to prevent layout jarring
  if (presentationState === 'morphing') {
    return (
      <ChatThreadBand autoScroll="off" itemCount={0} className="h-full">
        <div className="flex flex-col gap-3 p-4 animate-pulse">
          <div className="h-4 bg-neutral-800/50 rounded w-2/3" />
          <div className="h-4 bg-neutral-800/30 rounded w-1/2" />
          <div className="h-4 bg-neutral-800/20 rounded w-3/4" />
        </div>
      </ChatThreadBand>
    )
  }

  if (resolvedMessages.length === 0) {
    return (
      <ChatThreadBand
        autoScroll="off"
        itemCount={0}
        className={cn(
          'flex items-center justify-center',
          spec.thread === 'log' ? 'bg-neutral-950' : '',
        )}
      >
        <span className="text-neutral-600" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          No messages yet
        </span>
      </ChatThreadBand>
    )
  }

  return (
    <ChatThreadBand
      autoScroll={autoScroll}
      itemCount={resolvedMessages.length}
      bottomThreshold={24}
      renderAfterScroll={tailControls}
      className={cn(
        'h-full',
        spec.thread === 'log' ? 'bg-neutral-950' : '',
      )}
    >
      {resolvedMessages.map(renderMessage)}
    </ChatThreadBand>
  )
}

ThreadView.displayName = 'MorphChat.ThreadView'
