/**
 * BlockInput Component
 *
 * Terminal/AI input bar for the block-based terminal.
 * Ported from infinitty's WarpInput with TMNL patterns.
 *
 * Features:
 * - Mode toggle (Terminal/AI)
 * - Natural language detection with auto-mode switching
 * - CLI command detection
 * - Context chips support
 * - Resizable input area
 */

import { memo, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAtom, useAtomValue } from '@effect-atom/atom-react'
import { Atom } from '@effect-atom/atom-react'
import { Effect, pipe } from 'effect'
import {
  Terminal,
  Sparkles,
  Send,
  Brain,
  Hash,
  X,
  Lightbulb,
  Slash,
  AtSign,
  Paperclip,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ThinkingLevel } from '../../schemas'
import { TerminalInput, type TerminalInputRef } from '../../v3/components/TerminalInput'

// =============================================================================
// Types
// =============================================================================

export interface ContextBlock {
  id: string
  label: string
  type: string
}

interface CustomContextChip {
  id: string
  tag: string
  enabled: boolean
}

// Removed: InputSize - TipTap handles auto-resize
type OverlayType = 'thinking' | 'slash' | 'mentions' | null

// =============================================================================
// External Event Triggers
// =============================================================================

/** Event for opening the thinking level picker from outside */
export const OPEN_THINKING_PICKER_EVENT = 'tmnl-open-thinking-picker'

/** Event for opening the slash commands picker from outside */
export const OPEN_SLASH_PICKER_EVENT = 'tmnl-open-slash-picker'

/** Event for opening the mentions picker from outside */
export const OPEN_MENTIONS_PICKER_EVENT = 'tmnl-open-mentions-picker'

/** Trigger the thinking level picker to open */
export function triggerOpenThinkingPicker(): void {
  window.dispatchEvent(new CustomEvent(OPEN_THINKING_PICKER_EVENT))
}

/** Trigger the slash commands picker to open */
export function triggerOpenSlashPicker(): void {
  window.dispatchEvent(new CustomEvent(OPEN_SLASH_PICKER_EVENT))
}

/** Trigger the mentions picker to open */
export function triggerOpenMentionsPicker(): void {
  window.dispatchEvent(new CustomEvent(OPEN_MENTIONS_PICKER_EVENT))
}

// =============================================================================
// Props Interface
// =============================================================================

export interface BlockInputProps {
  /**
   * Submit handler for commands
   * @param command - The command/query text
   * @param isAI - Whether to send to AI or terminal
   * @param thinkingLevel - Extended thinking level (AI mode only)
   * @param contextBlocks - Context blocks to include with AI query
   */
  onSubmit: (
    command: string,
    isAI: boolean,
    thinkingLevel?: ThinkingLevel,
    contextBlocks?: ContextBlock[]
  ) => void | Promise<void>

  /**
   * Called when input receives focus
   */
  onInputFocus?: () => void

  /**
   * Confirmed context blocks
   */
  confirmedContextBlocks?: ContextBlock[]

  /**
   * Remove a confirmed context block
   */
  onRemoveConfirmedContext?: (blockId: string) => void

  /**
   * Pending context block (ghost chip)
   */
  pendingContextBlock?: ContextBlock | null

  /**
   * Clear pending context
   */
  onClearPendingContext?: () => void

  /**
   * Confirm pending context
   */
  onConfirmContext?: () => void

  /**
   * Optional class name
   */
  className?: string
}

// =============================================================================
// Module-level atoms (stable references)
// =============================================================================

// Input state atoms
const inputValueAtom = Atom.make('')
const isSubmittingAtom = Atom.make(false)
const submitErrorAtom = Atom.make<string | null>(null)
const isAIModeAtom = Atom.make(true)
const thinkingLevelAtom = Atom.make<ThinkingLevel>('none')
// Removed: inputSizeAtom - TipTap handles auto-resize
const customChipsAtom = Atom.make<CustomContextChip[]>([])
const overlayAtom = Atom.make<OverlayType>(null)

