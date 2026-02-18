import {
  forwardRef,
  useMemo,
  type ComponentPropsWithoutRef,
  type ReactElement,
} from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { ChatShellContext } from './shell-context'
import { ChatHeaderBand } from './header-band'
import { ChatCommandBand } from './command-band'
import { ChatThreadBand } from './thread-band'
import { ChatComposerBand } from './composer-band'
import { ChatShellOverlayLayer } from './overlay-layer'
import { ChatShellOrnamentLayer } from './ornament-layer'
import {
  CHAT_SHELL_GEOMETRY_CONTRACT,
  resolveChatShellGeometry,
  type ChatShellExpansionLevel,
} from './geometry-contract'
import { CHAT_SHELL_SCROLL_CONTRACT } from './scroll-contract'
import {
  ChatShellSlotGuards,
  useChatShellSlotGuards,
  type ChatShellSlotGuardMode,
} from './slot-guards'

export interface ChatShellRootProps extends ComponentPropsWithoutRef<'section'> {
  expansionLevel?: ChatShellExpansionLevel
  animated?: boolean
  guardMode?: ChatShellSlotGuardMode
}

const Root = forwardRef<HTMLElement, ChatShellRootProps>(
  (
    {
      expansionLevel = 'l3',
      animated = true,
      guardMode = 'off',
      className,
      children,
      style,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion()
    const contextValue = useMemo(() => ({ expansionLevel }), [expansionLevel])
    const geometryStyle = useMemo(
      () =>
        resolveChatShellGeometry({
          expansionLevel,
          animated,
          prefersReducedMotion,
        }),
      [animated, expansionLevel, prefersReducedMotion],
    )

    useChatShellSlotGuards(children, {
      mode: guardMode,
      componentName: 'ChatShell.Root',
    })

    return (
      <ChatShellContext.Provider value={contextValue}>
        <motion.section
          ref={ref}
          layout={animated && !prefersReducedMotion}
          data-slot="tmnl-chat-shell"
          data-expansion-level={expansionLevel}
          data-geometry-contract={CHAT_SHELL_GEOMETRY_CONTRACT.id}
          data-scroll-contract={CHAT_SHELL_SCROLL_CONTRACT.id}
          className={cn(
            'relative grid bg-black/30 backdrop-blur-xl',
            'border border-neutral-800 rounded-xl',
            'overflow-hidden',
            className,
          )}
          style={{
            ...geometryStyle,
            ...style,
          }}
          {...props}
        >
          {children}
        </motion.section>
      </ChatShellContext.Provider>
    )
  },
)
Root.displayName = 'ChatShell.Root'

interface ChatShellComponent {
  (props: ChatShellRootProps): ReactElement
  displayName?: string
  Root: typeof Root
  HeaderBand: typeof ChatHeaderBand
  CommandBand: typeof ChatCommandBand
  ThreadBand: typeof ChatThreadBand
  ComposerBand: typeof ChatComposerBand
  OverlayLayer: typeof ChatShellOverlayLayer
  OrnamentLayer: typeof ChatShellOrnamentLayer
  GeometryContract: typeof CHAT_SHELL_GEOMETRY_CONTRACT
  ScrollContract: typeof CHAT_SHELL_SCROLL_CONTRACT
  SlotGuards: typeof ChatShellSlotGuards
}

const ChatShell = Root as unknown as ChatShellComponent
ChatShell.Root = Root
ChatShell.HeaderBand = ChatHeaderBand
ChatShell.CommandBand = ChatCommandBand
ChatShell.ThreadBand = ChatThreadBand
ChatShell.ComposerBand = ChatComposerBand
ChatShell.OverlayLayer = ChatShellOverlayLayer
ChatShell.OrnamentLayer = ChatShellOrnamentLayer
ChatShell.GeometryContract = CHAT_SHELL_GEOMETRY_CONTRACT
ChatShell.ScrollContract = CHAT_SHELL_SCROLL_CONTRACT
ChatShell.SlotGuards = ChatShellSlotGuards

export { ChatShell }
