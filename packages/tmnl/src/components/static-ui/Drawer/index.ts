/**
 * TMNL Drawer Module
 *
 * Exports drawer components and layer-wrapped versions.
 */

import { withLayering } from '@/lib/layers';
import { STATIC_UI_Z_INDEX } from '@/lib/layers/static-ui/types';

// Export all components
export {
  Drawer,
  DrawerRoot,
  DrawerHeader,
  DrawerContent,
  DrawerFooter,
  DrawerNav,
  DrawerSection,
  LeftDrawer,
  RightDrawer,
  type DrawerSide,
  type DrawerRootProps,
  type DrawerHeaderProps,
  type DrawerContentProps,
  type DrawerFooterProps,
  type DrawerNavProps,
  type DrawerSectionProps,
  type LeftDrawerProps,
  type RightDrawerProps,
} from './Drawer';

// Note: Drawers have their own z-index management via motion.div
// Layer wrapping is optional for drawers since they use AnimatePresence
// and manage their own portal-like behavior with fixed positioning
