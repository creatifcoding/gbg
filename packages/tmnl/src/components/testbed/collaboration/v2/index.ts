/**
 * V2 Collaboration Components
 *
 * Self-contained, uilabs-inspired components for autonomous editor panels.
 * Each panel owns its own document selection, connection, and presence.
 *
 * CRITICAL: Wrap with <PanelRegistryProvider> to provide atom context.
 *
 * For real-time sync, also wrap with <DocumentWatchProvider>:
 * ```tsx
 * <PanelRegistryProvider>
 *   <DocumentWatchProvider showIndicator>
 *     <AutonomousEditorPanel ... />
 *   </DocumentWatchProvider>
 * </PanelRegistryProvider>
 * ```
 */

export { PresenceAvatars, type User } from './PresenceAvatars';
export {
  ContextualToolbar,
  ToolbarItem,
  ToolbarDivider,
  ToolbarGroup,
  type ToolbarState,
} from './ContextualToolbar';
export { DocumentDrawer, type RecentDoc } from './DocumentDrawer';
export {
  AutonomousEditorPanel,
  type AutonomousEditorPanelProps,
} from './AutonomousEditorPanel';
export { PanelRegistryProvider } from './panel-stx';

// Real-time sync
export {
  DocumentWatchProvider,
  useDocumentWatchState,
  useOptionalDocumentWatchState,
  type DocumentWatchState,
  type DocumentWatchProviderProps,
} from './DocumentWatchProvider';
