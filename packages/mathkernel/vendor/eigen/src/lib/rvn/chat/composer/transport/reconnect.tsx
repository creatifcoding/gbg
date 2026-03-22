import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export type RvnChatComposerTransportReconnectProps = ComponentPropsWithoutRef<'button'>

export const RvnChatComposerTransportReconnect = forwardRef<
  HTMLButtonElement,
  RvnChatComposerTransportReconnectProps
>(({ className, ...props }, ref) => {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.button
      ref={ref}
      type="button"
      data-slot="rvn-chat-composer-transport-reconnect"
      className={cn('rvn-chat__reconnect', className)}
      whileHover={prefersReducedMotion ? undefined : { y: -1 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.14, ease: 'easeOut' }}
      {...props}
    />
  )
})

RvnChatComposerTransportReconnect.displayName = 'RvnChatComposer.Transport.Reconnect'