// Derived: input trimmed check
const hasInputAtom = Atom.make((get) => get(inputValueAtom).trim().length > 0)

// =============================================================================
// Effect-based Operations
// =============================================================================

/** Open an overlay */
const openOverlay = (type: OverlayType): Effect.Effect<void> =>
  Effect.sync(() => Atom.set(overlayAtom, type))

/** Close the current overlay */
const closeOverlay: Effect.Effect<void> = Effect.sync(() =>
  Atom.set(overlayAtom, null)
)

/** Toggle an overlay */
const toggleOverlay = (type: Exclude<OverlayType, null>): Effect.Effect<void> =>
  Effect.sync(() => {
    const current = Atom.get(overlayAtom)
    Atom.set(overlayAtom, current === type ? null : type)
  })

/** Set thinking level */
const setThinkingLevelOp = (level: ThinkingLevel): Effect.Effect<void> =>
  Effect.sync(() => Atom.set(thinkingLevelAtom, level))

/** Cycle thinking level */
const cycleThinkingLevelOp: Effect.Effect<ThinkingLevel> = Effect.sync(() => {
  const current = Atom.get(thinkingLevelAtom)
  const levels: ThinkingLevel[] = ['none', 'low', 'medium', 'high']
  const idx = levels.indexOf(current)
  const next = levels[(idx + 1) % levels.length]
  Atom.set(thinkingLevelAtom, next)
  return next
})

/** Toggle AI mode */
const toggleAIModeOp: Effect.Effect<boolean> = Effect.sync(() => {
  const current = Atom.get(isAIModeAtom)
  const next = !current
  Atom.set(isAIModeAtom, next)
  return next
})

/** Set AI mode */
const setAIModeOp = (isAI: boolean): Effect.Effect<void> =>
  Effect.sync(() => Atom.set(isAIModeAtom, isAI))

// Removed: cycleInputSizeOp - TipTap handles auto-resize

/** Subscribe to external events - returns cleanup Effect */
const subscribeExternalEvents: Effect.Effect<() => void> = Effect.sync(() => {
  const handleThinking = () => Effect.runSync(openOverlay('thinking'))
  const handleSlash = () => Effect.runSync(openOverlay('slash'))
  const handleMentions = () => Effect.runSync(openOverlay('mentions'))

  window.addEventListener(OPEN_THINKING_PICKER_EVENT, handleThinking)
  window.addEventListener(OPEN_SLASH_PICKER_EVENT, handleSlash)
  window.addEventListener(OPEN_MENTIONS_PICKER_EVENT, handleMentions)

  return () => {
    window.removeEventListener(OPEN_THINKING_PICKER_EVENT, handleThinking)
    window.removeEventListener(OPEN_SLASH_PICKER_EVENT, handleSlash)
    window.removeEventListener(OPEN_MENTIONS_PICKER_EVENT, handleMentions)
  }
})

// =============================================================================
// Removed: INPUT_SIZES - TipTap handles auto-resize with min/max height props
// =============================================================================

// =============================================================================
// Detection Utilities
// =============================================================================

/**
 * Detect if input looks like natural language (question/instruction)
 */
function detectNaturalLanguage(input: string): {
  isNaturalLanguage: boolean
  confidence: number
} {
  if (!input.trim()) {
    return { isNaturalLanguage: false, confidence: 0 }
  }

  const trimmed = input.trim().toLowerCase()

  // Question words
  const questionWords = [
    'what',
    'how',
    'why',
    'when',
    'where',
    'who',
    'which',
    'can',
    'could',
    'would',
    'should',
    'is',
    'are',
    'do',
    'does',
    'will',
    'help',
    'explain',
    'describe',
    'show',
    'tell',
    'find',
    'search',
    'create',
    'make',
    'write',
    'generate',
  ]

  // Check if starts with question word
  const startsWithQuestion = questionWords.some(
    (word) => trimmed.startsWith(word + ' ') || trimmed.startsWith(word + ',')
  )

  // Check if ends with question mark
  const endsWithQuestion = trimmed.endsWith('?')

  // Check word count (natural language tends to be longer)
  const wordCount = trimmed.split(/\s+/).length

  // Calculate confidence
  let confidence = 0
  if (startsWithQuestion) confidence += 0.4
  if (endsWithQuestion) confidence += 0.4
  if (wordCount > 5) confidence += 0.2
  if (wordCount > 10) confidence += 0.1

  return {
    isNaturalLanguage: confidence >= 0.4,
    confidence: Math.min(confidence, 1),
  }
}

