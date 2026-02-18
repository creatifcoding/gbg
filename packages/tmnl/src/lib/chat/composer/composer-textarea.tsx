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
import { CHAT_TOKENS } from '../tokens'
import { useComposer } from './composer-context'

export interface ComposerTextAreaProps {
  placeholder?: string
  minHeight?: number
  maxHeight?: number
  className?: string
}

export function ComposerTextArea({
  placeholder = 'Type a message...',
  minHeight = 48,
  maxHeight = 200,
  className,
}: ComposerTextAreaProps) {
  const { value, setValue, submit, isSubmitting, inputRef } = useComposer()
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
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`
    },
    [setValue, minHeight, maxHeight],
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
    <div className={cn('px-3 py-2', className)}>
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
          fontSize: 'var(--tmnl-text-sm, 14px)',
          minHeight,
          maxHeight,
        }}
        rows={1}
      />
    </div>
  )
}

ComposerTextArea.displayName = 'Composer.TextArea'
