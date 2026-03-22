import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInlineTaskShellContext } from '../inline-task-shell-context'

export interface SearchBandProps extends ComponentPropsWithoutRef<'div'> {
  placeholder?: string
}

export const SearchBand = forwardRef<HTMLDivElement, SearchBandProps>(
  ({ placeholder = 'Filter tasks…', className, ...props }, ref) => {
    const { expanded, searchTerm, setSearchTerm } = useInlineTaskShellContext()

    if (!expanded) return null

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-inline-task-shell-search-band"
        className={cn(
          'flex items-center gap-2 px-3 py-1.5',
          'border-b border-neutral-800/30',
          className,
        )}
        {...props}
      >
        <Search size={14} className="text-neutral-600 shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'flex-1 bg-transparent outline-none font-mono text-neutral-300',
            'placeholder:text-neutral-700',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-neutral-600 hover:text-neutral-300 transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>
    )
  },
)

SearchBand.displayName = 'InlineTaskShell.SearchBand'
