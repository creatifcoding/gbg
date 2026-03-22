/**
 * Drawer Renderer (Re-export)
 *
 * This file re-exports from the new unified drawer module for backward compatibility.
 * The actual implementation is in ./drawer/DrawerRendererBase.tsx
 *
 * @deprecated Import from './drawer' directly for new code.
 * @module
 */

export { DrawerRendererBase as DrawerRenderer, DrawerRendererBase as default } from "./drawer"
export type { DrawerRendererProps } from "./drawer"
