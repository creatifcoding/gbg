/**
 * Command Band View — Chip Row for Slash Commands
 *
 * Reads adapter.commandChips$ and renders a horizontal scrollable
 * row of command chips above the composer. Clicking a chip
 * populates the draft.
 *
 * @module morphchat/components/command-band-view
 */

import * as React from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import type { MockChatAdapter, MockCommandChip } from '../adapters/mock-adapter'

// =============================================================================
// Command Band View
// =============================================================================

export function CommandBandView() {
  const { adapter } = useMorphChatContext()

  // Duck-type check for commandChips$ (mock-specific)
  const mockAdapter = adapter as Partial<MockChatAdapter>
  if (!mockAdapter.commandChips$) return null

  return <CommandChipRow
    commandChips$={mockAdapter.commandChips$}
    setDraft={mockAdapter.setDraft}
  />
}

CommandBandView.displayName = 'MorphChat.CommandBandView'

// =============================================================================
// Inner (unconditional hook calls)
// =============================================================================

function CommandChipRow({
  commandChips$,
  setDraft,
}: {
  commandChips$: NonNullable<MockChatAdapter['commandChips$']>
  setDraft?: (text: string) => void
}) {
  const chips = useAtomValue(commandChips$)

  if (chips.length === 0) return null

  const handleClick = React.useCallback(
    (chip: MockCommandChip) => {
      setDraft?.(chip.command + ' ')
    },
    [setDraft],
  )

  return (
    <div
      data-slot="morphchat-command-band"
      className="flex items-center gap-1.5 px-4 py-1.5 overflow-x-auto scrollbar-none border-t border-neutral-800/30"
    >
      <span
        className="text-neutral-700 font-mono uppercase tracking-wider shrink-0 mr-1"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        cmds
      </span>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => handleClick(chip)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md shrink-0',
            'font-mono border transition-all duration-200',
            'border-neutral-800 text-neutral-500',
            'hover:border-cyan-800/50 hover:text-cyan-400',
            'active:scale-[0.97]',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          title={chip.description}
        >
          <span className="text-cyan-600">/</span>
          {chip.label}
        </button>
      ))}
    </div>
  )
}
