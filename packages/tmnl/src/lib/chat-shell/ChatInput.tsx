/**
 * ChatInput Compound Component
 *
 * A composable chat input bar with mode toggle (Terminal/AI), context chips,
 * and extensible toolbar. Extracted from BlockTerminalTestbed patterns.
 *
 * Uses compound component pattern with React Context for implicit state sharing.
 *
 * @example
 * ```tsx
 * <ChatInput onSubmit={handleSubmit} thinkingLevels={CUSTOM_LEVELS}>
 *   <ChatInput.ContextChips />
 *   <ChatInput.TextArea placeholder="Type a message..." />
 *   <ChatInput.Toolbar>
 *     <ChatInput.ModeToggle />
 *     <ChatInput.ThinkingLevel />
 *     <ChatInput.SendButton />
 *   </ChatInput.Toolbar>
 * </ChatInput>
 * ```
 *
 * @module chat-shell/ChatInput
 */

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  forwardRef,
  type ReactNode,
  type RefObject,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { Send, Brain, Slash, AtSign, Paperclip, X, Hash } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion, type Easing } from 'motion/react'
import { cn } from '@/lib/utils'
import { useScrambleText } from '@/lib/animation/text-effects'

// =============================================================================
// Types
// =============================================================================

export type ChatMode = 'terminal' | 'ai'
export type ThinkingLevel = 'none' | 'low' | 'medium' | 'high'

export interface ContextChip {
  id: string
  label: string
  type: 'hashtag' | 'context' | 'pending'
  enabled?: boolean
}

export interface ChatInputSubmitParams {
  value: string
  mode: ChatMode
  thinkingLevel: ThinkingLevel
  contextChips: ContextChip[]
}

// =============================================================================
// Animation Presets - Parameterized Intensity Variants
// =============================================================================

/**
 * Single shadow layer for depth control
 */
export interface ShadowLayer {
  /** Base color (rgb format recommended for opacity control) */
  color: string
  /** Layer opacity (0-1) */
  opacity: number
  /** Blur radius in pixels */
  blur: number
  /** Horizontal offset in pixels */
  offsetX?: number
  /** Vertical offset in pixels */
  offsetY?: number
}

/**
 * Animation preset for thinking level interactions.
 * Each level has progressively more intense animations.
 */
export interface ThinkingAnimationPreset {
  /** Scale values for press/release animation */
  scale: {
    /** How small the icon gets on press (e.g., 0.92) */
    pressed: number
    /** Optional overshoot on release (e.g., 1.05) */
    overshoot?: number
    /** Final resting scale (typically 1.0) */
    final: number
  }
  /** Layered drop-shadow effect on icon SVG */
  shadow: {
    /** Multiple layers for depth (applied via CSS filter: drop-shadow) */
    layers: ShadowLayer[]
  }
  /** Animation timing in milliseconds */
  duration: {
    /** Duration of press animation */
    press: number
    /** Duration of release animation */
    release: number
  }
  /** Optional radial pulse effect */
  pulse?: {
    /** How large the pulse ring grows */
    scale: number
    /** Starting opacity of pulse ring */
    opacity: number
    /** Pulse animation duration */
    duration: number
    /** Pulse color */
    color: string
  }
  /** Motion easing function (named or bezier array) */
  easing: Easing
}

/**
 * Thinking level option with animation preset
 */
export interface ThinkingLevelOption {
  id: ThinkingLevel
  name: string
  tokens: string
  animation: ThinkingAnimationPreset
}

/**
 * Default thinking level options with incrementally intense animations.
 *
 * Intensity progression:
 * - none:   No animation (instant feedback)
 * - low:    Subtle depress, faint glow
 * - medium: Moderate depress with overshoot, visible glow, small pulse
 * - high:   Deep depress with bounce, intense glow, large pulse
 */
