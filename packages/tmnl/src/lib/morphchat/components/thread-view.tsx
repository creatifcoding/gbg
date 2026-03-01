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

import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { ReactNode, RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Atom, useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { ChatThreadBand, type ChatThreadAutoScrollMode } from '@/lib/chat/shell'
import { FloatingScrollPill } from './floating-scroll-pill'
import { useMorphChatContext } from './surface-context'
import { presentationStateFamily } from '../machines/surface-stx'
import type { ChatMessage, ChatRole, ChatMessagePart, StreamingState } from '../schemas/message-types'
import { getMessageParts } from '../schemas/message-types'
import type { MorphChatAdapter } from '../schemas/adapter-types'
import { getMessageAtom } from '../hooks/useHarnessAdapter'
import { streamingMetrics$, idleMetricsAtom } from '../atoms/streaming-metrics'
import { StreamingMetricsProvider } from './streaming-metrics-provider'
import { StreamEntryPlaceholder } from '@/lib/chat/msg/body-content/stream-entry-placeholder'
import { MessageActionBar } from '@/lib/chat/msg/action-bar'
import type { AgentTask } from '@/lib/chat/msg/inline-task-types'
import { AnalysisCard, RemediationCard } from './artifact-cards'
import { InlineUITreeCard } from '@/lib/chat/msg/inline-ui-tree-card'
import { RESPONSIVE_MAX_W, RESPONSIVE_MSG_PAD, type ChatWidthTier } from '@/lib/chat/tokens'
import { useSurfaceWidth } from '@/lib/chat/hooks/use-surface-width'

// Compose from src/lib/chat/msg/ — the TMNL-styled implementation library
import {
  ChatMessageShellRoot,
  ChatMessageHeaderCluster,
  ChatMessageBodyContent,
  ChatMessageSeverityRails,
  ChatThinkingBlock,
  ChatToolBlock,
  ChatFileAttachment,
  ChatCodeBlock,
  ChatMermaidBlock,
  ChatTokenUsage,
  getChatRoleIcon,
  CHAT_ROLE_ICON_SIZE,
  CHAT_ICON_STROKE_WIDTH,
} from '@/lib/chat/msg'
import type { ChatMessageRole } from '@/lib/chat/msg'
import { CompactionBoundary } from '@/lib/chat/msg/md-components'

// =============================================================================
// Pipeline detection — determines which artifact card to render
// =============================================================================

/** Heuristic: remediation tasks have IDs starting with 'rm-' */
function isRemediationPipeline(tasks: ReadonlyArray<AgentTask>): boolean {
  return tasks.length > 0 && tasks[0].taskId.startsWith('rm-')
}

// =============================================================================
// Responsive Width Tiers
// =============================================================================

/**
 * Thread width tiers — matches Band 1/2 approach.
 *
 *   compact  (<350px)  — tighter padding, hide role icons, compact metadata
 *   squeeze  (350–500) — normal padding, icons visible, compact token usage
 *   full     (≥500px)  — full chrome, full metadata
 */
// Width-tier classification via shared hook (useSurfaceWidth).
// When ThreadView manages its own ref it measures locally;
// when surface-content passes widthTier prop, measurement is shared.

/** Padding per tier */
const THREAD_PAD: Record<ChatWidthTier, string> = {
  compact: 'px-2',
  squeeze: 'px-3',
  full: 'px-4',
}

/** Turn gap per tier */
const TURN_GAP: Record<ChatWidthTier, string> = {
  compact: 'mt-3',
  squeeze: 'mt-4',
  full: 'mt-5',
}

/** Message gap per tier */
const MSG_GAP: Record<ChatWidthTier, string> = {
  compact: 'mt-0.5',
  squeeze: 'mt-1',
  full: 'mt-1',
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

// Sentinel atoms for unconditional hook calls (Rules of Hooks compliance)
const NULL_MESSAGE_ATOM = Atom.make<ChatMessage | null>(null)
const NULL_IDS_ATOM = Atom.make<ReadonlyArray<string>>([])
const NULL_MESSAGES_ATOM = Atom.make<ReadonlyArray<ChatMessage>>([])
const NULL_STREAMING_ATOM = Atom.make<StreamingState>({
  phase: 'idle', buffer: '', tokensReceived: 0,
})
const EMPTY_TASKS_MAP = Atom.make<ReadonlyMap<string, ReadonlyArray<unknown>>>(new Map())
const legacyMessageAtomCache = new WeakMap<MorphChatAdapter, Map<string, Atom.Atom<ChatMessage | null>>>()

/**
 * Narrowed streaming$ projection: only isStreaming + messageId.
 * Changes only at stream start/end — NOT on every delta buffer concat.
 * Prevents ThreadView from re-rendering on every token.
 */
const streamingSignalCache = new WeakMap<MorphChatAdapter, Atom.Atom<{ isStreaming: boolean; messageId: string | null }>>()

function getStreamingSignalAtom(adapter: MorphChatAdapter): Atom.Atom<{ isStreaming: boolean; messageId: string | null }> {
  let cached = streamingSignalCache.get(adapter)
  if (cached) return cached

  let prevIsStreaming = false
  let prevMessageId: string | null = null
  let prevResult = { isStreaming: false, messageId: null as string | null }

  cached = Atom.make((get) => {
    const s = get(adapter.streaming$)
    const nextIsStreaming = s.phase !== 'idle' && s.phase !== 'error-recovery'
    const nextMessageId = s.messageId ?? null
    // Return same reference if signal hasn't changed — atom won't notify subscribers
    if (nextIsStreaming === prevIsStreaming && nextMessageId === prevMessageId) {
      return prevResult
    }
    prevIsStreaming = nextIsStreaming
    prevMessageId = nextMessageId
    prevResult = { isStreaming: nextIsStreaming, messageId: nextMessageId }
    return prevResult
  })
  streamingSignalCache.set(adapter, cached)
  return cached
}

function resolveHarnessInstanceId(adapterId: string): string | null {
  return adapterId.startsWith('harness-') ? adapterId.slice('harness-'.length) : null
}

function getLegacyMessageAtom(adapter: MorphChatAdapter, messageId: string): Atom.Atom<ChatMessage | null> {
  let cache = legacyMessageAtomCache.get(adapter)
  if (!cache) {
    cache = new Map()
    legacyMessageAtomCache.set(adapter, cache)
  }

  const cached = cache.get(messageId)
  if (cached) return cached

  const atom = Atom.make((get) => get(adapter.messages$).find((message) => message.id === messageId) ?? null)
  cache.set(messageId, atom)
  return atom
}

function resolveMessageAtom(adapter: MorphChatAdapter, messageId: string): Atom.Atom<ChatMessage | null> {
  if (adapter.messageAtom) {
    return adapter.messageAtom(messageId)
  }

  if (adapter.getMessageAtom) {
    return adapter.getMessageAtom(messageId)
  }

  const harnessInstanceId = resolveHarnessInstanceId(adapter.adapterId)
  if (harnessInstanceId) {
    return getMessageAtom(harnessInstanceId, messageId)
  }

  return getLegacyMessageAtom(adapter, messageId)
}

// =============================================================================
// Message Renderers (per thread mode)
// =============================================================================

// =============================================================================
// Part Renderer — renders a single ChatMessagePart by _tag discriminant
// =============================================================================

const PartRenderer = memo(function PartRenderer({
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
          {/* EPOCH-0005: AnimatePresence for graceful cursor exit on stream completion */}
          <AnimatePresence>
            {isStreaming && isLatest && (
              <motion.span
                key="stream-cursor"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
              >
                <ChatMessageBodyContent.StreamCursor />
              </motion.span>
            )}
          </AnimatePresence>
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
    case 'tool-invocation': {
      // Convenience wrapper — Root + Header + Content(Input+Output+Approval) in one call
      // If input not yet populated (tool still generating), try parsing inputDelta
      const rawDelta = 'inputDelta' in part ? (part as { inputDelta?: string }).inputDelta : undefined
      let resolvedInput = part.input
      if (resolvedInput == null && rawDelta) {
        try { resolvedInput = JSON.parse(rawDelta) } catch { /* partial JSON, ignore */ }
      }
      // Stash inputDelta on the input object so renderers (e.g. Write) can
      // extract fields from partial JSON while the LLM is still generating
      const inputWithDelta = rawDelta && resolvedInput == null
        ? { inputDelta: rawDelta }
        : resolvedInput != null
          ? { ...(typeof resolvedInput === 'object' ? resolvedInput as Record<string, unknown> : {}), inputDelta: rawDelta }
          : resolvedInput
      return (
        <ChatToolBlock
          toolCallId={part.toolCallId}
          toolName={part.toolName}
          state={part.state}
          input={inputWithDelta}
          output={part.output}
          errorText={part.errorText}
        />
      )
    }
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
      // ```ui code blocks → progressive inline UI rendering (NDJSON format)
      if (part.language === 'ui') {
        return (
          <InlineUITreeCard
            ndjsonSource={part.code}
            isStreaming={part.isStreaming ?? isStreaming}
          />
        )
      }
      // Mermaid code blocks → beautiful SVG diagram
      if (part.language === 'mermaid') {
        return (
          <ChatMermaidBlock
            source={part.code}
            isStreaming={part.isStreaming ?? isStreaming}
          />
        )
      }
      return (
        <ChatCodeBlock
          code={part.code}
          language={part.language}
          filename={part.filename}
          isStreaming={part.isStreaming ?? isStreaming}
        />
      )
    case 'ui-tree':
      return (
        <InlineUITreeCard
          tree={part.tree}
          isStreaming={false}
        />
      )
    default:
      return null
  }
},
(prev, next) => prev.part === next.part && prev.isStreaming === next.isStreaming && prev.isLatest === next.isLatest,
)

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

const UserMessage = memo(function UserMessage({
  message,
  widthTier = 'full',
}: {
  message: ChatMessage
  widthTier?: ChatWidthTier
}) {
  const parts = getMessageParts(message)
  const compact = widthTier === 'compact'

  return (
    <ChatMessageShellRoot
      role="user"
      className={cn(RESPONSIVE_MAX_W.user[widthTier], RESPONSIVE_MSG_PAD.user[widthTier])}
    >
      {/* Hide role icon rail at compact width */}
      {!compact && (
        <ChatMessageSeverityRails role="user" placement="right">
          <ChatMessageSeverityRails.RoleIconRail role="user" streaming={false} />
        </ChatMessageSeverityRails>
      )}

      <div className="flex-1 min-w-0">
        <ChatMessageHeaderCluster align="end" className={compact ? 'gap-1 mb-0.5' : undefined}>
          <ChatMessageHeaderCluster.Role>{compact ? 'You' : (message.authorName ?? 'You')}</ChatMessageHeaderCluster.Role>
          {!compact && (
            <ChatMessageHeaderCluster.Timestamp>{formatTime(message.timestamp)}</ChatMessageHeaderCluster.Timestamp>
          )}
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
}, (prev, next) => prev.message === next.message && prev.widthTier === next.widthTier)

// ═══════════════════════════════════════════════════════════
// CopyMessageButton — copies message text to clipboard
// ═══════════════════════════════════════════════════════════

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [text])

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied!' : 'Copy message'}
      className={cn(
        'inline-flex items-center justify-center rounded',
        'w-5 h-5',
        'transition-colors duration-150 ease-out',
        copied
          ? 'text-emerald-400'
          : 'text-neutral-600 hover:text-neutral-300',
      )}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Clipboard base — fades out when copied */}
        <g
          style={{
            opacity: copied ? 0 : 1,
            transition: 'opacity 150ms ease-out',
          }}
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </g>
        {/* Checkmark — draws in via stroke-dashoffset */}
        <polyline
          points="20 6 9 17 4 12"
          style={{
            strokeDasharray: 28,
            strokeDashoffset: copied ? 0 : 28,
            opacity: copied ? 1 : 0,
            transition: 'stroke-dashoffset 250ms ease-out 50ms, opacity 100ms ease-out',
          }}
        />
      </svg>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// AssistantMessage — left-aligned, full fidelity
// Icon rail, header, parts, tasks, footer actions
// ═══════════════════════════════════════════════════════════

const AssistantMessage = memo(function AssistantMessage({
  message,
  isLatest,
  tasks,
  widthTier = 'full',
}: {
  message: ChatMessage
  isLatest: boolean
  tasks?: ReadonlyArray<AgentTask>
  widthTier?: ChatWidthTier
}) {
  const chatRole = toChatRole(message.role)
  const isStreaming = message.status === 'streaming'
  const compact = widthTier === 'compact'

  const hasTasks = tasks && tasks.length > 0
  const parts = getMessageParts(message)

  // ── Streaming Metrics (EPOCH-0005) ───────────────────────
  // Derive from harness instanceId when available; non-harness adapters
  // get IDLE_METRICS (stable reference, zero re-renders).
  const { adapter } = useMorphChatContext()
  const harnessId = resolveHarnessInstanceId(adapter.adapterId)
  const metricsAtom = harnessId ? streamingMetrics$(harnessId) : idleMetricsAtom
  const metrics = useAtomValue(metricsAtom)

  return (
    <StreamingMetricsProvider value={metrics}>
      <ChatMessageShellRoot
        role={chatRole}
        streaming={isStreaming}
        className={cn(RESPONSIVE_MAX_W.assistant[widthTier], RESPONSIVE_MSG_PAD.assistant[widthTier])}
      >
        {/* Hide role icon rail at compact width */}
        {!compact && (
          <ChatMessageSeverityRails role={chatRole}>
            <ChatMessageSeverityRails.RoleIconRail role={chatRole} streaming={isStreaming} />
          </ChatMessageSeverityRails>
        )}
        <div className="flex-1 min-w-0">
          <ChatMessageHeaderCluster className={compact ? 'gap-1 mb-0.5' : undefined}>
            <ChatMessageHeaderCluster.Role>
              {compact
                ? (message.role === 'agent' ? 'Agt' : (message.authorName ?? chatRole).slice(0, 3))
                : (message.authorName ?? chatRole)}
            </ChatMessageHeaderCluster.Role>
            {isStreaming && <ChatMessageHeaderCluster.StreamingBadge streaming role={chatRole} />}
            {message.status === 'cancelled' && (
              <span className="text-amber-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>⊘ Cancelled</span>
            )}
          </ChatMessageHeaderCluster>

          {/* ── EPOCH-0005: Phased Entry Placeholder ── */}
          {/* Shows skeleton/thinking dots until first text content arrives */}
          {isStreaming && parts.every(p => p._tag === 'text' && !p.content) && (
            <StreamEntryPlaceholder />
          )}

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

          {/* Metadata row — progressive disclosure by tier */}
          <div className={cn('flex items-center mt-1.5', compact ? 'gap-1' : 'gap-3')}>
            {/* Timestamp — always visible */}
            <span className="font-mono text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}>
              {formatTime(message.timestamp)}
            </span>
            {/* Model name — full tier only */}
            {widthTier === 'full' && message.model && (
              <span className="font-mono text-neutral-700 truncate max-w-[120px]" style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}>
                {message.model}
              </span>
            )}
            {/* Token usage — full tier only, slides in on completion (EPOCH-0005) */}
            <AnimatePresence>
              {widthTier === 'full' && message.status === 'complete' && message.tokenUsage && (
                <motion.span
                  key="token-usage"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.15, ease: [0.32, 0.72, 0, 1] }}
                >
                  <ChatTokenUsage
                    inputTokens={message.tokenUsage.prompt}
                    outputTokens={message.tokenUsage.completion}
                    totalTokens={message.tokenUsage.total}
                    cachedTokens={message.tokenUsage.cacheRead}
                    modelId={message.model}
                    costUsd={message.tokenUsage.cost?.total}
                  />
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* EPOCH-0005: Progressive Action Bar — replaces standalone copy button */}
          {widthTier !== 'compact' && message.status === 'complete' && message.content && (
            <MessageActionBar
              content={message.content}
              onRetry={undefined} // TODO: wire adapter.send with last user message
              onContinue={undefined} // TODO: wire adapter.send with continuation prompt
            />
          )}
        </div>
      </ChatMessageShellRoot>
    </StreamingMetricsProvider>
  )
},
(prev, next) => prev.message === next.message && prev.isLatest === next.isLatest && prev.widthTier === next.widthTier,
)

