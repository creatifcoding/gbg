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

import { useCallback, useMemo, useRef, useState } from 'react'
import { Loader2, Mic, Paperclip, RotateCcw, Square, Trash2 } from 'lucide-react'
import type { StreamPhase } from '../schemas/message-types'
import { Effect } from 'effect'
import { useAtomValue } from '@effect-atom/atom-react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import type { MorphChatAdapter } from '../schemas/adapter-types'
import { connectionStateFamily } from '../machines/surface-stx'
import { Composer, useComposer, type OverflowAction } from '@/lib/chat/composer'
import { COMPOSER_INLINE_ACTIONS, COMPOSER_SIZING, type ChatWidthTier, type ComposerActionId } from '@/lib/chat/tokens'
import { useTransferDroppable } from '@/lib/transfer/v2/hooks'
import type { TransferToken, TransferResult } from '@/lib/transfer/v2/schemas'
import { Atom } from '@effect-atom/atom'

import { useBlockDensity } from '@/lib/chat/msg/density-context'
import { deriveThinkingLevels, reconcileThinkingLevel } from '@/lib/chat/composer/thinking-levels'
import type { ModelOption } from '@/lib/chat/shell/header-band'

// Module-level sentinel atoms for conditional hook reads (Rules of Hooks)
const EMPTY_MODELS_TYPED = Atom.make<ReadonlyArray<ModelOption>>([])
const EMPTY_MODEL_ID = Atom.make<string | null>(null)

// =============================================================================
// Composer View
// =============================================================================