/**
 * Detect if input looks like a CLI command
 */
function detectCLICommand(input: string): {
  isCLICommand: boolean
  forceTerminal: boolean
  forceAI: boolean
  cleanedInput: string
  confidence: number
} {
  const trimmed = input.trim()

  // Check for force prefixes
  if (trimmed.startsWith('!')) {
    return {
      isCLICommand: true,
      forceTerminal: true,
      forceAI: false,
      cleanedInput: trimmed.slice(1).trim(),
      confidence: 1,
    }
  }

  if (trimmed.startsWith('?')) {
    return {
      isCLICommand: false,
      forceTerminal: false,
      forceAI: true,
      cleanedInput: trimmed.slice(1).trim(),
      confidence: 1,
    }
  }

  // Common CLI commands
  const cliPatterns = [
    /^(ls|cd|pwd|cat|grep|find|rm|cp|mv|mkdir|touch|echo|chmod|chown)\b/,
    /^(git|npm|yarn|bun|pnpm|cargo|docker|kubectl|terraform)\b/,
    /^(python|node|deno|ruby|go|rust|java)\b/,
    /^(curl|wget|ssh|scp|rsync)\b/,
    /^(sudo|su|apt|brew|yum|pacman)\b/,
    /^\.\//,
    /^\/\w/,
  ]

  const lowerTrimmed = trimmed.toLowerCase()
  const matchesCLI = cliPatterns.some((pattern) => pattern.test(lowerTrimmed))

  return {
    isCLICommand: matchesCLI,
    forceTerminal: false,
    forceAI: false,
    cleanedInput: trimmed,
    confidence: matchesCLI ? 0.8 : 0,
  }
}

/**
 * Extract hashtags from input
 */
function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g
  const matches: string[] = []
  let match
  while ((match = hashtagRegex.exec(text)) !== null) {
    matches.push(match[1])
  }
  return matches
}

// =============================================================================
// Thinking Level Selector
// =============================================================================

const THINKING_LEVELS: {
  id: ThinkingLevel
  name: string
  tokens: string
}[] = [
  { id: 'none', name: 'Off', tokens: '0' },
  { id: 'low', name: 'Low', tokens: '~5k' },
  { id: 'medium', name: 'Medium', tokens: '~20k' },
  { id: 'high', name: 'High', tokens: '~50k' },
]

// =============================================================================
// BlockInput Component
// =============================================================================

