/**
 * Composer.OverflowMenu
 *
 * ··· button that opens a compact popover listing overflowed toolbar actions.
 * Used by progressive overflow — actions that don't fit at the current
 * width tier are rendered here instead of inline.
 *
 * @module chat/composer/composer-overflow-menu
 */

import { useState, useCallback, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COMPOSER_SIZING } from '../tokens'
import { useComposer } from './composer-context'

export interface OverflowAction {
  id: string
  icon: ReactNode
  label: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
}

export interface ComposerOverflowMenuProps {
  items: OverflowAction[]
  className?: string
}

export function ComposerOverflowMenu({ items, className }: ComposerOverflowMenuProps) {
  const { widthTier } = useComposer()
  const sizing = COMPOSER_SIZING[widthTier]
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => setOpen((v) => !v), [])
  const close = useCallback(() => setOpen(false), [])

  if (items.length === 0) return null

  return (
    <div className={cn('relative', className)}>
      {/* Trigger */}
      <button
        onClick={toggle}
        className={cn(
          'flex items-center justify-center',
          sizing.actionBtn,
          'border-none cursor-pointer transition-all duration-150',
          open ? 'text-white bg-neutral-800' : 'text-neutral-500 bg-transparent hover:text-neutral-300',
        )}
        title="More actions"
      >
        <MoreHorizontal size={sizing.actionIcon} />
      </button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[999998]" onClick={close} />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                'absolute bottom-full left-0 mb-1.5 z-[999999] w-44 p-1 rounded-lg',
                'bg-black/95 backdrop-blur-sm',
                'border border-neutral-800 shadow-xl',
              )}
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.onClick?.()
                    close()
                  }}
                  disabled={item.disabled}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left',
                    'border-none cursor-pointer transition-all duration-150',
                    item.active
                      ? 'bg-neutral-800 text-white'
                      : 'bg-transparent text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200',
                    item.disabled && 'opacity-40 cursor-not-allowed',
                  )}
                  style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
                >
                  <span className="flex-shrink-0 flex items-center justify-center w-4 h-4">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

ComposerOverflowMenu.displayName = 'Composer.OverflowMenu'
