/**
 * RvnCollapsible - Brutalist Collapsible Component
 *
 * Wraps Base UI Collapsible with RVN styling:
 * - 3px border
 * - Black header
 * - anime.js height animation
 *
 * @example
 * ```tsx
 * <RvnCollapsible.Root>
 *   <RvnCollapsible.Trigger>Mission Parameters</RvnCollapsible.Trigger>
 *   <RvnCollapsible.Panel>
 *     <p>Content here...</p>
 *   </RvnCollapsible.Panel>
 * </RvnCollapsible.Root>
 * ```
 */

import * as React from 'react'
import { Collapsible } from '@base-ui-components/react/collapsible'
import { animate } from 'animejs'
import {
  RVN_COLORS,
  RVN_BORDERS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnCollapsibleRootProps extends React.ComponentProps<typeof Collapsible.Root> {
  /** Animate the panel opening/closing */
  animated?: boolean
  /** Animation duration in ms */
  animationDuration?: number
}

export interface RvnCollapsibleTriggerProps extends React.ComponentProps<typeof Collapsible.Trigger> {
  /** Show chevron indicator */
  showIndicator?: boolean
}

export interface RvnCollapsiblePanelProps extends React.ComponentProps<typeof Collapsible.Panel> {}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface RvnCollapsibleContextValue {
  isOpen: boolean
  animated: boolean
  animationDuration: number
}

const RvnCollapsibleContext = React.createContext<RvnCollapsibleContextValue>({
  isOpen: false,
  animated: true,
  animationDuration: 200,
})

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  root: {
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    overflow: 'hidden',
  } as React.CSSProperties,
  trigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: `${RVN_SPACING.s} ${RVN_SPACING.m}`,
    background: RVN_COLORS.black,
    border: 'none',
    color: RVN_COLORS.textInverse,
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    textAlign: 'left' as const,
    letterSpacing: '0.05em',
    transition: 'background 0.15s ease',
  } as React.CSSProperties,
  triggerHover: {
    background: '#222222',
  } as React.CSSProperties,
  indicator: {
    display: 'inline-flex',
    transition: 'transform 0.2s ease',
    fontFamily: RVN_FONTS.mono,
    fontSize: '16px',
    fontWeight: RVN_FONT_WEIGHTS.bold,
  } as React.CSSProperties,
  indicatorOpen: {
    transform: 'rotate(90deg)',
  } as React.CSSProperties,
  panel: {
    background: RVN_COLORS.surface,
    overflow: 'hidden',
  } as React.CSSProperties,
  panelContent: {
    padding: RVN_SPACING.m,
  } as React.CSSProperties,
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

const Root = React.forwardRef<HTMLDivElement, RvnCollapsibleRootProps>(
  (
    {
      style,
      open,
      defaultOpen,
      onOpenChange,
      animated = true,
      animationDuration = 200,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen ?? open ?? false)

    const handleOpenChange = React.useCallback(
      (newOpen: boolean) => {
        setIsOpen(newOpen)
        onOpenChange?.(newOpen)
      },
      [onOpenChange]
    )

    React.useEffect(() => {
      if (open !== undefined) {
        setIsOpen(open)
      }
    }, [open])

    return (
      <RvnCollapsibleContext.Provider value={{ isOpen, animated, animationDuration }}>
        <Collapsible.Root
          ref={ref}
          style={{ ...styles.root, ...style }}
          open={open}
          defaultOpen={defaultOpen}
          onOpenChange={handleOpenChange}
          {...props}
        />
      </RvnCollapsibleContext.Provider>
    )
  }
)
Root.displayName = 'RvnCollapsible.Root'

const Trigger = React.forwardRef<HTMLButtonElement, RvnCollapsibleTriggerProps>(
  ({ showIndicator = true, style, children, ...props }, ref) => {
    const { isOpen } = React.useContext(RvnCollapsibleContext)
    const [isHovered, setIsHovered] = React.useState(false)

    return (
      <Collapsible.Trigger
        ref={ref}
        style={{
          ...styles.trigger,
          ...(isHovered ? styles.triggerHover : {}),
          ...style,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {children}
        {showIndicator && (
          <span
            style={{
              ...styles.indicator,
              ...(isOpen ? styles.indicatorOpen : {}),
            }}
          >
            {'>'}
          </span>
        )}
      </Collapsible.Trigger>
    )
  }
)
Trigger.displayName = 'RvnCollapsible.Trigger'

const Panel = React.forwardRef<HTMLDivElement, RvnCollapsiblePanelProps>(
  ({ style, children, ...props }, ref) => {
    const { isOpen, animated, animationDuration } = React.useContext(RvnCollapsibleContext)
    const contentRef = React.useRef<HTMLDivElement>(null)
    const panelRef = React.useRef<HTMLDivElement>(null)

    // Combine refs
    const combinedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        (panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        }
      },
      [ref]
    )

    // Animate height on open/close
    React.useEffect(() => {
      if (!animated || !panelRef.current || !contentRef.current) return

      const panel = panelRef.current
      const content = contentRef.current

      if (isOpen) {
        // Opening animation
        const targetHeight = content.scrollHeight
        animate(panel, {
          height: [0, targetHeight],
          duration: animationDuration,
          ease: 'outQuad',
        })
      } else {
        // Closing animation
        animate(panel, {
          height: 0,
          duration: animationDuration,
          ease: 'inQuad',
        })
      }
    }, [isOpen, animated, animationDuration])

    return (
      <Collapsible.Panel
        ref={combinedRef}
        style={{
          ...styles.panel,
          height: animated ? 0 : undefined,
          ...style,
        }}
        {...props}
      >
        <div ref={contentRef} style={styles.panelContent}>
          {children}
        </div>
      </Collapsible.Panel>
    )
  }
)
Panel.displayName = 'RvnCollapsible.Panel'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnCollapsible = {
  Root,
  Trigger,
  Panel,
}

export {
  Root as RvnCollapsibleRoot,
  Trigger as RvnCollapsibleTrigger,
  Panel as RvnCollapsiblePanel,
}
