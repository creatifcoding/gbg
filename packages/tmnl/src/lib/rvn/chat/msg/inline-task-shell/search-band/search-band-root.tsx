/**
 * SearchBand — task filter input for the inline task shell.
 *
 * Filters tasks by title/taskId match within the current thread.
 * Not a command executor — purely search. Renders hotkey hints (ESC to clear).
 * CSS: `.rvn-chat__inline-task-shell-search-band`.
 */
import {
  forwardRef,
  useCallback,
  useRef,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from 'react'
import { useInlineTaskShellContext } from '../inline-task-shell-context'
import { cn } from '@/lib/utils'

export interface SearchBandProps extends ComponentPropsWithoutRef<'div'> {
  placeholder?: string
}

export const SearchBand = forwardRef<HTMLDivElement, SearchBandProps>(
  ({ placeholder = 'Filter tasks…', className, ...props }, ref) => {
    const { expanded, searchTerm, setSearchTerm } = useInlineTaskShellContext()
    const inputRef = useRef<HTMLInputElement>(null)

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          setSearchTerm('')
          inputRef.current?.blur()
        }
      },
      [setSearchTerm],
    )

    if (!expanded) return null

    return (
      <div
        ref={ref}
        className={cn('rvn-chat__inline-task-shell-search-band', className)}
        {...props}
      >
        <span className="rvn-chat__inline-task-shell-search-prompt" aria-hidden="true">
          ❯
        </span>
        <input
          ref={inputRef}
          type="text"
          className="rvn-chat__inline-task-shell-search-input"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Filter tasks"
        />
        {searchTerm ? (
          <span className="rvn-chat__inline-task-shell-search-hints">
            <kbd className="rvn-chat__inline-task-shell-search-hint">ESC</kbd>
          </span>
        ) : null}
      </div>
    )
  },
)

SearchBand.displayName = 'InlineTaskShell.SearchBand'
