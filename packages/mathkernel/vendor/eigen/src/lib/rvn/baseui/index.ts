/**
 * RVN Base UI Component Wrappers
 *
 * Brutalist-styled wrappers for Base UI (@base-ui-components/react) components.
 *
 * All wrappers follow the RVN design system:
 * - 3px solid black borders
 * - 0px border radius (sharp corners)
 * - Monospace typography (Courier New)
 * - 4px box shadows
 * - 70% black overlay backdrops
 * - High contrast black/white palette
 *
 * @example
 * ```tsx
 * import { RvnDialog, RvnMenu, RvnTooltip } from '@/lib/rvn/baseui'
 *
 * // Dialog example
 * <RvnDialog.Root open={isOpen} onOpenChange={setIsOpen}>
 *   <RvnDialog.Trigger>
 *     <RvnButton>Open</RvnButton>
 *   </RvnDialog.Trigger>
 *   <RvnDialog.Portal>
 *     <RvnDialog.Backdrop />
 *     <RvnDialog.Popup>
 *       <RvnDialog.Header>
 *         <RvnDialog.Title>Title</RvnDialog.Title>
 *         <RvnDialog.Close />
 *       </RvnDialog.Header>
 *       <RvnDialog.Body>Content</RvnDialog.Body>
 *     </RvnDialog.Popup>
 *   </RvnDialog.Portal>
 * </RvnDialog.Root>
 * ```
 */

// -----------------------------------------------------------------------------
// Overlay Components
// -----------------------------------------------------------------------------

export * from './overlays'

// -----------------------------------------------------------------------------
// Navigation Components
// -----------------------------------------------------------------------------

export * from './navigation'

// -----------------------------------------------------------------------------
// Layout Components
// -----------------------------------------------------------------------------

export * from './layout'

// -----------------------------------------------------------------------------
// Utility Components
// -----------------------------------------------------------------------------

export * from './utility'

// -----------------------------------------------------------------------------
// Form Components
// -----------------------------------------------------------------------------

export * from './forms'
