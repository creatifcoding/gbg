/**
 * RVN Layout Templates
 *
 * Compound component templates for common page layouts.
 * Each template provides named slots for structured composition.
 *
 * Templates:
 * - RvnDashboardLayout: 3-column (sidebar | main | action rail)
 * - RvnBriefingLayout: 2-column (sidebar | main) with large title
 * - RvnTabbedLayout: Single-page with tab navigation
 * - RvnSplitLayout: Hero area + panel grid
 */

export { RvnDashboardLayout } from './RvnDashboardLayout'
export type {
  DashboardLayoutProps,
  DashboardSlotProps,
} from './RvnDashboardLayout'

export { RvnBriefingLayout } from './RvnBriefingLayout'
export type {
  BriefingLayoutProps,
  BriefingSlotProps,
  TitleSlotProps as BriefingTitleSlotProps,
} from './RvnBriefingLayout'

export { RvnTabbedLayout } from './RvnTabbedLayout'
export type {
  TabbedLayoutProps,
  TabbedSlotProps,
  TabbedTitleSlotProps,
  TabProps,
} from './RvnTabbedLayout'

export { RvnSplitLayout } from './RvnSplitLayout'
export type {
  SplitLayoutProps,
  SplitSlotProps,
  SplitTitleSlotProps,
  StatusRowProps,
  PanelGridProps,
} from './RvnSplitLayout'