/** Compact message — tighter spacing, left-aligned for all roles */
const CompactMessage = memo(function CompactMessage({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'operator'
  return (
    <div className="flex gap-2 px-3 py-1">
      <span
        className={cn(
          'shrink-0',
          isUser ? 'text-cyan-500' : 'text-emerald-500',
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
      >
        {isUser ? (message.authorName ?? 'you') : (message.authorName ?? 'agent')}
      </span>
      <span
        className="text-neutral-300 min-w-0 break-words"
        style={{ fontSize: 'var(--tmnl-text-sm, 12px)' }}
      >
        {message.content}
      </span>
    </div>
  )
}, (prev, next) => prev.message === next.message)

/** Stream-only — just the current streaming response */
const StreamOnlyMessage = memo(function StreamOnlyMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="px-4 py-3">
      <span
        className="text-neutral-200"
        style={{ fontSize: 'var(--tmnl-text-base, 14px)' }}
      >
        {message.content}
      </span>
    </div>
  )
}, (prev, next) => prev.message === next.message)

/** Log mode — monospace, timestamped, terminal-style with role icon */
const LogMessage = memo(function LogMessage({ message }: { message: ChatMessage }) {
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
    <div className="flex items-center gap-2 px-3 py-0.5 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}>
      <span className="text-neutral-600 shrink-0">{ts}</span>
      <Icon size={12} strokeWidth={CHAT_ICON_STROKE_WIDTH} className={cn('shrink-0', roleColor)} />
      <span className={cn('shrink-0 w-8', roleColor)}>
        {message.role.slice(0, 4).toUpperCase()}
      </span>
      <span className="text-neutral-400 min-w-0 break-all">{message.content}</span>
    </div>
  )
}, (prev, next) => prev.message === next.message)

