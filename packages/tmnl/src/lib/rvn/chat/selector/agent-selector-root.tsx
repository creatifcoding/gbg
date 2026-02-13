import { forwardRef, useMemo, type ComponentPropsWithoutRef, type ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { RvnChatAgentSelectorContext } from './selector-context'
import { AgentSelectorTrigger } from './selector-trigger'
import { AgentSelectorMenu } from './selector-menu'
import { AgentSelectorOption } from './selector-option'

export interface RvnChatAgentSelectorRootProps extends ComponentPropsWithoutRef<'div'> {
  open?: boolean
}

const Root = forwardRef<HTMLDivElement, RvnChatAgentSelectorRootProps>(
  ({ open = false, className, children, ...props }, ref) => {
    const context = useMemo(() => ({ open }), [open])

    return (
      <RvnChatAgentSelectorContext.Provider value={context}>
        <div
          ref={ref}
          data-slot="rvn-chat-agent-selector"
          data-open={open || undefined}
          className={cn('rvn-chat__agent-selector', className)}
          {...props}
        >
          {children}
        </div>
      </RvnChatAgentSelectorContext.Provider>
    )
  },
)
Root.displayName = 'RvnChatAgentSelector.Root'

interface RvnChatAgentSelectorComponent {
  (props: RvnChatAgentSelectorRootProps): ReactElement
  displayName?: string
  Root: typeof Root
  Trigger: typeof AgentSelectorTrigger
  Menu: typeof AgentSelectorMenu
  Option: typeof AgentSelectorOption
}

const RvnChatAgentSelector = Root as RvnChatAgentSelectorComponent
RvnChatAgentSelector.Root = Root
RvnChatAgentSelector.Trigger = AgentSelectorTrigger
RvnChatAgentSelector.Menu = AgentSelectorMenu
RvnChatAgentSelector.Option = AgentSelectorOption

export { RvnChatAgentSelector }