export const BlockInput = memo(function BlockInput({
  onSubmit,
  onInputFocus,
  confirmedContextBlocks = [],
  onRemoveConfirmedContext,
  pendingContextBlock,
  onClearPendingContext,
  onConfirmContext,
  className,
}: BlockInputProps) {
  const inputRef = useRef<TerminalInputRef>(null)
  const thinkingBtnRef = useRef<HTMLButtonElement>(null)
  const slashBtnRef = useRef<HTMLButtonElement>(null)
  const mentionsBtnRef = useRef<HTMLButtonElement>(null)

  // Atom state (Atom-as-State doctrine)
  const [input, setInput] = useAtom(inputValueAtom)
  const [isSubmitting, setIsSubmitting] = useAtom(isSubmittingAtom)
  const [submitError, setSubmitError] = useAtom(submitErrorAtom)
  const isAIMode = useAtomValue(isAIModeAtom)
  const thinkingLevel = useAtomValue(thinkingLevelAtom)
  // Removed: inputSize - TipTap handles auto-resize
  const [customChips, setCustomChips] = useAtom(customChipsAtom)
  const hasInput = useAtomValue(hasInputAtom)
  const overlay = useAtomValue(overlayAtom)

  // Subscribe to external trigger events via Effect
  useEffect(() => {
    const cleanup = Effect.runSync(subscribeExternalEvents)
    return cleanup
  }, [])

  // Close overlay on Escape - Effect-based
  useEffect(() => {
    if (!overlay) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') Effect.runSync(closeOverlay)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [overlay])

  // Detection memos
  const nlDetection = useMemo(() => detectNaturalLanguage(input), [input])
  const cliDetection = useMemo(() => detectCLICommand(input), [input])

  const showNLHint =
    !isAIMode && nlDetection.isNaturalLanguage && nlDetection.confidence >= 0.6

  // Auto-switch modes based on detection - Effect-based
  useEffect(() => {
    if (cliDetection.forceTerminal && isAIMode) {
      Effect.runSync(setAIModeOp(false))
    } else if (cliDetection.forceAI && !isAIMode) {
      Effect.runSync(setAIModeOp(true))
    } else if (
      cliDetection.isCLICommand &&
      isAIMode &&
      cliDetection.confidence >= 0.7 &&
      !cliDetection.forceAI
    ) {
      Effect.runSync(setAIModeOp(false))
    }
  }, [
    cliDetection.forceTerminal,
    cliDetection.forceAI,
    cliDetection.isCLICommand,
    cliDetection.confidence,
    isAIMode,
  ])

  // Custom context chip management
  const addCustomContextChip = useCallback(
    (tag: string) => {
      const normalizedTag = tag.toLowerCase().replace(/^#/, '')
      if (!normalizedTag) return
      if (customChips.some((c) => c.tag === normalizedTag)) return
      setCustomChips((prev) => [
        ...prev,
        {
          id: `custom-${Date.now()}-${normalizedTag}`,
          tag: normalizedTag,
          enabled: true,
        },
      ])
    },
    [customChips, setCustomChips]
  )

  const toggleCustomChip = useCallback(
    (id: string) => {
      setCustomChips((prev) =>
        prev.map((chip) =>
          chip.id === id ? { ...chip, enabled: !chip.enabled } : chip
        )
      )
    },
    [setCustomChips]
  )

  const removeCustomChip = useCallback(
    (id: string) => {
      setCustomChips((prev) => prev.filter((chip) => chip.id !== id))
    },
    [setCustomChips]
  )

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return

    setSubmitError(null)

    // Extract and add hashtags as chips
    const hashtags = extractHashtags(input)
    hashtags.forEach((tag) => addCustomContextChip(tag))

    // Clean input
    const finalInput = cliDetection.cleanedInput
      ? cliDetection.cleanedInput.replace(/#\w+/g, '').trim()
      : input.replace(/#\w+/g, '').trim()

    if (!finalInput) {
      setInput('')
      return
    }

    const finalIsAI =
      cliDetection.forceAI || (!cliDetection.forceTerminal && isAIMode)
    const finalThinkingLevel = finalIsAI ? thinkingLevel : undefined
    // Include confirmed context blocks when sending to AI
    const contextBlocks =
      finalIsAI && confirmedContextBlocks.length > 0
        ? confirmedContextBlocks
        : undefined

    try {
      setIsSubmitting(true)
      await Promise.resolve(
        onSubmit(finalInput, finalIsAI, finalThinkingLevel, contextBlocks)
      )
      setInput('')
    } catch (error) {
      const message =
        error instanceof Error ? error.message || 'Unknown error' : 'Unknown error'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [
    input,
    cliDetection.cleanedInput,
    cliDetection.forceAI,
    cliDetection.forceTerminal,
    isAIMode,
    thinkingLevel,
    confirmedContextBlocks,
    onSubmit,
    setInput,
    setSubmitError,
    setIsSubmitting,
    addCustomContextChip,
  ])

  // Keyboard handler for additional keys (TerminalInput handles Enter internally)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Tab to switch to AI mode when natural language is detected
      if (event.key === 'Tab' && showNLHint) {
        event.preventDefault()
        Effect.runSync(setAIModeOp(true))
      }
      // Escape to clear pending context or close overlay
      if (event.key === 'Escape') {
        if (pendingContextBlock) {
          event.preventDefault()
          onClearPendingContext?.()
        }
      }
    },
    [showNLHint, pendingContextBlock, onClearPendingContext]
  )

  // Input change handler
  const handleInputChange = useCallback(
    (nextValue: string) => {
      setInput(nextValue)
      if (submitError) setSubmitError(null)
      if (pendingContextBlock && nextValue !== input) {
        onClearPendingContext?.()
      }
    },
    [input, setInput, submitError, setSubmitError, pendingContextBlock, onClearPendingContext]
  )

  // Cycle thinking level - Effect-based
  const handleCycleThinkingLevel = useCallback(() => {
    Effect.runSync(cycleThinkingLevelOp)
  }, [])

  return (
    <div className={cn('relative p-3', className)}>
      {/* Main input container */}
      <div
        className={cn(
          'rounded-xl border transition-colors',
          'bg-black/30 backdrop-blur-md',
          'border-white/10 hover:border-white/20'
        )}
      >
        {/* Top toolbar row - context chips */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
          {/* Custom context chips (hashtag-based) */}
          {customChips.map((chip) => (
            <div
              key={chip.id}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-md',
                'font-mono transition-all',
                chip.enabled
                  ? 'text-yellow-300 bg-yellow-500/10 border border-yellow-500/30'
                  : 'text-white/50 bg-white/5 border border-white/10'
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <button
                onClick={() => toggleCustomChip(chip.id)}
                className="flex items-center gap-1 bg-transparent border-none cursor-pointer"
                title={chip.enabled ? 'Click to disable' : 'Click to enable'}
              >
                <Hash size={10} className="opacity-70" />
                <span>{chip.tag}</span>
              </button>
              <button
                onClick={() => removeCustomChip(chip.id)}
                className="flex items-center justify-center p-0.5 bg-transparent border-none cursor-pointer opacity-60 hover:opacity-100"
                title="Remove"
              >
                <X size={10} />
              </button>
            </div>
          ))}

          {/* Confirmed context chips */}
          {confirmedContextBlocks.map((block) => (
            <div
              key={block.id}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-md max-w-[150px]',
                'font-mono',
                block.type === 'ai-response'
                  ? 'text-magenta-300 bg-magenta-500/10 border border-magenta-500/30'
                  : block.type === 'command'
                    ? 'text-blue-300 bg-blue-500/10 border border-blue-500/30'
                    : 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/30'
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                {block.label}
              </span>
              <button
                onClick={() => onRemoveConfirmedContext?.(block.id)}
                className="flex items-center justify-center p-0.5 bg-transparent border-none cursor-pointer opacity-60 hover:opacity-100"
              >
                <X size={10} />
              </button>
            </div>
          ))}

          {/* Pending (ghost) context chip */}
          {pendingContextBlock &&
            !confirmedContextBlocks.some((b) => b.id === pendingContextBlock.id) && (
              <button
                onClick={onConfirmContext}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-md max-w-[150px]',
                  'font-mono cursor-pointer transition-all',
                  'text-white/40 bg-white/5 border border-dashed border-white/20',
                  'hover:text-white hover:bg-white/10 hover:border-solid'
                )}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                title="Click to lock as context"
              >
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {pendingContextBlock.label}
                </span>
                <span className="opacity-50 text-[10px] flex-shrink-0">+</span>
              </button>
            )}

          {/* Spacer */}
          <div className="flex-1" />
        </div>

        {/* Main input area */}
        <div className="relative px-3 py-2">
          <TerminalInput
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            onFocus={onInputFocus}
            placeholder="Type a command or ask a question..."
            disabled={isSubmitting}
            isSubmitting={isSubmitting}
            minHeight={48}
            maxHeight={200}
            className="bg-transparent"
          />

          {/* Submission error */}
          {submitError && (
            <div
              className={cn(
                'flex items-start justify-between gap-2 mt-2 p-2 rounded-lg',
                'border border-red-500/30 bg-red-500/10 text-red-400'
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold mb-0.5">Request failed</div>
                <div className="opacity-80 break-words">{submitError}</div>
              </div>
              <button
                onClick={() => setSubmitError(null)}
                title="Dismiss"
                className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded bg-transparent border-none cursor-pointer text-red-400 opacity-80 hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Natural language detection hint */}
          {showNLHint && (
            <div
              className={cn(
                'flex items-center gap-2 mt-2 px-3 py-2 rounded-md',
                'bg-yellow-500/10 text-yellow-300'
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <Lightbulb size={14} />
              <span>
                This looks like a question. Press{' '}
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono">
                  Tab
                </kbd>{' '}
                to send to AI instead.
              </span>
            </div>
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-2 py-1.5 border-t border-white/10 min-h-[36px]">
          <div className="flex items-center gap-1.5">
            {/* Terminal / AI Mode Toggle */}
            <div
              className={cn(
                'flex items-center rounded-md overflow-hidden',
                'border border-white/20'
              )}
            >
              <button
                onClick={() => Effect.runSync(setAIModeOp(false))}
                className={cn(
                  'px-2 py-1 font-mono border-none cursor-pointer transition-all',
                  !isAIMode
                    ? 'bg-white/20 text-white'
                    : 'bg-transparent text-white/50 hover:text-white/70'
                )}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                title="Terminal mode"
              >
                &gt;_
              </button>
              <button
                onClick={() => Effect.runSync(setAIModeOp(true))}
                className={cn(
                  'px-2 py-1 font-semibold border-none cursor-pointer transition-all',
                  isAIMode
                    ? 'bg-white/20 text-white'
                    : 'bg-transparent text-white/50 hover:text-white/70'
                )}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                title="AI mode"
              >
                AI
              </button>
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-white/20" />

            {/* Action buttons */}
            <div className="flex items-center gap-0.5">
              {/* Slash commands */}
              <button
                ref={slashBtnRef}
                onClick={() => Effect.runSync(toggleOverlay('slash'))}
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-md',
                  'border-none cursor-pointer transition-all',
                  overlay === 'slash'
                    ? 'text-cyan-400 bg-cyan-500/10'
                    : 'text-white/50 bg-transparent hover:text-white/70'
                )}
                title="Slash commands"
              >
                <Slash size={13} />
              </button>

              {/* Mentions */}
              <button
                ref={mentionsBtnRef}
                onClick={() => Effect.runSync(toggleOverlay('mentions'))}
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-md',
                  'border-none cursor-pointer transition-all',
                  overlay === 'mentions'
                    ? 'text-cyan-400 bg-cyan-500/10'
                    : 'text-white/50 bg-transparent hover:text-white/70'
                )}
                title="Mentions"
              >
                <AtSign size={13} />
              </button>

              {/* Attach files */}
              <button
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-md',
                  'border-none cursor-pointer transition-all',
                  'text-white/50 bg-transparent hover:text-white/70'
                )}
                title="Attach files (coming soon)"
              >
                <Paperclip size={13} />
              </button>
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-white/20" />

            {/* Thinking level (only in AI mode) */}
            {isAIMode && (
              <button
                ref={thinkingBtnRef}
                onClick={() => Effect.runSync(toggleOverlay('thinking'))}
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-md',
                  'border-none cursor-pointer transition-all',
                  thinkingLevel !== 'none'
                    ? 'text-magenta-400 bg-magenta-500/10 border border-magenta-500/30'
                    : overlay === 'thinking'
                      ? 'text-magenta-400 bg-magenta-500/10'
                      : 'text-white/50 bg-transparent hover:text-white/70'
                )}
                title={`Thinking: ${thinkingLevel === 'none' ? 'Off' : thinkingLevel}`}
              >
                <Brain size={14} />
              </button>
            )}

            {/* Thinking level label */}
            {isAIMode && thinkingLevel !== 'none' && (
              <span
                className="px-2 py-0.5 rounded bg-magenta-500/10 text-magenta-400 font-mono"
                style={{ fontSize: '10px' }}
              >
                {THINKING_LEVELS.find((l) => l.id === thinkingLevel)?.name}
              </span>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={() => void handleSubmit()}
            disabled={!hasInput || isSubmitting}
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-lg',
              'border-none cursor-pointer transition-all',
              hasInput && !isSubmitting
                ? 'bg-cyan-500 text-black hover:bg-cyan-400'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            )}
            title={isSubmitting ? 'Sending…' : 'Send'}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Portal-rendered overlays */}
      {overlay === 'thinking' &&
        createPortal(
          <ThinkingPicker
            selectedLevel={thinkingLevel}
            onSelectLevel={(level) => {
              Effect.runSync(setThinkingLevelOp(level))
              Effect.runSync(closeOverlay)
            }}
            onClose={() => Effect.runSync(closeOverlay)}
            anchorRef={thinkingBtnRef}
          />,
          document.body
        )}

      {overlay === 'slash' &&
        createPortal(
          <PlaceholderPicker
            title="Slash Commands"
            message="Coming soon..."
            onClose={() => Effect.runSync(closeOverlay)}
            anchorRef={slashBtnRef}
          />,
          document.body
        )}

      {overlay === 'mentions' &&
        createPortal(
          <PlaceholderPicker
            title="Mentions"
            message="Coming soon..."
            onClose={() => Effect.runSync(closeOverlay)}
            anchorRef={mentionsBtnRef}
          />,
          document.body
        )}
    </div>
  )
})