export const DEFAULT_THINKING_LEVELS: ThinkingLevelOption[] = [
  {
    id: 'none',
    name: 'Off',
    tokens: '0',
    animation: {
      scale: { pressed: 0.98, final: 1 },
      shadow: { layers: [] },
      duration: { press: 50, release: 100 },
      easing: 'easeOut',
    },
  },
  {
    id: 'low',
    name: 'Low',
    tokens: '~5k',
    animation: {
      scale: { pressed: 0.92, final: 1 },
      shadow: {
        layers: [
          { color: '255, 255, 255', opacity: 0.4, blur: 6 },
          { color: '255, 255, 255', opacity: 0.2, blur: 12 },
        ],
      },
      duration: { press: 80, release: 150 },
      easing: [0.4, 0, 0.2, 1],
    },
  },
  {
    id: 'medium',
    name: 'Medium',
    tokens: '~20k',
    animation: {
      scale: { pressed: 0.88, overshoot: 1.04, final: 1 },
      shadow: {
        layers: [
          { color: '255, 255, 255', opacity: 0.5, blur: 4 },
          { color: '255, 255, 255', opacity: 0.35, blur: 10 },
          { color: '255, 255, 255', opacity: 0.2, blur: 20 },
        ],
      },
      duration: { press: 80, release: 250 },
      pulse: { scale: 1.8, opacity: 0.4, duration: 300, color: '255, 255, 255' },
      easing: [0.34, 1.56, 0.64, 1],
    },
  },
  {
    id: 'high',
    name: 'High',
    tokens: '~50k',
    animation: {
      scale: { pressed: 0.82, overshoot: 1.08, final: 1 },
      shadow: {
        layers: [
          { color: '255, 255, 255', opacity: 0.6, blur: 3 },
          { color: '255, 255, 255', opacity: 0.45, blur: 8 },
          { color: '255, 255, 255', opacity: 0.3, blur: 16 },
          { color: '255, 255, 255', opacity: 0.15, blur: 28 },
        ],
      },
      duration: { press: 80, release: 350 },
      pulse: { scale: 2.2, opacity: 0.6, duration: 400, color: '255, 255, 255' },
      easing: [0.34, 1.8, 0.64, 1],
    },
  },
]

// =============================================================================
// Context
// =============================================================================

interface ChatInputContextValue {
  // State
  value: string
  mode: ChatMode
  thinkingLevel: ThinkingLevel
  isSubmitting: boolean
  contextChips: ContextChip[]
  thinkingLevels: ThinkingLevelOption[]

  // Actions
  setValue: (value: string) => void
  setMode: (mode: ChatMode) => void
  setThinkingLevel: (level: ThinkingLevel) => void
  submit: () => void
  addContextChip: (chip: Omit<ContextChip, 'id'>) => void
  removeContextChip: (id: string) => void
  toggleContextChip: (id: string) => void

  // Refs
  inputRef: RefObject<HTMLTextAreaElement | null>
}

const ChatInputContext = createContext<ChatInputContextValue | null>(null)

function useChatInput() {
  const ctx = useContext(ChatInputContext)
  if (!ctx) {
    throw new Error('ChatInput compound components must be used within <ChatInput>')
  }
  return ctx
}

// =============================================================================
// Root Component
// =============================================================================

export interface ChatInputProps {
  children: ReactNode
  /** Called when user submits input */
  onSubmit: (params: ChatInputSubmitParams) => void | Promise<void>
  /** Initial mode */
  defaultMode?: ChatMode
  /** Initial thinking level */
  defaultThinkingLevel?: ThinkingLevel
  /** Custom thinking level options with animation presets */
  thinkingLevels?: ThinkingLevelOption[]
  /** Additional class name */
  className?: string
}

