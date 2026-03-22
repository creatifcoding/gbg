/**
 * RVN Navigation Components
 *
 * Brutalist navigation components for the RVN design system.
 *
 * Components:
 * - RvnHeader: Main header with brand, nav, and status slots
 * - RvnNavItem: Navigation item with active/hover states
 * - RvnTabBar: Container for tab buttons
 * - RvnTabButton: Numbered tab with active state
 * - RvnBreadcrumb: Breadcrumb navigation
 * - RvnFooter: Page footer with left/right sections
 * - RvnSidebar: Fixed-width sidebar container
 * - RvnActionRail: Vertical action button strip
 */

export { RvnHeader } from './RvnHeader'
export type {
  RvnHeaderProps,
  RvnHeaderBrandProps,
  RvnHeaderNavProps,
  RvnHeaderStatusProps,
} from './RvnHeader'

export { RvnNavItem } from './RvnNavItem'
export type { RvnNavItemProps } from './RvnNavItem'

export { RvnTabBar } from './RvnTabBar'
export type { RvnTabBarProps } from './RvnTabBar'

export { RvnTabButton } from './RvnTabButton'
export type { RvnTabButtonProps } from './RvnTabButton'

export { RvnBreadcrumb } from './RvnBreadcrumb'
export type { RvnBreadcrumbProps, RvnBreadcrumbItemProps } from './RvnBreadcrumb'

export { RvnFooter } from './RvnFooter'
export type { RvnFooterProps, RvnFooterSectionProps } from './RvnFooter'

export { RvnSidebar } from './RvnSidebar'
export type { RvnSidebarProps, RvnSidebarSectionProps, SidebarSize } from './RvnSidebar'

export { RvnActionRail } from './RvnActionRail'
export type {
  RvnActionRailProps,
  RvnActionRailButtonProps,
  RvnActionRailSpacerProps,
} from './RvnActionRail'
