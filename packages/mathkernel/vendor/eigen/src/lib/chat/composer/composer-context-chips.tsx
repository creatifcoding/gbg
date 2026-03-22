/**
 * Composer.ContextChips
 *
 * Displays active context chips (hashtag, context, pending) with
 * toggle and remove actions. TMNL-styled tags.
 */

import { cn } from '@/lib/utils'
import { Hash, X } from 'lucide-react'
import { CHAT_TOKENS, COMPOSER_SIZING } from '../tokens'
import { useComposer } from './composer-context'

export interface ComposerContextChipsProps {
  className?: string
}

export function ComposerContextChips({
  className,
}: ComposerContextChipsProps) {
  const { contextChips, removeContextChip, toggleContextChip, widthTier } = useComposer()
  const sizing = COMPOSER_SIZING[widthTier]

  if (contextChips.length === 0) return null

  const chipStyles = CHAT_TOKENS.chip

  return (
    <div
      data-slot="tmnl-composer-chips"
      className={cn(
        'flex items-center flex-wrap border-b border-neutral-800/40',
        sizing.chipPad,
        className,
      )}
    >
      {contextChips.map((chip) => {
        const isDisabled = chip.enabled === false
        const variant = isDisabled
          ? chipStyles.disabled
          : chip.type === 'hashtag'
            ? chipStyles.hashtag
            : chip.type === 'pending'
              ? chipStyles.pending
              : chipStyles.context

        return (
          <div
            key={chip.id}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md',
              'font-mono transition-all duration-150',
              variant,
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
          >
            <button
              onClick={() => toggleContextChip(chip.id)}
              className="flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
            >
              {chip.type === 'hashtag' && (
                <Hash size={10} className="opacity-60" />
              )}
              <span className="max-w-[100px] truncate">{chip.label}</span>
            </button>
            <button
              onClick={() => removeContextChip(chip.id)}
              className="flex items-center justify-center p-0.5 bg-transparent border-none cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
            >
              <X size={10} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

ComposerContextChips.displayName = 'Composer.ContextChips'