const ChatInputRoot = forwardRef<HTMLDivElement, ChatInputProps>(
  (
    {
      children,
      onSubmit,
      defaultMode = 'ai',
      defaultThinkingLevel = 'none',
      thinkingLevels = DEFAULT_THINKING_LEVELS,
      className,
    },
    ref
  ) => {
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const [value, setValue] = useState('')
    const [mode, setMode] = useState<ChatMode>(defaultMode)
    const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(defaultThinkingLevel)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [contextChips, setContextChips] = useState<ContextChip[]>([])

    const submit = useCallback(async () => {
      if (!value.trim() || isSubmitting) return

      setIsSubmitting(true)
      try {
        await Promise.resolve(
          onSubmit({
            value: value.trim(),
            mode,
            thinkingLevel: mode === 'ai' ? thinkingLevel : 'none',
            contextChips: contextChips.filter((c) => c.enabled !== false),
          })
        )
        setValue('')
      } finally {
        setIsSubmitting(false)
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    }, [value, mode, thinkingLevel, contextChips, isSubmitting, onSubmit])

    const addContextChip = useCallback((chip: Omit<ContextChip, 'id'>) => {
      const id = `chip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setContextChips((prev) => [...prev, { ...chip, id, enabled: true }])
    }, [])

    const removeContextChip = useCallback((id: string) => {
      setContextChips((prev) => prev.filter((c) => c.id !== id))
    }, [])

    const toggleContextChip = useCallback((id: string) => {
      setContextChips((prev) =>
        prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
      )
    }, [])

    const contextValue: ChatInputContextValue = {
      value,
      mode,
      thinkingLevel,
      isSubmitting,
      contextChips,
      thinkingLevels,
      setValue,
      setMode,
      setThinkingLevel,
      submit,
      addContextChip,
      removeContextChip,
      toggleContextChip,
      inputRef,
    }

    return (
      <ChatInputContext.Provider value={contextValue}>
        <div
          ref={ref}
          className={cn(
            'relative rounded-xl border transition-colors',
            'bg-black/30 backdrop-blur-md',
            'border-white/10 hover:border-white/20',
            className
          )}
        >
          {children}
        </div>
      </ChatInputContext.Provider>
    )
  }
)

ChatInputRoot.displayName = 'ChatInput'

// =============================================================================
// ContextChips Subcomponent
// =============================================================================

interface ContextChipsProps {
  className?: string
}

function ContextChips({ className }: ContextChipsProps) {
  const { contextChips, removeContextChip, toggleContextChip } = useChatInput()

  if (contextChips.length === 0) return null

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 border-b border-white/10 flex-wrap',
        className
      )}
    >
      {contextChips.map((chip) => (
        <div
          key={chip.id}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-md',
            'font-mono transition-all',
            chip.type === 'hashtag'
              ? chip.enabled
                ? 'text-yellow-300 bg-yellow-500/10 border border-yellow-500/30'
                : 'text-white/50 bg-white/5 border border-white/10'
              : chip.type === 'pending'
                ? 'text-white/40 bg-white/5 border border-dashed border-white/20'
                : 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/30'
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          <button
            onClick={() => toggleContextChip(chip.id)}
            className="flex items-center gap-1 bg-transparent border-none cursor-pointer"
          >
            {chip.type === 'hashtag' && <Hash size={10} className="opacity-70" />}
            <span className="max-w-[100px] truncate">{chip.label}</span>
          </button>
          <button
            onClick={() => removeContextChip(chip.id)}
            className="flex items-center justify-center p-0.5 bg-transparent border-none cursor-pointer opacity-60 hover:opacity-100"
          >
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// TextArea Subcomponent
// =============================================================================

interface TextAreaProps {
  placeholder?: string
  minHeight?: number
  maxHeight?: number
  className?: string
}

function TextArea({
  placeholder = 'Type a message...',
  minHeight = 48,
  maxHeight = 200,
  className,
}: TextAreaProps) {
  const { value, setValue, submit, isSubmitting, inputRef } = useChatInput()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Merge refs
  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      ;(textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
      ;(inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
    },
    [inputRef]
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)

      // Auto-resize
      const textarea = e.target
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`
    },
    [setValue, minHeight, maxHeight]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    },
    [submit]
  )

  return (
    <div className={cn('px-3 py-2', className)}>
      <textarea
        ref={setRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isSubmitting}
        className={cn(
          'w-full resize-none bg-transparent border-none outline-none',
          'text-white placeholder:text-white/40',
          'font-mono',
          isSubmitting && 'opacity-50'
        )}
        style={{
          fontSize: 'var(--tmnl-text-sm, 14px)',
          minHeight,
          maxHeight,
        }}
        rows={1}
      />
    </div>
  )
}

// =============================================================================
// Toolbar Subcomponent
// =============================================================================

interface ToolbarProps {
  children: ReactNode
  className?: string
}

function Toolbar({ children, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-2 py-1.5 border-t border-white/10 min-h-[36px]',
        className
      )}
    >
      {children}
    </div>
  )
}

