/**
 * ChatIsolated — full integrated chat surface.
 *
 * This is a placeholder for the TMNL-styled integrated chat.
 * The RVN version (1141 lines) manages connection, message list,
 * composer, and agent selection. This will be built incrementally
 * using the ported compound components.
 */

import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { ChatShell } from './shell'
import { ChatEmptyState } from './empty'

export interface ChatIsolatedProps extends ComponentPropsWithoutRef<'div'> {
  /** Session ID for the chat */
  sessionId?: string
  /** Title shown in header band */
  title?: string
}

export const ChatIsolated = forwardRef<HTMLDivElement, ChatIsolatedProps>(
  ({ sessionId, title = 'TMNL Chat', className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-isolated"
      data-session-id={sessionId}
      className={cn('flex flex-col h-full', className)}
      {...props}
    >
      <ChatShell expansionLevel="l3">
        <ChatShell.HeaderBand>
          <ChatShell.HeaderBand.Left>
            <ChatShell.HeaderBand.Title>{title}</ChatShell.HeaderBand.Title>
          </ChatShell.HeaderBand.Left>
        </ChatShell.HeaderBand>
        <ChatShell.CommandBand />
        <ChatShell.ThreadBand autoScroll="follow">
          <ChatEmptyState />
        </ChatShell.ThreadBand>
        <ChatShell.ComposerBand>
          {/* Composer will be wired here */}
        </ChatShell.ComposerBand>
      </ChatShell>
    </div>
  ),
)

ChatIsolated.displayName = 'ChatIsolated'
