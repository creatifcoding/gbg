import {
  forwardRef,
  useMemo,
  type ComponentPropsWithoutRef,
  type ReactElement,
} from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { RvnChatShellContext } from './shell-context'
import { RvnChatHeaderBand } from './header-band'
import { RvnChatCommandBand } from './command-band'
import { RvnChatThreadBand } from './thread-band'
import { RvnChatComposerBand } from './composer-band'
import { RvnChatShellOverlayLayer } from './overlay-layer'
import { RvnChatShellOrnamentLayer } from './ornament-layer'
import {
  RVN_CHAT_SHELL_GEOMETRY_CONTRACT,
  resolveRvnChatShellGeometry,
  type RvnChatShellExpansionLevel,
} from './geometry-contract'
import {
  RVN_CHAT_SHELL_SCROLL_CONTRACT,
} from './scroll-contract'
import {
  RvnChatShellSlotGuards,
  useRvnChatShellSlotGuards,
  type RvnChatShellSlotGuardMode,
} from './slot-guards'

export interface RvnChatShellRootProps extends ComponentPropsWithoutRef<'section'> {
  expansionLevel?: RvnChatShellExpansionLevel
  animated?: boolean
  guardMode?: RvnChatShellSlotGuardMode
}

const Root = forwardRef<HTMLElement, RvnChatShellRootProps>(
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
        resolveRvnChatShellGeometry({
          expansionLevel,
          animated,
          prefersReducedMotion,
        }),
      [animated, expansionLevel, prefersReducedMotion],
    )

    useRvnChatShellSlotGuards(children, {
      mode: guardMode,
      componentName: 'RvnChatShell.Root',
    })

    return (
      <RvnChatShellContext.Provider value={contextValue}>
        <motion.section
          ref={ref}
          layout={animated && !prefersReducedMotion}
          data-slot="rvn-chat-shell"
          data-expansion-level={expansionLevel}
          data-geometry-contract={RVN_CHAT_SHELL_GEOMETRY_CONTRACT.id}
          data-scroll-contract={RVN_CHAT_SHELL_SCROLL_CONTRACT.id}
          className={cn('rvn-chat', 'rvn-chat__frame', 'rvn-chat-shell', className)}
          style={{
            ...geometryStyle,
            ...style,
          }}
          {...props}
        >
          {children}
        </motion.section>
      </RvnChatShellContext.Provider>
    )
  },
)
Root.displayName = 'RvnChatShell.Root'

interface RvnChatShellComponent {
  (props: RvnChatShellRootProps): ReactElement
  displayName?: string
  Root: typeof Root
  HeaderBand: typeof RvnChatHeaderBand
  CommandBand: typeof RvnChatCommandBand
  ThreadBand: typeof RvnChatThreadBand
  ComposerBand: typeof RvnChatComposerBand
  OverlayLayer: typeof RvnChatShellOverlayLayer
  OrnamentLayer: typeof RvnChatShellOrnamentLayer
  GeometryContract: typeof RVN_CHAT_SHELL_GEOMETRY_CONTRACT
  ScrollContract: typeof RVN_CHAT_SHELL_SCROLL_CONTRACT
  SlotGuards: typeof RvnChatShellSlotGuards
}

const RvnChatShell = Root as RvnChatShellComponent
RvnChatShell.Root = Root
RvnChatShell.HeaderBand = RvnChatHeaderBand
RvnChatShell.CommandBand = RvnChatCommandBand
RvnChatShell.ThreadBand = RvnChatThreadBand
RvnChatShell.ComposerBand = RvnChatComposerBand
RvnChatShell.OverlayLayer = RvnChatShellOverlayLayer
RvnChatShell.OrnamentLayer = RvnChatShellOrnamentLayer
RvnChatShell.GeometryContract = RVN_CHAT_SHELL_GEOMETRY_CONTRACT
RvnChatShell.ScrollContract = RVN_CHAT_SHELL_SCROLL_CONTRACT
RvnChatShell.SlotGuards = RvnChatShellSlotGuards

export { RvnChatShell }
