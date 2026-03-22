/**
 * Composer.TextArea
 *
 * Auto-resizing textarea with TMNL typography.
 * Dark theme, subtle focus, monospace font.
 */

import {
  useCallback,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { cn } from '@/lib/utils'
import { CHAT_TOKENS, COMPOSER_SIZING } from '../tokens'
import { useComposer } from './composer-context'

export interface ComposerTextAreaProps {
  placeholder?: string
  className?: string
}

export function ComposerTextArea({
  placeholder = 'Type a message...',
  className,
}: ComposerTextAreaProps) {
  const { value, setValue, submit, isSubmitting, inputRef, widthTier } = useComposer()
  const sizing = COMPOSER_SIZING[widthTier]
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const setRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      ;(textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
      ;(inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
    },
    [inputRef],
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)
      const textarea = e.target
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, sizing.minH), sizing.maxH)}px`
    },
    [setValue, sizing.minH, sizing.maxH],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    },
    [submit],
  )

  const t = CHAT_TOKENS.input

  return (
    <div className={cn(sizing.textarea, className)}>
      <textarea
        ref={setRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isSubmitting}
        className={cn(
          'w-full resize-none border-none outline-none',
          t.bg,
          t.text,
          t.placeholder,
          t.font,
          isSubmitting && 'opacity-50',
        )}
        style={{
          fontSize: 'var(--tmnl-text-sm, 12px)',
          minHeight: sizing.minH,
          maxHeight: sizing.maxH,
        }}
        rows={1}
      />
    </div>
  )
}

ComposerTextArea.displayName = 'Composer.TextArea'
