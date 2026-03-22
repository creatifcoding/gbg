import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  type ComponentPropsWithoutRef,
  type ReactElement,
} from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export type RvnChatExpansionLevel = 'l2' | 'l3'

interface RvnChatFrameContextValue {
  readonly expansionLevel: RvnChatExpansionLevel
}

const RvnChatFrameContext = createContext<RvnChatFrameContextValue | null>(null)

function useRvnChatFrameContext() {
  return useContext(RvnChatFrameContext)
}

export interface RvnChatFrameRootProps extends ComponentPropsWithoutRef<'section'> {
  expansionLevel?: RvnChatExpansionLevel
  animated?: boolean
  transitionMs?: number
}

export type RvnChatFrameHeaderProps = ComponentPropsWithoutRef<'header'>
export type RvnChatFrameCommandRailProps = ComponentPropsWithoutRef<'div'>
export type RvnChatFrameThreadProps = ComponentPropsWithoutRef<'div'>
export type RvnChatFrameComposerProps = ComponentPropsWithoutRef<'footer'>

const RvnChatFrameRoot = forwardRef<HTMLElement, RvnChatFrameRootProps>(
  (
    {
      expansionLevel = 'l3',
      animated = true,
      transitionMs = 220,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion()
    const durationMs = animated && !prefersReducedMotion ? transitionMs : 0

    const contextValue = useMemo<RvnChatFrameContextValue>(
      () => ({ expansionLevel }),
      [expansionLevel],
    )

    return (
      <RvnChatFrameContext.Provider value={contextValue}>
        <motion.section
          ref={ref}
          layout={animated && !prefersReducedMotion}
          data-slot="rvn-chat-frame"
          data-expansion-level={expansionLevel}
          className={cn(
            'rvn-chat',
            'rvn-chat__frame',
            expansionLevel === 'l3' ? 'rvn-chat--l3' : 'rvn-chat--l2',
            className,
          )}
          style={{
            transitionDuration: `${durationMs}ms`,
            ...style,
          }}
          {...props}
        >
          {children}
        </motion.section>
      </RvnChatFrameContext.Provider>
    )
  },
)
RvnChatFrameRoot.displayName = 'RvnChatFrame.Root'

const RvnChatFrameHeader = forwardRef<HTMLElement, RvnChatFrameHeaderProps>(
  ({ className, ...props }, ref) => {
    const context = useRvnChatFrameContext()

    return (
      <header
        ref={ref}
        data-slot="rvn-chat-frame-header"
        data-expansion-level={context?.expansionLevel}
        className={cn('rvn-chat__header', className)}
        {...props}
      />
    )
  },
)
RvnChatFrameHeader.displayName = 'RvnChatFrame.Header'

const RvnChatFrameCommandRail = forwardRef<HTMLDivElement, RvnChatFrameCommandRailProps>(
  ({ className, ...props }, ref) => {
    const context = useRvnChatFrameContext()

    return (
      <div
        ref={ref}
        data-slot="rvn-chat-frame-command-rail"
        data-expansion-level={context?.expansionLevel}
        className={cn('rvn-chat__command-rail', className)}
        {...props}
      />
    )
  },
)
RvnChatFrameCommandRail.displayName = 'RvnChatFrame.CommandRail'

const RvnChatFrameThread = forwardRef<HTMLDivElement, RvnChatFrameThreadProps>(
  ({ className, ...props }, ref) => {
    const context = useRvnChatFrameContext()

    return (
      <div
        ref={ref}
        data-slot="rvn-chat-frame-thread"
        data-expansion-level={context?.expansionLevel}
        className={cn('rvn-chat__thread', className)}
        {...props}
      />
    )
  },
)
RvnChatFrameThread.displayName = 'RvnChatFrame.Thread'

const RvnChatFrameComposer = forwardRef<HTMLElement, RvnChatFrameComposerProps>(
  ({ className, ...props }, ref) => {
    const context = useRvnChatFrameContext()

    return (
      <footer
        ref={ref}
        data-slot="rvn-chat-frame-composer"
        data-expansion-level={context?.expansionLevel}
        className={cn('rvn-chat__composer', className)}
        {...props}
      />
    )
  },
)
RvnChatFrameComposer.displayName = 'RvnChatFrame.Composer'

interface RvnChatFrameComponent {
  (props: RvnChatFrameRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatFrameRoot
  Header: typeof RvnChatFrameHeader
  CommandRail: typeof RvnChatFrameCommandRail
  Thread: typeof RvnChatFrameThread
  Composer: typeof RvnChatFrameComposer
}

const RvnChatFrame = RvnChatFrameRoot as RvnChatFrameComponent
RvnChatFrame.Root = RvnChatFrameRoot
RvnChatFrame.Header = RvnChatFrameHeader
RvnChatFrame.CommandRail = RvnChatFrameCommandRail
RvnChatFrame.Thread = RvnChatFrameThread
RvnChatFrame.Composer = RvnChatFrameComposer

export { RvnChatFrame }