// =============================================================================
// ToolbarGroup Subcomponent
// =============================================================================

interface ToolbarGroupProps {
  children: ReactNode
  className?: string
}

function ToolbarGroup({ children, className }: ToolbarGroupProps) {
  return <div className={cn('flex items-center gap-1.5', className)}>{children}</div>
}

// =============================================================================
// ModeToggle Subcomponent
// =============================================================================

interface ModeToggleProps {
  className?: string
}

function ModeToggle({ className }: ModeToggleProps) {
  const { mode, setMode } = useChatInput()

  return (
    <div
      className={cn(
        'flex items-center rounded-md overflow-hidden',
        'border border-white/20',
        className
      )}
    >
      <button
        onClick={() => setMode('terminal')}
        className={cn(
          'px-2 py-1 font-mono border-none cursor-pointer transition-all',
          mode === 'terminal'
            ? 'bg-white/20 text-white'
            : 'bg-transparent text-white/50 hover:text-white/70'
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        title="Terminal mode"
      >
        &gt;_
      </button>
      <button
        onClick={() => setMode('ai')}
        className={cn(
          'px-2 py-1 font-semibold border-none cursor-pointer transition-all',
          mode === 'ai'
            ? 'bg-white/20 text-white'
            : 'bg-transparent text-white/50 hover:text-white/70'
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        title="AI mode"
      >
        AI
      </button>
    </div>
  )
}

// =============================================================================
// Divider Subcomponent
// =============================================================================

function Divider() {
  return <div className="w-px h-4 bg-white/20" />
}

// =============================================================================
// ThinkingLevel Subcomponent - Enhanced with Motion Animations
// =============================================================================

interface ThinkingLevelProps {
  className?: string
}

/**
 * Generate CSS filter string from shadow layers
 */
function buildDropShadowFilter(layers: ShadowLayer[]): string {
  if (layers.length === 0) return 'none'
  return layers
    .map((l) => {
      const x = l.offsetX ?? 0
      const y = l.offsetY ?? 0
      return `drop-shadow(${x}px ${y}px ${l.blur}px rgba(${l.color}, ${l.opacity}))`
    })
    .join(' ')
}

function ThinkingLevelButton({ className }: ThinkingLevelProps) {
  const { mode, thinkingLevel, setThinkingLevel, thinkingLevels } = useChatInput()
  const [showPicker, setShowPicker] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const [showPulse, setShowPulse] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  // Find current level's animation preset
  const currentOption = thinkingLevels.find((l) => l.id === thinkingLevel) ?? thinkingLevels[0]
  const nextOption = (() => {
    const idx = thinkingLevels.findIndex((l) => l.id === thinkingLevel)
    return thinkingLevels[(idx + 1) % thinkingLevels.length]
  })()

  const isActive = thinkingLevel !== 'none'

  // useScrambleText handles text animation automatically when text prop changes
  // Uses 'cyber' preset with TMNL defaults, respects prefers-reduced-motion
  const { ref: scrambleRef } = useScrambleText({
    text: isActive ? currentOption.name : '',
    preset: 'cyber',
    playOnMount: false, // Don't animate on first mount
  })

  if (mode !== 'ai') return null

  const handleClick = () => {
    console.log('[ThinkingLevel] handleClick:', { thinkingLevel, nextOption: nextOption.id, prefersReducedMotion })

    // Skip all animations if reduced motion preferred
    if (prefersReducedMotion) {
      setThinkingLevel(nextOption.id)
      return
    }

    // Trigger press animation (only when currently active - label exists)
    if (thinkingLevel !== 'none') {
      setIsPressed(true)
      if (nextOption.animation.pulse) {
        setShowPulse(true)
      }
    }

    // Just update the level - useScramble handles text animation automatically
    console.log('[ThinkingLevel] setting level:', nextOption.id)
    setThinkingLevel(nextOption.id)
  }

  // Callback when press animation completes - resets to release state
  const handleAnimationComplete = (definition: string) => {
    if (definition === 'pressed' || isPressed) {
      setIsPressed(false)
    }
  }

  // Callback when pulse animation completes
  const handlePulseComplete = () => {
    setShowPulse(false)
  }

  // Current level's animation (for persistent shadow when active)
  const currentAnim = currentOption.animation
  // Next level's animation (for press/transition effects)
  const nextAnim = nextOption.animation

  // Effective durations (0 if reduced motion preferred)
  const effectiveDuration = prefersReducedMotion
    ? { press: 0, release: 0 }
    : { press: nextAnim.duration.press, release: nextAnim.duration.release }

  // Shadow intensity maps to CURRENT active level (persistent)
  // On press, briefly show NEXT level's shadow as preview
  const currentShadowFilter = isActive
    ? buildDropShadowFilter(currentAnim.shadow.layers)
    : 'none'
  const iconShadowFilter = isPressed
    ? buildDropShadowFilter(nextAnim.shadow.layers)
    : currentShadowFilter

  // Pulse uses next level's color and opacity
  const pulseColor = nextAnim.pulse?.color ?? '255, 255, 255'
  const pulseOpacity = nextAnim.pulse?.opacity ?? 0.4

  // Scale animation sequence
  const scaleValue = (() => {
    if (isPressed) {
      return nextAnim.scale.pressed
    }
    // On release, animate through overshoot if defined
    if (nextAnim.scale.overshoot) {
      return [nextAnim.scale.overshoot, nextAnim.scale.final]
    }
    return nextAnim.scale.final
  })()

  return (
    <div className={cn('relative flex items-center', className)}>
      {/* Visually hidden description for screen readers */}
      <span id="thinking-level-description" className="sr-only">
        {`Current thinking level: ${currentOption.name}. Token usage: ${currentOption.tokens}`}
      </span>

      {/* Radial pulse ring */}
      <AnimatePresence>
        {showPulse && nextAnim.pulse && (
          <motion.div
            initial={{ scale: 0.8, opacity: pulseOpacity }}
            animate={{ scale: nextAnim.pulse.scale, opacity: 0 }}
            exit={{ opacity: 0 }}
            onAnimationComplete={handlePulseComplete}
            transition={{
              duration: (nextAnim.pulse.duration ?? 300) / 1000,
              ease: 'easeOut',
            }}
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, rgba(${pulseColor}, ${pulseOpacity}) 0%, transparent 70%)`,
              transformOrigin: 'center',
            }}
          />
        )}
      </AnimatePresence>

      {/* Unified hitbox: icon + text */}
      <motion.button
        role="button"
        aria-label={`Thinking level: ${currentOption.name}`}
        aria-pressed={isActive}
        aria-describedby="thinking-level-description"
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault()
          setShowPicker((v) => !v)
        }}
        animate={{
          scale: scaleValue,
        }}
        onAnimationComplete={handleAnimationComplete}
        transition={{
          scale: {
            duration: isPressed
              ? effectiveDuration.press / 1000
              : effectiveDuration.release / 1000,
            ease: isPressed ? 'easeIn' : nextAnim.easing,
          },
        }}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md',
          'border-none cursor-pointer transition-colors',
          isActive
            ? 'text-magenta-400 bg-magenta-500/10'
            : 'text-white/50 bg-transparent hover:text-white/70'
        )}
        title={`Thinking: ${currentOption.name} (click to cycle, right-click for picker)`}
      >
        {/* Icon with isolated drop-shadow layers */}
        <motion.span
          animate={{ filter: iconShadowFilter }}
          transition={{
            filter: {
              duration: isPressed
                ? effectiveDuration.press / 1000
                : effectiveDuration.release / 1000,
              ease: isPressed ? 'easeIn' : 'easeOut',
            },
          }}
          className="flex items-center justify-center"
        >
          <Brain size={14} />
        </motion.span>
        {isActive && (
          <motion.span
            ref={scrambleRef}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            className="font-mono text-magenta-400"
            style={{ fontSize: '10px' }}
          />
        )}
      </motion.button>

      {/* Picker dropdown */}
      <AnimatePresence>
        {showPicker && (
          <>
            <div
              className="fixed inset-0 z-[999998]"
              onClick={() => setShowPicker(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={cn(
                'absolute bottom-full left-0 mb-2 z-[999999] w-48 p-1.5 rounded-lg',
                'bg-black/90 backdrop-blur-md',
                'border border-white/20 shadow-xl'
              )}
            >
              <div
                className="px-2 py-1.5 text-white/50 font-mono uppercase tracking-wider"
                style={{ fontSize: '10px' }}
              >
                Extended Thinking
              </div>
              {thinkingLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => {
                    setThinkingLevel(level.id)
                    setShowPicker(false)
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-1.5 rounded-md',
                    'border-none cursor-pointer transition-all',
                    thinkingLevel === level.id
                      ? 'bg-magenta-500/20 text-magenta-300'
                      : 'bg-transparent text-white/70 hover:bg-white/10'
                  )}
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  <span className="font-medium">{level.name}</span>
                  <span className="text-white/40 font-mono">{level.tokens}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// =============================================================================
// ActionButton Subcomponent
// =============================================================================

interface ActionButtonProps {
  icon: ReactNode
  title: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  className?: string
}

function ActionButton({
  icon,
  title,
  onClick,
  active,
  disabled,
  className,
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center w-6 h-6 rounded-md',
        'border-none cursor-pointer transition-all',
        active
          ? 'text-cyan-400 bg-cyan-500/10'
          : 'text-white/50 bg-transparent hover:text-white/70',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      title={title}
    >
      {icon}
    </button>
  )
}

// =============================================================================
// SendButton Subcomponent
// =============================================================================

interface SendButtonProps {
  className?: string
}

function SendButton({ className }: SendButtonProps) {
  const { value, isSubmitting, submit } = useChatInput()
  const hasInput = value.trim().length > 0

  return (
    <button
      onClick={submit}
      disabled={!hasInput || isSubmitting}
      className={cn(
        'flex items-center justify-center w-9 h-9 rounded-lg',
        'border-none cursor-pointer transition-all',
        hasInput && !isSubmitting
          ? 'bg-cyan-500 text-black hover:bg-cyan-400'
          : 'bg-white/10 text-white/30 cursor-not-allowed',
        className
      )}
      title={isSubmitting ? 'Sending...' : 'Send'}
    >
      <Send size={16} />
    </button>
  )
}

// =============================================================================
// Compound Export
// =============================================================================

export const ChatInput = Object.assign(ChatInputRoot, {
  ContextChips,
  TextArea,
  Toolbar,
  ToolbarGroup,
  ModeToggle,
  Divider,
  ThinkingLevel: ThinkingLevelButton,
  ActionButton,
  SendButton,
})

// Re-export icons for convenience
export { Slash, AtSign, Paperclip } from 'lucide-react'
