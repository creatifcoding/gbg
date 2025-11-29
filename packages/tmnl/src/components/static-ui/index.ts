/**
 * TMNL Static UI Components
 *
 * Application chrome elements with layer system integration.
 */

// Header
export { Header, HeaderLayer, type HeaderProps } from './Header';

// Footer
export { StatusFooter, FooterLayer, type StatusFooterProps } from './Footer';

// Drawer
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

// CommandBar
export { CommandBar, type CommandBarProps } from './CommandBar';

// Modal
export { Modal, type ModalProps } from './Modal';

// Canvas Toolbar (requires tldraw context)
export {
  SpawnToolbar,
  ToolsToolbar,
  ZoomToolbar,
  StatusOverlay,
  ActionsToolbar,
  MiniMap,
} from './canvas-toolbar';

// Layer utilities
export * from '@/lib/layers/static-ui';
