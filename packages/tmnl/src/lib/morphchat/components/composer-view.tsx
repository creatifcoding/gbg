/**
 * Composer Variant Resolver
 *
 * Maps spec.composer axis → actual chat/composer compound component
 * configuration. MorphChat orchestrates; src/lib/chat/composer/ implements.
 *
 * Transfer drop zone:
 *   When spec.enableTransferDrop is true, the composer area accepts
 *   dragged task tokens via useTransferDroppable from @/lib/transfer/v2.
 *   Dropped tokens are converted to context chip references.
 *
 * @module morphchat/components/composer-view
 */

import * as React from 'react'
import { AtSign, Command, Mic, Paperclip, Pause, RotateCcw } from 'lucide-react'
import { Effect } from 'effect'
import { useAtomValue } from '@effect-atom/atom-react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import { connectionStateFamily } from '../machines/surface-stx'
import { Composer, useComposer } from '@/lib/chat/composer'
import { useTransferDroppable } from '@/lib/transfer/v2/hooks'
import type { TransferToken, TransferResult } from '@/lib/transfer/v2/schemas'
import { Atom } from '@effect-atom/atom'
import type { MockChatAdapter, MockCommandChip } from '../adapters/mock-adapter'
import { useBlockDensity } from '@/lib/chat/msg/density-context'

// Module-level sentinel atoms for conditional hook reads (Rules of Hooks)
const EMPTY_CHIPS = Atom.make<ReadonlyArray<MockCommandChip>>([])
const EMPTY_DRAFT = Atom.make<string>('')

// =============================================================================
// Composer View
// =============================================================================