/** Card mode — each message as a distinct card surface */
const CardMessage = memo(function CardMessage({ message }: { message: ChatMessage }) {
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
          style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
        >
          {message.authorName ?? (isUser ? 'You' : message.role)}
        </span>
        <span
          className="text-neutral-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
        >
          {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
        </span>
      </div>
      <div className="text-neutral-200" style={{ fontSize: 'var(--tmnl-text-sm, 12px)' }}>
        {message.content}
      </div>
    </div>
  )
}, (prev, next) => prev.message === next.message)

// =============================================================================
// Thread View
// =============================================================================

const MessageRow = memo(function MessageRow({
  messageId,
  prevMessageId,
  adapter,
  index,
  isLatest,
  threadMode,
  syntheticMessage,
  widthTier,
}: {
  messageId: string
  prevMessageId: string | null
  adapter: MorphChatAdapter
  index: number
  isLatest: boolean
  threadMode: string
  syntheticMessage: ChatMessage | null
  widthTier: ChatWidthTier
}) {
  const message = useAtomValue(resolveMessageAtom(adapter, messageId)) ?? syntheticMessage
  const previousMessage = useAtomValue(
    prevMessageId ? resolveMessageAtom(adapter, prevMessageId) : NULL_MESSAGE_ATOM,
  )

  if (!message) return null

  const isTurnChange = previousMessage != null && previousMessage.role !== message.role
  const gapClass = index === 0 ? '' : isTurnChange ? TURN_GAP[widthTier] : MSG_GAP[widthTier]
  const allTasks = useAtomValue(adapter.messageTasks$ ?? EMPTY_TASKS_MAP)
  const tasks = allTasks.get(message.id) as ReadonlyArray<AgentTask> | undefined

  let content: ReactNode = null
  switch (threadMode) {
    case 'full':
      content = message.role === 'operator'
        ? <UserMessage message={message} widthTier={widthTier} />
        : <AssistantMessage message={message} isLatest={isLatest} tasks={tasks} widthTier={widthTier} />
      break
    case 'compact':
      content = <CompactMessage message={message} />
      break
    case 'stream-only':
      content = <StreamOnlyMessage message={message} />
      break
    case 'log':
      content = <LogMessage message={message} />
      break
    case 'card':
      content = <CardMessage message={message} />
      break
  }

  return content ? <div className={gapClass}>{content}</div> : null
}, (prev, next) => (
  prev.messageId === next.messageId
  && prev.prevMessageId === next.prevMessageId
  && prev.adapter === next.adapter
  && prev.index === next.index
  && prev.widthTier === next.widthTier
  && prev.isLatest === next.isLatest
  && prev.threadMode === next.threadMode
  && prev.syntheticMessage === next.syntheticMessage
))

