import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export interface RvnChatComposerTransportPrimaryProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  streaming?: boolean
  sendLabel?: string
  pauseLabel?: string
  children?: never
}

export const RvnChatComposerTransportPrimary = forwardRef<
  HTMLButtonElement,
  RvnChatComposerTransportPrimaryProps
>(({ streaming = false, sendLabel = 'Send', pauseLabel = 'Pause', className, ...props }, ref) => {
  const prefersReducedMotion = useReducedMotion()
  const label = streaming ? pauseLabel : sendLabel

  return (
    <motion.button
      ref={ref}
      type="button"
      data-slot="rvn-chat-composer-transport-primary"
      data-streaming={streaming || undefined}
      className={cn('rvn-chat__send', className)}
      whileHover={prefersReducedMotion ? undefined : { y: -1 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.14, ease: 'easeOut' }}
      {...props}
    >
      {label}
    </motion.button>
  )
})

RvnChatComposerTransportPrimary.displayName = 'RvnChatComposer.Transport.Primary'
