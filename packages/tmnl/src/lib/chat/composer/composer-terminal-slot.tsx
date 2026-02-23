/**
 * Composer.TerminalSlot — Conditionally renders inline terminal when mode === 'terminal'.
 *
 * Uses AnimatePresence for smooth enter/exit. Sits above the textarea
 * in the composer layout — textarea remains for chat fallback.
 *
 * @module chat/composer/composer-terminal-slot
 */

import { type FC } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useComposer } from './composer-context'
import { ComposerTerminal, type ComposerTerminalProps } from './composer-terminal'

export interface ComposerTerminalSlotProps extends ComposerTerminalProps {}

export const ComposerTerminalSlot: FC<ComposerTerminalSlotProps> = (props) => {
  const { mode } = useComposer()
  const isTerminalMode = mode === 'terminal'

  return (
    <AnimatePresence>
      {isTerminalMode && (
        <motion.div
          key="composer-terminal-slot"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className="overflow-hidden px-2 pt-2"
        >
          <ComposerTerminal {...props} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

ComposerTerminalSlot.displayName = 'Composer.TerminalSlot'