export function ThreadView({ widthTier: externalTier }: { widthTier?: ChatWidthTier } = {}) {
  const { spec, adapter, surfaceId } = useMorphChatContext()
  // Read machine presentation state — gate rendering during morph
  const presentationState = useAtomValue(presentationStateFamily(surfaceId))

  // ── Responsive width tier ──
  const threadRef = useRef<HTMLDivElement>(null)
  const measuredTier = useSurfaceWidth(threadRef)
  const widthTier = externalTier ?? measuredTier

  // ── Atom subscriptions (unconditional — Rules of Hooks) ──
  // Per-message atom path: subscribe to messageIds$ (stable during streaming).
  // Legacy path: subscribe to messages$ (full array, changes every delta).
  // Both hooks always fire; we branch on which value to use.
  const hasPerMessageAtoms = !!adapter.messageIds$
  const perMessageIds = useAtomValue(adapter.messageIds$ ?? NULL_IDS_ATOM)
  const legacyMessages = useAtomValue(hasPerMessageAtoms ? NULL_MESSAGES_ATOM : adapter.messages$)

  // Narrowed streaming signal — only isStreaming + messageId.
  // Changes twice per response (start + end), NOT on every delta.
  // Legacy adapters still need full streaming$ for buffer overlay.
  const streamingSignal = useAtomValue(getStreamingSignalAtom(adapter))
  const legacyStreaming = useAtomValue(hasPerMessageAtoms ? NULL_STREAMING_ATOM : adapter.streaming$)

  // Synthetic streaming message — only for legacy adapters that don't put
  // the streaming message in messages$ (mock adapter, etc.)
  const syntheticStreamingMessage = useMemo(() => {
    if (hasPerMessageAtoms || !legacyMessages) return null
    if ((legacyStreaming.phase === 'idle' || legacyStreaming.phase === 'error-recovery') || !legacyStreaming.buffer) return null

    const streamingId = legacyStreaming.messageId ?? 'stream-buffer'
    const alreadyInMessages = legacyMessages.some((m) => m.id === streamingId)
    if (alreadyInMessages) return null

    return {
      id: streamingId,
      role: 'agent',
      authorName: 'Agent',
      content: legacyStreaming.buffer,
      timestamp: new Date().toISOString(),
      status: 'streaming',
    } satisfies ChatMessage
  }, [hasPerMessageAtoms, legacyMessages, legacyStreaming.phase, legacyStreaming.messageId, legacyStreaming.buffer])

  const syntheticStreamingId = syntheticStreamingMessage?.id ?? null

  // Derive display IDs — only changes when messages are added/removed.
  const displayIds = useMemo(() => {
    if (hasPerMessageAtoms) {
      // Per-message atom path: messageIds$ is stable during streaming content updates.
      // Only check if streaming message needs to be appended (edge case: message not yet in list).
      if (streamingSignal.isStreaming && streamingSignal.messageId) {
        const hasStreaming = perMessageIds.includes(streamingSignal.messageId)
        if (!hasStreaming) return [...perMessageIds, streamingSignal.messageId]
      }
      return perMessageIds
    }

    // Legacy path: derive from full messages array.
    const ids = legacyMessages!.map((m) => m.id)
    if (syntheticStreamingId && !ids.includes(syntheticStreamingId)) {
      return [...ids, syntheticStreamingId]
    }
    return ids
  }, [hasPerMessageAtoms, perMessageIds, legacyMessages, syntheticStreamingId, streamingSignal.isStreaming, streamingSignal.messageId])

  const resolvedIds = useMemo(() => {
    if (spec.thread !== 'stream-only') return displayIds
    const latest = displayIds[displayIds.length - 1]
    return latest ? [latest] : []
  }, [spec.thread, displayIds])

  // Map spec.scrollBehavior → ChatThreadBand autoScroll
  const autoScroll = resolveAutoScroll(spec.scrollBehavior)

  // EPOCH-0005: Floating pill as footer overlay — mirrors header overlay pattern.
  // Rendered inside the ChatThreadBand tail context scope.
  const footerOverlay = spec.scrollBehavior !== 'manual'
    ? <FloatingScrollPill />
    : undefined

  // Gate: during morph transition, show skeleton to prevent layout jarring
  if (presentationState === 'morphing') {
    return (
      <div ref={threadRef} data-width-tier={widthTier} className="h-full">
        <ChatThreadBand autoScroll="off" itemCount={0} className="h-full">
          <div className={cn('flex flex-col gap-3 animate-pulse', THREAD_PAD[widthTier], 'py-4')}>
            <div className="h-4 bg-neutral-800/50 rounded w-2/3" />
            <div className="h-4 bg-neutral-800/30 rounded w-1/2" />
            <div className="h-4 bg-neutral-800/20 rounded w-3/4" />
          </div>
        </ChatThreadBand>
      </div>
    )
  }

  if (resolvedIds.length === 0) {
    return (
      <div ref={threadRef} data-width-tier={widthTier} className="h-full">
        <ChatThreadBand
          autoScroll="off"
          itemCount={0}
          className={cn(
            'flex items-center justify-center h-full',
            spec.thread === 'log' ? 'bg-neutral-950' : '',
          )}
        >
          <span className="text-neutral-600" style={{ fontSize: 'var(--tmnl-text-sm, 12px)' }}>
            No messages yet
          </span>
        </ChatThreadBand>
      </div>
    )
  }

  return (
    <div ref={threadRef} data-width-tier={widthTier} className="h-full">
      <ChatThreadBand
        autoScroll={autoScroll}
        itemCount={resolvedIds.length}
        bottomThreshold={24}
        renderFooterOverlay={footerOverlay}
        className={cn(
          'h-full',
          spec.thread === 'log' ? 'bg-neutral-950' : '',
        )}
      >
        {resolvedIds.map((id, index) => (
          <MessageRow
            key={id}
            messageId={id}
            prevMessageId={index > 0 ? resolvedIds[index - 1] : null}
            adapter={adapter}
            index={index}
            isLatest={index === resolvedIds.length - 1}
            threadMode={spec.thread}
            syntheticMessage={syntheticStreamingId === id ? syntheticStreamingMessage : null}
            widthTier={widthTier}
          />
        ))}
      </ChatThreadBand>
    </div>
  )
}

ThreadView.displayName = 'MorphChat.ThreadView'
