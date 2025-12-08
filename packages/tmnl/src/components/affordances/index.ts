/**
 * Affordances Module
 *
 * Visual affordances for the capability system.
 * These components render based on capability data attached to entities.
 *
 * @example
 * // Using withCapable HOC (recommended)
 * const CapableButton = withCapable<ButtonProps>()(Button)
 * <CapableButton entityId="my-btn">Click</CapableButton>
 *
 * @example
 * // Manual usage with CapabilityRenderer
 * <div onMouseEnter={() => setHovered(true)}>
 *   <MyComponent />
 *   <CapabilityRenderer entityId="my-entity" hovered={hovered} />
 * </div>
 */

// Core HOC and renderer
export { withCapable } from './withCapable'
export { CapabilityRenderer, useCapabilityRenderer } from './CapabilityRenderer'
export type { CapabilityRendererProps } from './CapabilityRenderer'

// Individual affordance components
export { GlowRing } from './GlowRing'
export type { GlowRingProps } from './GlowRing'

export { Tooltip } from './Tooltip'
export type { TooltipProps } from './Tooltip'

export { Badge } from './Badge'
export type { BadgeProps } from './Badge'
