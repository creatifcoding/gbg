/**
 * RvnPopover - Brutalist Click Popover
 *
 * Click-triggered popover with compound pattern for flexible content.
 * Features 3px black border, white background, close on outside click.
 *
 * Features:
 * - Compound pattern: Trigger, Content
 * - Close on outside click (configurable)
 * - Close on Escape key
 * - Position: top, bottom, left, right
 * - Controlled or uncontrolled usage
 *
 * @example
 * ```tsx
 * <RvnPopover>
 *   <RvnPopover.Trigger>
 *     <button>SHOW DETAILS</button>
 *   </RvnPopover.Trigger>
 *   <RvnPopover.Content>
 *     <p>Popover content here</p>
 *   </RvnPopover.Content>
 * </RvnPopover>
 * ```
 */

import * as React from 'react'
import {
  RVN_BORDERS,
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_SHADOWS,
  RVN_SPACING,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnPopoverPosition = 'top' | 'bottom' | 'left' | 'right'

interface RvnPopoverContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  position: RvnPopoverPosition
  triggerId: string
  contentId: string
}

export interface RvnPopoverProps {
  /** Popover children (Trigger and Content) */
  children: React.ReactNode
  /** Controlled open state */
  open?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
  /** Content position relative to trigger */
  position?: RvnPopoverPosition
  /** Close on outside click (default: true) */
  closeOnOutsideClick?: boolean
  /** Close on Escape key (default: true) */
  closeOnEscape?: boolean
}

export interface RvnPopoverTriggerProps {
  /** Trigger element (must be a single React element) */
  children: React.ReactElement
  /** Additional inline styles */
  style?: React.CSSProperties
}

export interface RvnPopoverContentProps {
  /** Popover content */
  children: React.ReactNode
  /** Additional inline styles */
  style?: React.CSSProperties
  /** Min width of content */
  minWidth?: string
  /** Max width of content */
  maxWidth?: string
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const OFFSET = 8

const POSITION_STYLES: Record<RvnPopoverPosition, React.CSSProperties> = {
  top: {
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: `${OFFSET}px`,
  },
  bottom: {
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: `${OFFSET}px`,
  },
  left: {
    right: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginRight: `${OFFSET}px`,
  },
  right: {
    left: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginLeft: `${OFFSET}px`,
  },
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const RvnPopoverContext = React.createContext<RvnPopoverContextValue | null>(null)

function useRvnPopover(): RvnPopoverContextValue {
  const context = React.use(RvnPopoverContext)
  if (!context) {
    throw new Error('RvnPopover compound components must be used within RvnPopover')
  }
  return context
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  wrapper: {
    position: 'relative' as const,
    display: 'inline-block',
  },
  content: {
    position: 'absolute' as const,
    zIndex: 9998,
    padding: RVN_SPACING.s,
    background: RVN_COLORS.surface,
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    boxShadow: RVN_SHADOWS.default,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    color: RVN_COLORS.textMain,
  },
} as const

// -----------------------------------------------------------------------------
// Compound Components
// -----------------------------------------------------------------------------

/**
 * RvnPopover.Trigger - Element that triggers the popover
 */
function Trigger({ children, style }: RvnPopoverTriggerProps) {
  const { isOpen, setIsOpen, triggerId, contentId } = useRvnPopover()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  return React.cloneElement(children, {
    id: triggerId,
    onClick: handleClick,
    'aria-expanded': isOpen,
    'aria-haspopup': 'dialog',
    'aria-controls': isOpen ? contentId : undefined,
    style: { ...children.props.style, ...style },
  })
}

/**
 * RvnPopover.Content - Popover content container
 */
function Content({
  children,
  style,
  minWidth = '200px',
  maxWidth = '400px',
}: RvnPopoverContentProps) {
  const { isOpen, position, contentId, triggerId } = useRvnPopover()

  if (!isOpen) return null

  const contentStyle: React.CSSProperties = {
    ...styles.content,
    ...POSITION_STYLES[position],
    minWidth,
    maxWidth,
    ...style,
  }

  return (
    <div
      id={contentId}
      style={contentStyle}
      role="dialog"
      aria-labelledby={triggerId}
      data-rvn-popover-content=""
      data-position={position}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

/**
 * RvnPopover - Brutalist click popover
 *
 * @example Uncontrolled usage
 * ```tsx
 * <RvnPopover>
 *   <RvnPopover.Trigger>
 *     <RvnButton>OPTIONS</RvnButton>
 *   </RvnPopover.Trigger>
 *   <RvnPopover.Content>
 *     <p>Select an option:</p>
 *     <ul>
 *       <li>Option A</li>
 *       <li>Option B</li>
 *     </ul>
 *   </RvnPopover.Content>
 * </RvnPopover>
 * ```
 *
 * @example Controlled usage
 * ```tsx
 * const [open, setOpen] = useState(false)
 *
 * <RvnPopover open={open} onOpenChange={setOpen}>
 *   <RvnPopover.Trigger>
 *     <button>MENU</button>
 *   </RvnPopover.Trigger>
 *   <RvnPopover.Content>
 *     <button onClick={() => setOpen(false)}>Close</button>
 *   </RvnPopover.Content>
 * </RvnPopover>
 * ```
 */
function RvnPopoverRoot({
  children,
  open: controlledOpen,
  onOpenChange,
  position = 'bottom',
  closeOnOutsideClick = true,
  closeOnEscape = true,
}: RvnPopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const setIsOpen = React.useCallback(
    (open: boolean) => {
      if (!isControlled) {
        setInternalOpen(open)
      }
      onOpenChange?.(open)
    },
    [isControlled, onOpenChange]
  )

  // Generate unique IDs
  const id = React.useId()
  const triggerId = `rvn-popover-trigger-${id}`
  const contentId = `rvn-popover-content-${id}`

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen || !closeOnOutsideClick) return undefined

    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    // Use setTimeout to avoid immediate close on the triggering click
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen, closeOnOutsideClick, setIsOpen])

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen || !closeOnEscape) return undefined

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeOnEscape, setIsOpen])

  const contextValue: RvnPopoverContextValue = {
    isOpen,
    setIsOpen,
    position,
    triggerId,
    contentId,
  }

  return (
    <RvnPopoverContext.Provider value={contextValue}>
      <div ref={wrapperRef} style={styles.wrapper} data-rvn-popover="">
        {children}
      </div>
    </RvnPopoverContext.Provider>
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

RvnPopoverRoot.displayName = 'RvnPopover'
Trigger.displayName = 'RvnPopover.Trigger'
Content.displayName = 'RvnPopover.Content'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnPopover = Object.assign(RvnPopoverRoot, {
  Trigger,
  Content,
})

// Export hook for advanced usage
export { useRvnPopover }