export function ComposerView() {
  const { spec, adapter, surfaceId } = useMorphChatContext()
  // Read directly from adapter atoms — no intermediary family
  const streaming = useAtomValue(adapter.streaming$)
  const isStreaming = streaming.isStreaming
  const connection = useAtomValue(adapter.connection$)
  // Machine connection state — for diagnostics
  const machineConnection = useAtomValue(connectionStateFamily(surfaceId))
  // Gate on ADAPTER connection state (source of truth), not machine state (which may lag)
  const isConnected = connection.phase === 'connected' || connection.phase === 'idle'

  // All composers call adapter.send via the same handler
  // Composer passes { value, mode, thinkingLevel, contextChips }
  const handleSubmit = React.useCallback(
    (params: { value: string; mode?: string; thinkingLevel?: number; contextChips?: unknown[] }) => {
      if (!isConnected) {
        console.warn('[ComposerView] Submit blocked — not connected (machine state:', machineConnection, ')')
        return
      }
      Effect.runSync(
        adapter.send({
          content: params.value,
          thinkingLevel: params.thinkingLevel as number | undefined,
        }),
      )
    },
    [adapter, isConnected, machineConnection],
  )

  const handleCancel = React.useCallback(() => {
    Effect.runSync(adapter.cancel())
  }, [adapter])

  // ── Transfer drop zone ───────────────────────────────────
  const composerDropRef = React.useRef<HTMLDivElement>(null)
  const [droppedRefs, setDroppedRefs] = React.useState<ReadonlyArray<{ id: string; label: string }>>([])

  const evaluate = React.useCallback(
    (token: TransferToken): TransferResult => {
      // Accept task and task-cluster kinds as inline-chip references
      if (token.ref._tag === 'TaskRef' || token.ref._tag === 'ClusterRef') {
        return {
          _tag: 'TransferAccept' as const,
          targetId: adapter.adapterId,
          insertMode: 'inline-chip' as const,
        }
      }
      return {
        _tag: 'TransferReject' as const,
        targetId: adapter.adapterId,
        reason: `Unknown ref type: ${(token.ref as any)._tag}`,
      }
    },
    [adapter.adapterId],
  )

  const onAccept = React.useCallback(
    (tokens: ReadonlyArray<TransferToken>) => {
      const newRefs = tokens.map((t) => ({
        id: t.ref._tag === 'TaskRef' ? t.ref.taskId : t.ref._tag === 'ClusterRef' ? t.ref.clusterId : t.tokenId,
        label: t.ref.label,
      }))
      setDroppedRefs((prev) => [...prev, ...newRefs])
    },
    [],
  )

  // Only activate drop zone when spec says so
  const dropEnabled = spec.enableTransferDrop ?? false
  const { isOver, canAccept } = useTransferDroppable({
    dropRef: dropEnabled ? composerDropRef : { current: null },
    insertMode: 'inline-chip',
    evaluate,
    onAccept,
  })

  // Drop zone visual indicator class
  const dropIndicatorClass = dropEnabled && isOver
    ? canAccept
      ? 'ring-1 ring-cyan-500/50 bg-cyan-500/5'
      : 'ring-1 ring-red-500/30 bg-red-500/5'
    : ''

  const density = useBlockDensity()

  switch (spec.composer) {
    // ── Full: multiline, toolbar, thinking, chips, send/pause, suggestions ──
    case 'full': {
      // ── Pill density: minimal send-only ──
      if (density === 'pill') {
        return (
          <div ref={composerDropRef} className={cn(dropIndicatorClass, 'transition-all')}>
            <Composer onSubmit={handleSubmit} isStreaming={isStreaming}>
              <div className="flex items-center gap-2 px-2 py-1">
                <div className="flex-1">
                  <Composer.TextArea placeholder="Message..." />
                </div>
                <Composer.SendButton />
              </div>
            </Composer>
          </div>
        )
      }

      // ── Compact density: single-line with collapsed toolbar ──
      if (density === 'compact') {
        return (
          <div ref={composerDropRef} className={cn(dropIndicatorClass, 'transition-all')}>
            <Composer onSubmit={handleSubmit} isStreaming={isStreaming}>
              {spec.contextChips !== 'hidden' && (
                <Composer.ContextChips />
              )}
              <Composer.TextArea placeholder="Message..." />
              <Composer.Toolbar>
                <Composer.ToolbarGroup>
                  <Composer.ModeToggle />
                  <Composer.ThinkingLevel />
                </Composer.ToolbarGroup>
                <Composer.ToolbarGroup>
                  <TransportGroup
                    isStreaming={isStreaming}
                    onCancel={handleCancel}
                    onReconnect={() => (adapter as Partial<MockChatAdapter>).toggleConnection?.()}
                  />
                  <Composer.SendButton />
                </Composer.ToolbarGroup>
              </Composer.Toolbar>
            </Composer>
          </div>
        )
      }

      // ── Full density: complete toolbar ──
      return (
        <div ref={composerDropRef} className={cn(dropIndicatorClass, 'transition-all')}>
          <Composer onSubmit={handleSubmit} isStreaming={isStreaming}>
            {spec.contextChips !== 'hidden' && (
              <Composer.ContextChips />
            )}
            {/* Dropped task references rendered as chips */}
            {droppedRefs.length > 0 && (
              <DroppedRefChips refs={droppedRefs} onRemove={(id) =>
                setDroppedRefs((prev) => prev.filter((r) => r.id !== id))
              } />
            )}
            {/* Command suggestions popup above input */}
            <CommandSuggestions adapter={adapter} />
            <Composer.TextArea placeholder="Message..." />
            {/* Character counter */}
            <CharacterCounter maxChars={(adapter as Partial<MockChatAdapter>).surfaceConfig?.maxChars} />
            <Composer.Toolbar>
              <Composer.ToolbarGroup>
                <Composer.ModeToggle />
                <Composer.Divider />
                <Composer.ThinkingLevel />
                <Composer.Divider />
                {/* Insert buttons: /cmd, @entity, mic */}
                <Composer.ActionButton
                  icon={<Command size={14} />}
                  title="Insert command"
                  onClick={() => (adapter as Partial<MockChatAdapter>).setDraft?.('/')}
                />
                <Composer.ActionButton
                  icon={<AtSign size={14} />}
                  title="Mention entity"
                  onClick={() => (adapter as Partial<MockChatAdapter>).setDraft?.('@')}
                />
                <Composer.ActionButton
                  icon={<Mic size={14} />}
                  title="Voice input"
                />
              </Composer.ToolbarGroup>
              <Composer.ToolbarGroup>
                <Composer.ActionButton
                  icon={<Paperclip size={14} />}
                  title="Attach"
                />
                {/* Transport group: reconnect / pause / send */}
                <TransportGroup
                  isStreaming={isStreaming}
                  onCancel={handleCancel}
                  onReconnect={() => (adapter as Partial<MockChatAdapter>).toggleConnection?.()}
                />
                <Composer.SendButton />
              </Composer.ToolbarGroup>
            </Composer.Toolbar>
          </Composer>
        </div>
      )
    }

    // ── Single-line: compact input, enter-to-send ──
    case 'single-line':
      return (
        <div ref={composerDropRef} className={cn(dropIndicatorClass, 'transition-all')}>
          <Composer onSubmit={handleSubmit} isStreaming={isStreaming}>
            {spec.contextChips !== 'hidden' && (
              <Composer.ContextChips />
            )}
            {droppedRefs.length > 0 && (
              <DroppedRefChips refs={droppedRefs} onRemove={(id) =>
                setDroppedRefs((prev) => prev.filter((r) => r.id !== id))
              } />
            )}
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1">
                <Composer.TextArea placeholder="Type a message..." />
              </div>
              <Composer.SendButton />
            </div>
          </Composer>
        </div>
      )

    // ── Command: slash-command input, autocomplete ──
    case 'command':
      return (
        <div ref={composerDropRef} className={cn(dropIndicatorClass, 'transition-all')}>
          <Composer onSubmit={handleSubmit} isStreaming={isStreaming}>
            {spec.contextChips !== 'hidden' && (
              <Composer.ContextChips />
            )}
            {droppedRefs.length > 0 && (
              <DroppedRefChips refs={droppedRefs} onRemove={(id) =>
                setDroppedRefs((prev) => prev.filter((r) => r.id !== id))
              } />
            )}
            <div className="flex items-center gap-2 px-3 py-2">
              <span
                className="text-cyan-500 font-mono shrink-0"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                /
              </span>
              <div className="flex-1">
                <Composer.TextArea placeholder="command..." />
              </div>
              <Composer.SendButton />
            </div>
          </Composer>
        </div>
      )

    // ── Structured: form-like fields ──
    case 'structured':
      return (
        <div ref={composerDropRef} className={cn(dropIndicatorClass, 'transition-all')}>
          <Composer onSubmit={handleSubmit} isStreaming={isStreaming}>
            <div className="px-3 py-2 space-y-2">
              <Composer.TextArea placeholder="Structured input..." />
              <div className="flex justify-end">
                <Composer.SendButton />
              </div>
            </div>
          </Composer>
        </div>
      )

    // ── None: spec says no composer ──
    case 'none':
      return null

    default:
      return null
  }
}

