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
import { useAtom, useAtomValue } from '@effect-atom/atom-react'
import { Atom } from '@effect-atom/atom-react'
import {
  Terminal,
  Sparkles,
  Send,
  Brain,
  Hash,
  X,
  Lightbulb,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ThinkingLevel } from '../../schemas'

// =============================================================================
// Types
// =============================================================================

interface ContextBlock {
  id: string
  label: string
  type: string
}

interface CustomContextChip {
  id: string
  tag: string
  enabled: boolean
}

type InputSize = 'small' | 'medium' | 'large'

export interface BlockInputProps {
  /**
   * Submit handler for commands
   */
  onSubmit: (
    command: string,
    isAI: boolean,
    thinkingLevel?: ThinkingLevel
  ) => void | Promise<void>

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
const inputSizeAtom = Atom.make<InputSize>('small')
const customChipsAtom = Atom.make<CustomContextChip[]>([])

// Derived: input trimmed check
const hasInputAtom = Atom.make((get) => get(inputValueAtom).trim().length > 0)

// =============================================================================
// Input Size Constants
// =============================================================================

const INPUT_SIZES: Record<InputSize, { rows: number; minHeight: string }> = {
  small: { rows: 2, minHeight: '48px' },
  medium: { rows: 5, minHeight: '120px' },
  large: { rows: 10, minHeight: '240px' },
}

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
  confirmedContextBlocks = [],
  onRemoveConfirmedContext,
  pendingContextBlock,
  onClearPendingContext,
  onConfirmContext,
  className,
}: BlockInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Atom state
  const [input, setInput] = useAtom(inputValueAtom)
  const [isSubmitting, setIsSubmitting] = useAtom(isSubmittingAtom)
  const [submitError, setSubmitError] = useAtom(submitErrorAtom)
  const [isAIMode, setIsAIMode] = useAtom(isAIModeAtom)
  const [thinkingLevel, setThinkingLevel] = useAtom(thinkingLevelAtom)
  const [inputSize, setInputSize] = useAtom(inputSizeAtom)
  const [customChips, setCustomChips] = useAtom(customChipsAtom)
  const hasInput = useAtomValue(hasInputAtom)

  // Detection memos
  const nlDetection = useMemo(() => detectNaturalLanguage(input), [input])
  const cliDetection = useMemo(() => detectCLICommand(input), [input])

  const showNLHint =
    !isAIMode && nlDetection.isNaturalLanguage && nlDetection.confidence >= 0.6

  // Auto-switch modes based on detection
  useEffect(() => {
    if (cliDetection.forceTerminal && isAIMode) {
      setIsAIMode(false)
    } else if (cliDetection.forceAI && !isAIMode) {
      setIsAIMode(true)
    } else if (
      cliDetection.isCLICommand &&
      isAIMode &&
      cliDetection.confidence >= 0.7 &&
      !cliDetection.forceAI
    ) {
      setIsAIMode(false)
    }
  }, [
    cliDetection.forceTerminal,
    cliDetection.forceAI,
    cliDetection.isCLICommand,
    cliDetection.confidence,
    isAIMode,
    setIsAIMode,
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

    try {
      setIsSubmitting(true)
      await Promise.resolve(onSubmit(finalInput, finalIsAI, finalThinkingLevel))
      setInput('')
    } catch (error) {
      const message =
        error instanceof Error ? error.message || 'Unknown error' : 'Unknown error'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }

    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [
    input,
    cliDetection.cleanedInput,
    cliDetection.forceAI,
    cliDetection.forceTerminal,
    isAIMode,
    thinkingLevel,
    onSubmit,
    setInput,
    setSubmitError,
    setIsSubmitting,
    addCustomContextChip,
  ])

  // Keyboard handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        void handleSubmit()
      }
      // Tab to switch to AI mode when natural language is detected
      if (event.key === 'Tab' && showNLHint) {
        event.preventDefault()
        setIsAIMode(true)
      }
      // Escape to clear pending context
      if (event.key === 'Escape' && pendingContextBlock) {
        event.preventDefault()
        onClearPendingContext?.()
      }
    },
    [handleSubmit, showNLHint, setIsAIMode, pendingContextBlock, onClearPendingContext]
  )

  // Input change handler
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value
      setInput(nextValue)
      if (submitError) setSubmitError(null)
      if (pendingContextBlock && nextValue !== input) {
        onClearPendingContext?.()
      }
    },
    [input, setInput, submitError, setSubmitError, pendingContextBlock, onClearPendingContext]
  )

  // Auto-resize textarea
  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height =
      Math.min(textareaRef.current.scrollHeight, 140) + 'px'
    textareaRef.current.style.overflowY =
      textareaRef.current.scrollHeight > 140 ? 'auto' : 'hidden'
  }, [input])

  // Cycle input size
  const cycleInputSize = useCallback(() => {
    setInputSize((prev) => {
      if (prev === 'small') return 'medium'
      if (prev === 'medium') return 'large'
      return 'small'
    })
  }, [setInputSize])

  // Cycle thinking level
  const cycleThinkingLevel = useCallback(() => {
    setThinkingLevel((prev) => {
      const levels: ThinkingLevel[] = ['none', 'low', 'medium', 'high']
      const idx = levels.indexOf(prev)
      return levels[(idx + 1) % levels.length]
    })
  }, [setThinkingLevel])

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
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or ask a question..."
            rows={INPUT_SIZES[inputSize].rows}
            className={cn(
              'w-full resize-none bg-transparent',
              'text-white/90 placeholder:text-white/30',
              'border-none outline-none',
              'transition-[min-height] duration-150'
            )}
            style={{
              fontSize: 'var(--tmnl-text-sm, 14px)',
              lineHeight: '1.6',
              minHeight: INPUT_SIZES[inputSize].minHeight,
            }}
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

          {/* Size toggle */}
          <button
            onClick={cycleInputSize}
            title={`Input size: ${inputSize} (click to cycle)`}
            className={cn(
              'absolute bottom-2 right-2 px-2 py-1 rounded',
              'font-mono uppercase tracking-wider',
              'bg-white/5 text-white/40 border-none cursor-pointer',
              'opacity-60 hover:opacity-100 transition-opacity'
            )}
            style={{ fontSize: '10px' }}
          >
            {inputSize === 'small' ? 'S' : inputSize === 'medium' ? 'M' : 'L'}
          </button>

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
                onClick={() => setIsAIMode(false)}
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
                onClick={() => setIsAIMode(true)}
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

            {/* Thinking level (only in AI mode) */}
            {isAIMode && (
              <button
                onClick={cycleThinkingLevel}
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-md',
                  'border-none cursor-pointer transition-all',
                  thinkingLevel !== 'none'
                    ? 'text-magenta-400 bg-magenta-500/10 border border-magenta-500/30'
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
    </div>
  )
})

export default BlockInput
