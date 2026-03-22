/**
 * Composer.ModeToggle
 *
 * Segmented toggle for Terminal vs AI mode.
 * TMNL-styled — neutral-700 border, clean active state.
 */

import { cn } from '@/lib/utils'
import { CHAT_TOKENS } from '../tokens'
import { useComposer } from './composer-context'

export interface ComposerModeToggleProps {
  className?: string
}

export function ComposerModeToggle({ className }: ComposerModeToggleProps) {
  const { mode, setMode } = useComposer()
  const t = CHAT_TOKENS.mode

  return (
    <div
      data-slot="tmnl-composer-mode"
      className={cn(
        'flex items-center rounded-md overflow-hidden',
        t.border,
        className,
      )}
    >
      <button
        onClick={() => setMode('terminal')}
        className={cn(
          'px-2 py-1 font-mono border-none cursor-pointer transition-all duration-150',
          mode === 'terminal' ? t.activeSegment : t.inactiveSegment,
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        title="Terminal mode"
      >
        &gt;_
      </button>
      <button
        onClick={() => setMode('ai')}
        className={cn(
          'px-2 py-1 font-semibold border-none cursor-pointer transition-all duration-150',
          mode === 'ai' ? t.activeSegment : t.inactiveSegment,
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        title="AI mode"
      >
        AI
      </button>
    </div>
  )
}

ComposerModeToggle.displayName = 'Composer.ModeToggle'
