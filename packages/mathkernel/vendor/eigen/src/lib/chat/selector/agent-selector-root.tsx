import { forwardRef, useMemo, type ComponentPropsWithoutRef, type ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { ChatAgentSelectorContext } from './selector-context'
import { AgentSelectorTrigger } from './selector-trigger'
import { AgentSelectorMenu } from './selector-menu'
import { AgentSelectorOption } from './selector-option'

export interface ChatAgentSelectorRootProps extends ComponentPropsWithoutRef<'div'> {
  open?: boolean
}

const Root = forwardRef<HTMLDivElement, ChatAgentSelectorRootProps>(
  ({ open = false, className, children, ...props }, ref) => {
    const context = useMemo(() => ({ open }), [open])

    return (
      <ChatAgentSelectorContext.Provider value={context}>
        <div
          ref={ref}
          data-slot="tmnl-chat-agent-selector"
          data-open={open || undefined}
          className={cn('relative', className)}
          {...props}
        >
          {children}
        </div>
      </ChatAgentSelectorContext.Provider>
    )
  },
)
Root.displayName = 'ChatAgentSelector.Root'

interface ChatAgentSelectorComponent {
  (props: ChatAgentSelectorRootProps): ReactElement
  displayName?: string
  Root: typeof Root
  Trigger: typeof AgentSelectorTrigger
  Menu: typeof AgentSelectorMenu
  Option: typeof AgentSelectorOption
}

const ChatAgentSelector = Root as unknown as ChatAgentSelectorComponent
ChatAgentSelector.Root = Root
ChatAgentSelector.Trigger = AgentSelectorTrigger
ChatAgentSelector.Menu = AgentSelectorMenu
ChatAgentSelector.Option = AgentSelectorOption

export { ChatAgentSelector }
