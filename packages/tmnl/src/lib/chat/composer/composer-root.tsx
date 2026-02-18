/**
 * ComposerRoot
 *
 * Outer shell of the compound Composer component.
 * Provides context, manages state, applies TMNL surface styling.
 */

import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { CHAT_TOKENS } from '../tokens'
import { ComposerContext, type ComposerContextValue } from './composer-context'
import {
  DEFAULT_THINKING_LEVELS,
  type ChatMode,
  type ThinkingLevel,
  type ContextChip,
  type ComposerSubmitParams,
  type ThinkingLevelOption,
} from './types'

export interface ComposerProps {
  children: ReactNode
  /** Called when user submits input */
  onSubmit: (params: ComposerSubmitParams) => void | Promise<void>
  /** Initial mode */
  defaultMode?: ChatMode
  /** Initial thinking level */
  defaultThinkingLevel?: ThinkingLevel
  /** Custom thinking level options with animation presets */
  thinkingLevels?: ThinkingLevelOption[]
  /** Additional class name */
  className?: string
}

export const ComposerRoot = forwardRef<HTMLDivElement, ComposerProps>(
  (
    {
      children,
      onSubmit,
      defaultMode = 'ai',
      defaultThinkingLevel = 'none',
      thinkingLevels = DEFAULT_THINKING_LEVELS,
      className,
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const [value, setValue] = useState('')
    const [mode, setMode] = useState<ChatMode>(defaultMode)
    const [thinkingLevel, setThinkingLevel] =
      useState<ThinkingLevel>(defaultThinkingLevel)
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
          }),
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
        prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)),
      )
    }, [])

    const contextValue: ComposerContextValue = {
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

    const t = CHAT_TOKENS.composer

    return (
      <ComposerContext.Provider value={contextValue}>
        <div
          ref={ref}
          data-slot="tmnl-composer"
          className={cn(
            'relative',
            t.bg,
            t.backdrop,
            t.radius,
            'border',
            t.border,
            t.borderHover,
            t.borderFocus,
            'transition-colors duration-200',
            className,
          )}
        >
          {children}
        </div>
      </ComposerContext.Provider>
    )
  },
)

ComposerRoot.displayName = 'Composer'