// =============================================================================
// ThinkingPicker Component
// =============================================================================

interface ThinkingPickerProps {
  selectedLevel: ThinkingLevel
  onSelectLevel: (level: ThinkingLevel) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

function ThinkingPicker({
  selectedLevel,
  onSelectLevel,
  onClose,
  anchorRef,
}: ThinkingPickerProps) {
  const rect = anchorRef.current?.getBoundingClientRect()
  const bottom = rect ? window.innerHeight - rect.top + 8 : 0
  const left = rect?.left ?? 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[999998]"
        onClick={onClose}
      />
      {/* Picker */}
      <div
        className={cn(
          'fixed z-[999999] w-48 p-1.5 rounded-lg',
          'bg-black/90 backdrop-blur-md',
          'border border-white/20 shadow-xl'
        )}
        style={{ bottom, left }}
      >
        <div
          className="px-2 py-1.5 text-white/50 font-mono uppercase tracking-wider"
          style={{ fontSize: '10px' }}
        >
          Extended Thinking
        </div>
        {THINKING_LEVELS.map((level) => (
          <button
            key={level.id}
            onClick={() => onSelectLevel(level.id)}
            className={cn(
              'w-full flex items-center justify-between px-2 py-1.5 rounded-md',
              'border-none cursor-pointer transition-all',
              selectedLevel === level.id
                ? 'bg-magenta-500/20 text-magenta-300'
                : 'bg-transparent text-white/70 hover:bg-white/10'
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <span className="font-medium">{level.name}</span>
            <span className="text-white/40 font-mono">{level.tokens}</span>
          </button>
        ))}
      </div>
    </>
  )
}

// =============================================================================
// PlaceholderPicker Component
// =============================================================================

interface PlaceholderPickerProps {
  title: string
  message: string
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

function PlaceholderPicker({
  title,
  message,
  onClose,
  anchorRef,
}: PlaceholderPickerProps) {
  const rect = anchorRef.current?.getBoundingClientRect()
  const bottom = rect ? window.innerHeight - rect.top + 8 : 0
  const left = rect?.left ?? 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[999998]"
        onClick={onClose}
      />
      {/* Picker */}
      <div
        className={cn(
          'fixed z-[999999] w-48 p-3 rounded-lg',
          'bg-black/90 backdrop-blur-md',
          'border border-white/20 shadow-xl'
        )}
        style={{ bottom, left }}
      >
        <div
          className="text-white/50 font-mono uppercase tracking-wider mb-2"
          style={{ fontSize: '10px' }}
        >
          {title}
        </div>
        <div
          className="text-white/40 text-center py-4"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {message}
        </div>
      </div>
    </>
  )
}

export default BlockInput