ComposerView.displayName = 'MorphChat.ComposerView'

// =============================================================================
// Character Counter — shows current / max chars
// =============================================================================

function CharacterCounter({ maxChars = 4096 }: { maxChars?: number }) {
  // We read the composer value from context if available, else return null
  // This must be rendered inside <Composer> to access context
  try {
    const { value } = useComposer()
    const len = value.length
    const isNearLimit = len > maxChars * 0.9
    const isOverLimit = len > maxChars

    if (len === 0) return null

    return (
      <div
        className={cn(
          'text-right px-3 py-0.5 font-mono transition-colors duration-150',
          isOverLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-neutral-600',
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        aria-live="polite"
      >
        {len.toLocaleString()} / {maxChars.toLocaleString()}
      </div>
    )
  } catch {
    return null
  }
}

// =============================================================================
// Transport Group — Reconnect + Pause buttons alongside Send
// =============================================================================

function TransportGroup({
  isStreaming,
  onCancel,
  onReconnect,
}: {
  isStreaming: boolean
  onCancel: () => void
  onReconnect: () => void
}) {
  return (
    <>
      {/* Reconnect — always visible, toggles connection */}
      <Composer.ActionButton
        icon={<RotateCcw size={14} />}
        title="Toggle connection"
        onClick={onReconnect}
      />
      {/* Pause/Cancel — only during streaming */}
      <AnimatePresence>
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          >
            <Composer.ActionButton
              icon={<Pause size={14} />}
              title="Cancel generation"
              onClick={onCancel}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// =============================================================================
// Command Suggestions — popup above input showing matching /commands
// =============================================================================

function CommandSuggestions({
  adapter,
}: {
  adapter: { send: any } & Partial<MockChatAdapter>
}) {
  // Module-level sentinels ensure useAtomValue is ALWAYS called (Rules of Hooks)
  const chips = useAtomValue(adapter.commandChips$ ?? EMPTY_CHIPS)
  const draft = useAtomValue(adapter.draft$ ?? EMPTY_DRAFT)

  // Only show when draft starts with /
  const isCommandMode = draft.startsWith('/')
  const query = draft.slice(1).toLowerCase()

  const matchedChips = React.useMemo(() => {
    if (!isCommandMode || !chips.length) return []
    if (query.length === 0) return chips.slice(0, 5)
    return chips.filter(
      (c) =>
        c.label.toLowerCase().includes(query) ||
        c.command.toLowerCase().includes(query),
    ).slice(0, 5)
  }, [isCommandMode, query, chips])

  if (!isCommandMode || matchedChips.length === 0) return null

  return (
    <div
      data-slot="morphchat-command-suggestions"
      className="px-3 py-1.5 border-b border-neutral-800/30"
    >
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          className="flex flex-wrap gap-1"
        >
          {matchedChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => adapter.setDraft?.(chip.command + ' ')}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded',
                'font-mono border border-neutral-800 text-neutral-400',
                'hover:border-cyan-800/50 hover:text-cyan-400',
                'transition-all duration-150 active:scale-[0.97]',
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <span className="text-cyan-600">/</span>
              <span>{chip.label}</span>
              {chip.description && (
                <span className="text-neutral-700 ml-1">— {chip.description}</span>
              )}
            </button>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// =============================================================================
// Dropped reference chips — rendered when tasks are dropped onto composer
// =============================================================================

function DroppedRefChips({
  refs,
  onRemove,
}: {
  refs: ReadonlyArray<{ id: string; label: string }>
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 px-3 py-1">
      {refs.map((r) => (
        <span
          key={r.id}
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded',
            'bg-cyan-500/10 text-cyan-400 border border-cyan-800/30',
            'font-mono',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          <span>@{r.label}</span>
          <button
            onClick={() => onRemove(r.id)}
            className="text-cyan-600 hover:text-cyan-300 transition-colors"
            title="Remove reference"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}
