/**
 * Trait Factory
 *
 * Create typed trait definitions.
 */

import type { Trait } from './types'

/**
 * Create a trait definition
 *
 * @example
 * const ClickableAffordance = createTrait<ClickableAffordanceSlot>({
 *   id: 'clickable-affordance',
 *   render: (slot) => <GlowRing color={slot.glow} />,
 *   style: (slot) => ({ cursor: slot.cursor ?? 'pointer' }),
 * })
 */
export function createTrait<TSlot>(definition: Trait<TSlot>): Trait<TSlot> {
  return Object.freeze(definition)
}
