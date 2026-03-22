/**
 * RvnTabs - Brutalist Tabs Component
 *
 * Wraps Base UI Tabs with RVN styling:
 * - 3px border tab buttons
 * - Black active tab
 * - Numbered tabs (01, 02, 03)
 * - Right border separator
 *
 * @example
 * ```tsx
 * <RvnTabs.Root defaultValue="overview">
 *   <RvnTabs.List>
 *     <RvnTabs.Tab value="overview" index={1}>Overview</RvnTabs.Tab>
 *     <RvnTabs.Tab value="details" index={2}>Details</RvnTabs.Tab>
 *     <RvnTabs.Tab value="history" index={3} noBorder>History</RvnTabs.Tab>
 *   </RvnTabs.List>
 *   <RvnTabs.Panel value="overview">Overview content</RvnTabs.Panel>
 *   <RvnTabs.Panel value="details">Details content</RvnTabs.Panel>
 *   <RvnTabs.Panel value="history">History content</RvnTabs.Panel>
 * </RvnTabs.Root>
 * ```
 */

import * as React from 'react'
import { Tabs } from '@base-ui-components/react/tabs'
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

export interface RvnTabsRootProps extends React.ComponentProps<typeof Tabs.Root> {}
export interface RvnTabsListProps extends React.ComponentProps<typeof Tabs.List> {
  /** Whether to add a border around the list */
  bordered?: boolean
}

export interface RvnTabsTabProps extends React.ComponentProps<typeof Tabs.Tab> {
  /** Tab index for display (1, 2, 3...) */
  index?: number
  /** Whether to hide the right border */
  noBorder?: boolean
}

export interface RvnTabsPanelProps extends React.ComponentProps<typeof Tabs.Panel> {}
export interface RvnTabsIndicatorProps extends React.ComponentProps<typeof Tabs.Indicator> {}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface RvnTabsContextValue {
  activeValue: string | null
}

const RvnTabsContext = React.createContext<RvnTabsContextValue>({ activeValue: null })

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
  } as React.CSSProperties,
  list: {
    display: 'flex',
    alignItems: 'stretch',
  } as React.CSSProperties,
  listBordered: {
    border: `${RVN_BORDERS.widthPrimary} solid ${RVN_COLORS.border}`,
    background: RVN_COLORS.surface,
  } as React.CSSProperties,
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: RVN_SPACING.xs,
    padding: '12px 24px',
    background: 'transparent',
    border: 'none',
    borderRight: `${RVN_BORDERS.widthPrimary} solid ${RVN_COLORS.border}`,
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    color: RVN_COLORS.textMuted,
    letterSpacing: '0.05em',
    position: 'relative' as const,
  } as React.CSSProperties,
  tabNoBorder: {
    borderRight: 'none',
  } as React.CSSProperties,
  tabActive: {
    background: RVN_COLORS.black,
    color: RVN_COLORS.white,
  } as React.CSSProperties,
  tabHover: {
    background: RVN_COLORS.surfaceHighlight,
    color: RVN_COLORS.textMain,
  } as React.CSSProperties,
  tabIndex: {
    fontFamily: RVN_FONTS.mono,
    fontSize: '10px',
    color: 'inherit',
    opacity: 0.7,
  } as React.CSSProperties,
  panel: {
    padding: RVN_SPACING.m,
    background: RVN_COLORS.surface,
  } as React.CSSProperties,
  indicator: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: RVN_COLORS.black,
  } as React.CSSProperties,
}

// -----------------------------------------------------------------------------
// Utility
// -----------------------------------------------------------------------------

function formatIndex(index: number): string {
  return index.toString().padStart(2, '0')
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

const Root = React.forwardRef<HTMLDivElement, RvnTabsRootProps>(
  ({ style, value, defaultValue, onValueChange, ...props }, ref) => {
    const [activeValue, setActiveValue] = React.useState<string | null>(
      (value ?? defaultValue ?? null) as string | null
    )

    const handleValueChange = React.useCallback(
      (newValue: string | null) => {
        setActiveValue(newValue)
        onValueChange?.(newValue)
      },
      [onValueChange]
    )

    React.useEffect(() => {
      if (value !== undefined) {
        setActiveValue(value as string | null)
      }
    }, [value])

    return (
      <RvnTabsContext.Provider value={{ activeValue }}>
        <Tabs.Root
          ref={ref}
          style={{ ...styles.root, ...style }}
          value={value}
          defaultValue={defaultValue}
          onValueChange={handleValueChange}
          {...props}
        />
      </RvnTabsContext.Provider>
    )
  }
)
Root.displayName = 'RvnTabs.Root'

const List = React.forwardRef<HTMLDivElement, RvnTabsListProps>(
  ({ bordered = false, style, ...props }, ref) => (
    <Tabs.List
      ref={ref}
      style={{
        ...styles.list,
        ...(bordered ? styles.listBordered : {}),
        ...style,
      }}
      {...props}
    />
  )
)
List.displayName = 'RvnTabs.List'

const Tab = React.forwardRef<HTMLButtonElement, RvnTabsTabProps>(
  ({ index, noBorder = false, value, style, children, ...props }, ref) => {
    const { activeValue } = React.useContext(RvnTabsContext)
    const [isHovered, setIsHovered] = React.useState(false)
    const isActive = activeValue === value

    return (
      <Tabs.Tab
        ref={ref}
        value={value}
        style={{
          ...styles.tab,
          ...(noBorder ? styles.tabNoBorder : {}),
          ...(isHovered && !isActive ? styles.tabHover : {}),
          ...(isActive ? styles.tabActive : {}),
          ...style,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {index !== undefined && (
          <span style={styles.tabIndex}>{formatIndex(index)}</span>
        )}
        {children}
      </Tabs.Tab>
    )
  }
)
Tab.displayName = 'RvnTabs.Tab'

const Panel = React.forwardRef<HTMLDivElement, RvnTabsPanelProps>(
  ({ style, ...props }, ref) => (
    <Tabs.Panel
      ref={ref}
      style={{ ...styles.panel, ...style }}
      {...props}
    />
  )
)
Panel.displayName = 'RvnTabs.Panel'

const Indicator = React.forwardRef<HTMLDivElement, RvnTabsIndicatorProps>(
  ({ style, ...props }, ref) => (
    <Tabs.Indicator
      ref={ref}
      style={{ ...styles.indicator, ...style }}
      {...props}
    />
  )
)
Indicator.displayName = 'RvnTabs.Indicator'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnTabs = {
  Root,
  List,
  Tab,
  Panel,
  Indicator,
}

export {
  Root as RvnTabsRoot,
  List as RvnTabsList,
  Tab as RvnTabsTab,
  Panel as RvnTabsPanel,
  Indicator as RvnTabsIndicator,
}
