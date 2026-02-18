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
import { Paperclip } from 'lucide-react'
import { Effect } from 'effect'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import { Composer } from '@/lib/chat/composer'
import { useTransferDroppable } from '@/lib/transfer/v2/hooks'
import type { TransferToken, TransferResult } from '@/lib/transfer/v2/schemas'

// =============================================================================
// Composer View
// =============================================================================

export function ComposerView() {
  const { spec, adapter } = useMorphChatContext()
  // Read directly from adapter atom — no intermediary family
  const streaming = useAtomValue(adapter.streaming$)
  const isStreaming = streaming.isStreaming

  // All composers call adapter.send via the same handler
  // Composer passes { value, mode, thinkingLevel, contextChips }
  const handleSubmit = React.useCallback(
    (params: { value: string; mode?: string; thinkingLevel?: number; contextChips?: unknown[] }) => {
      Effect.runSync(
        adapter.send({
          content: params.value,
          thinkingLevel: params.thinkingLevel as number | undefined,
        }),
      )
    },
    [adapter],
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

  switch (spec.composer) {
    // ── Full: multiline, toolbar, thinking, chips, send/pause ──
    case 'full':
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
            <Composer.TextArea placeholder="Message..." />
            <Composer.Toolbar>
              <Composer.ToolbarGroup>
                <Composer.ModeToggle />
                <Composer.Divider />
                <Composer.ThinkingLevel />
              </Composer.ToolbarGroup>
              <Composer.ToolbarGroup>
                <Composer.ActionButton
                  icon={<Paperclip size={14} />}
                  title="Attach"
                />
                <Composer.SendButton />
              </Composer.ToolbarGroup>
            </Composer.Toolbar>
          </Composer>
        </div>
      )

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
