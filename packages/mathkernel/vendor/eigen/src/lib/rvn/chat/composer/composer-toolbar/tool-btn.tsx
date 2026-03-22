import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export interface RvnChatComposerToolBtnProps extends ComponentPropsWithoutRef<'button'> {
  active?: boolean
  tone?: 'default' | 'recording'
}

export const RvnChatComposerToolBtn = forwardRef<HTMLButtonElement, RvnChatComposerToolBtnProps>(
  ({ active = false, tone = 'default', className, ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion()

    return (
      <motion.button
        ref={ref}
        type="button"
        data-slot="rvn-chat-composer-tool-btn"
        data-state={active ? 'active' : 'idle'}
        data-tone={tone}
        className={cn(
          'rvn-chat__tool-btn',
          tone === 'recording' && 'rvn-chat__tool-btn--voice',
          className,
        )}
        whileHover={prefersReducedMotion ? undefined : { y: -1 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.14, ease: 'easeOut' }}
        {...props}
      />
    )
  },
)

RvnChatComposerToolBtn.displayName = 'RvnChatComposer.Toolbar.ToolBtn'