export function ComposerView({ widthTier = 'full' }: { widthTier?: ChatWidthTier } = {}) {
  const { spec, adapter, surfaceId } = useMorphChatContext()
  // Read directly from adapter atoms — no intermediary family
  const streaming = useAtomValue(adapter.streaming$)
  const isStreaming = streaming.phase !== 'idle' && streaming.phase !== 'error-recovery'
  // Machine connection state — for diagnostics only (kept subscribed so diagnostics remain visible)
  useAtomValue(connectionStateFamily(surfaceId))

  // ── Model-aware thinking levels ────────────────────────
  // Derive available thinking levels from the selected model's provider
  // and reasoning capability. When model doesn't support reasoning,
  // levels are null and the ThinkingLevel button hides itself.
  const modelsAtom = adapter.availableModels$ ?? EMPTY_MODELS_TYPED
  const selectedModelAtom = adapter.selectedModel$ ?? EMPTY_MODEL_ID
  const availableModels = useAtomValue(modelsAtom) as ReadonlyArray<ModelOption>
  const selectedModelId = useAtomValue(selectedModelAtom)
  const selectedModel = useMemo(
    () => availableModels.find((m) => m.id === selectedModelId) ?? null,
    [availableModels, selectedModelId],
  )
  const modelThinkingLevels = useMemo(
    () => deriveThinkingLevels(selectedModel?.provider, selectedModel?.reasoning),
    [selectedModel?.provider, selectedModel?.reasoning],
  )

  // All composers call adapter.send via the same handler.
  // Connectivity/autorecovery is handled in the adapter layer (sendOp auto-heal),
  // so UI should never hard-block submission solely on current connection phase.
  const handleSubmit = useCallback(
    (params: { value: string; mode?: string; thinkingLevel?: unknown; contextChips?: unknown[] }) => {
      Effect.runSync(
        adapter.send({
          content: params.value,
          thinkingLevel: params.thinkingLevel,
        }),
      )
    },
    [adapter],
  )

  const handleCancel = useCallback(() => {
    Effect.runSync(adapter.cancel())
  }, [adapter])

  // ── Transfer drop zone ───────────────────────────────────
  const composerDropRef = useRef<HTMLDivElement>(null)
  const [droppedRefs, setDroppedRefs] = useState<ReadonlyArray<{ id: string; label: string }>>([])

  const evaluate = useCallback(
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
        reason: `Unknown ref type: ${'_tag' in token.ref ? token.ref._tag : 'unknown'}`,
      }
    },
    [adapter.adapterId],
  )

  const onAccept = useCallback(
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

  // ── Density/tier resolution: density overrides, tier drives layout ──
  const effectiveTier: ChatWidthTier = density === 'compact'
    ? (widthTier === 'full' ? 'squeeze' : widthTier)
    : widthTier

  // ── Shared composer props (model-derived + tier) ──────
  const composerModelProps = useMemo(() => ({
    widthTier: effectiveTier,
    ...(modelThinkingLevels ? { thinkingLevels: modelThinkingLevels } : {}),
    // When model doesn't support reasoning, force 'none'
    ...(modelThinkingLevels === null ? { defaultThinkingLevel: 'none' as const } : {}),
  }), [modelThinkingLevels, effectiveTier])

  switch (spec.composer) {
    // ── Full: multiline, toolbar, thinking, chips, send/pause, suggestions ──
    case 'full': {
      // ── Pill density: minimal send-only ──
      if (density === 'pill') {
        return (
          <div ref={composerDropRef} className={cn(dropIndicatorClass, 'transition-all')}>
            <Composer onSubmit={handleSubmit} isStreaming={isStreaming} {...composerModelProps}>
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
            <Composer onSubmit={handleSubmit} isStreaming={isStreaming} {...composerModelProps}>
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
                    adapter={adapter}
                    isStreaming={isStreaming}
                    streamPhase={streaming.phase}
                    onCancel={handleCancel}
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
          <Composer onSubmit={handleSubmit} isStreaming={isStreaming} {...composerModelProps}>
            {spec.contextChips !== 'hidden' && (
              <Composer.ContextChips />
            )}
            {/* Dropped task references rendered as chips */}
            {droppedRefs.length > 0 && (
              <DroppedRefChips refs={droppedRefs} onRemove={(id) =>
                setDroppedRefs((prev) => prev.filter((r) => r.id !== id))
              } />
            )}
            {/* Inline terminal — visible when mode === 'terminal' */}
            <Composer.TerminalSlot />
            <div className="relative">
              <Composer.TextArea placeholder="Message..." />
              <CharacterCounter />
            </div>
            <TierAwareToolbar
              adapter={adapter}
              isStreaming={isStreaming}
              streaming={streaming}
              onCancel={handleCancel}
            />
          </Composer>
        </div>
      )
    }

    // ── Single-line: compact input, enter-to-send ──
    case 'single-line': {
      const slPad = effectiveTier === 'compact' ? 'gap-1 px-2 py-1' : effectiveTier === 'squeeze' ? 'gap-1.5 px-2 py-1.5' : 'gap-2 px-3 py-2'
      return (
        <div ref={composerDropRef} className={cn(dropIndicatorClass, 'transition-all')}>
          <Composer onSubmit={handleSubmit} isStreaming={isStreaming} {...composerModelProps}>
            {spec.contextChips !== 'hidden' && (
              <Composer.ContextChips />
            )}
            {droppedRefs.length > 0 && (
              <DroppedRefChips refs={droppedRefs} onRemove={(id) =>
                setDroppedRefs((prev) => prev.filter((r) => r.id !== id))
              } />
            )}
            <div className={cn('flex items-center', slPad)}>
              <div className="flex-1">
                <Composer.TextArea placeholder="Type a message..." />
              </div>
              <Composer.SendButton />
            </div>
          </Composer>
        </div>
      )
    }

    // ── Command: slash-command input, autocomplete ──
    case 'command': {
      const cmdPad = effectiveTier === 'compact' ? 'gap-1 px-2 py-1' : effectiveTier === 'squeeze' ? 'gap-1.5 px-2 py-1.5' : 'gap-2 px-3 py-2'
      return (
        <div ref={composerDropRef} className={cn(dropIndicatorClass, 'transition-all')}>
          <Composer onSubmit={handleSubmit} isStreaming={isStreaming} {...composerModelProps}>
            {spec.contextChips !== 'hidden' && (
              <Composer.ContextChips />
            )}
            {droppedRefs.length > 0 && (
              <DroppedRefChips refs={droppedRefs} onRemove={(id) =>
                setDroppedRefs((prev) => prev.filter((r) => r.id !== id))
              } />
            )}
            <div className={cn('flex items-center', cmdPad)}>
              <span
                className="text-cyan-500 font-mono shrink-0"
                style={{ fontSize: 'var(--tmnl-text-sm, 12px)' }}
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
    }

    // ── Structured: form-like fields ──
    case 'structured':
      return (
        <div ref={composerDropRef} className={cn(dropIndicatorClass, 'transition-all')}>
          <Composer onSubmit={handleSubmit} isStreaming={isStreaming} {...composerModelProps}>
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
// TierAwareToolbar — progressive overflow based on COMPOSER_INLINE_ACTIONS
// =============================================================================

function TierAwareToolbar({
  adapter,
  isStreaming,
  streaming,
  onCancel,
}: {
  adapter: MorphChatAdapter
  isStreaming: boolean
  streaming: { phase: StreamPhase }
  onCancel: () => void
}) {
  const { widthTier } = useComposer()
  const inline = COMPOSER_INLINE_ACTIONS[widthTier]

  const show = (id: ComposerActionId) => inline.has(id)

  const handleReconnect = useCallback(() => {
    Effect.runSync(adapter.reconnect())
  }, [adapter])

  const handleClear = useCallback(() => {
    Effect.runSync(adapter.clear())
  }, [adapter])

  const sz = COMPOSER_SIZING[widthTier]

  // Build overflow items for anything not inline
  const overflowItems = useMemo(() => {
    const items: OverflowAction[] = []
    if (!show('reconnect'))
      items.push({ id: 'reconnect', icon: <RotateCcw size={12} />, label: 'Reconnect', onClick: handleReconnect })
    if (!show('clear'))
      items.push({ id: 'clear', icon: <Trash2 size={12} />, label: 'Clear conversation', onClick: handleClear })
    if (!show('attach'))
      items.push({ id: 'attach', icon: <Paperclip size={12} />, label: 'Attach file', disabled: true })
    if (!show('voice'))
      items.push({ id: 'voice', icon: <Mic size={12} />, label: 'Voice input', disabled: true })
    return items
  }, [widthTier, handleReconnect, handleClear])

  return (
    <Composer.Toolbar>
      <Composer.ToolbarGroup>
        {show('mode-toggle') && <Composer.ModeToggle />}
        {show('thinking') && <Composer.ThinkingLevel />}
      </Composer.ToolbarGroup>
      <Composer.ToolbarGroup>
        {show('attach') && (
          <Composer.ActionButton
            icon={<Paperclip size={sz.actionIcon} />}
            title="Attach file (coming soon)"
            disabled
          />
        )}
        {show('voice') && (
          <Composer.ActionButton
            icon={<Mic size={sz.actionIcon} />}
            title="Voice input (coming soon)"
            disabled
          />
        )}
        {show('clear') && (
          <Composer.ActionButton
            icon={<Trash2 size={sz.actionIcon} />}
            title="Clear conversation"
            onClick={handleClear}
          />
        )}
        {show('reconnect') && (
          <TransportGroup
            adapter={adapter}
            isStreaming={isStreaming}
            streamPhase={streaming.phase}
            onCancel={onCancel}
          />
        )}
        {overflowItems.length > 0 && (
          <Composer.OverflowMenu items={overflowItems} />
        )}
        <Composer.SendButton />
      </Composer.ToolbarGroup>
    </Composer.Toolbar>
  )
}

// =============================================================================
// Character Counter — absolute overlay inside textarea wrapper, no layout shift
// =============================================================================

const CHAR_COUNTER_MAX = 4096

function CharacterCounter({ maxChars = CHAR_COUNTER_MAX }: { maxChars?: number }) {
  const { value } = useComposer()
  const len = value.length
  const isNearLimit = len > maxChars * 0.9
  const isOverLimit = len > maxChars
  const visible = len > 0

  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
          className={cn(
            'absolute bottom-1 right-2 font-mono pointer-events-none select-none',
            isOverLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-neutral-700',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
          aria-live="polite"
        >
          {len.toLocaleString()}/{maxChars.toLocaleString()}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

// =============================================================================
// Transport Group — Reconnect + Pause buttons alongside Send
// =============================================================================

function TransportGroup({
  adapter,
  isStreaming,
  streamPhase,
  onCancel,
}: {
  adapter: MorphChatAdapter
  isStreaming: boolean
  streamPhase: StreamPhase
  onCancel: () => void
}) {
  // Phase-appropriate icon and label
  const phaseIcon = streamPhase === 'waiting'
    ? <Loader2 size={14} className="animate-spin" />
    : streamPhase === 'finalizing'
      ? <Loader2 size={14} className="animate-spin opacity-60" />
      : streamPhase === 'cancelling'
        ? <Loader2 size={14} className="animate-spin text-amber-400" />
        : <Square size={14} />
  const phaseTitle = streamPhase === 'waiting'
    ? 'Thinking…'
    : streamPhase === 'finalizing'
      ? 'Wrapping up…'
      : streamPhase === 'cancelling'
        ? 'Cancelling…'
        : 'Stop generation'

  return (
    <>
      {/* Reconnect — always visible, forces reconnect */}
      <Composer.ActionButton
        icon={<RotateCcw size={14} />}
        title="Reconnect"
        onClick={() => Effect.runSync(adapter.reconnect())}
      />
      {/* Phase-aware cancel/indicator — only during active streaming */}
      <AnimatePresence>
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          >
            <Composer.ActionButton
              icon={phaseIcon}
              title={phaseTitle}
              onClick={onCancel}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
  const { widthTier } = useComposer()
  const sizing = COMPOSER_SIZING[widthTier]
  return (
    <div className={cn('flex flex-wrap', sizing.chipPad)}>
      {refs.map((r) => (
        <span
          key={r.id}
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded',
            'bg-cyan-500/10 text-cyan-400 border border-cyan-800/30',
            'font-mono',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
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
