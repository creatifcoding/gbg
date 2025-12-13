/**
 * CapabilityRenderer
 *
 * Centralizes ALL capability rendering logic.
 * No more scattered conditionals — this is the single system.
 *
 * Consumer just needs: <CapabilityRenderer entityId={id} hovered={hovered} />
 */

import { useEntity } from '@/lib/capabilities/registry'
import type { EntityComponents } from '@/lib/capabilities/types'
import { GlowRing } from './GlowRing'
import { Tooltip } from './Tooltip'
import { Badge } from './Badge'
import { DraggableAffordance } from './DraggableAffordance'
import { SelectionRing } from './SelectionRing'

export interface CapabilityRendererProps {
  /** Entity ID to render capabilities for */
  entityId: string

  /** Hover state for tooltip visibility */
  hovered?: boolean

  /** Focus state (future use) */
  focused?: boolean

  /** Additional className for wrapper */
  className?: string
}

/**
 * Renders all attached capabilities for an entity.
 *
 * This is the "System" in ECS terms — it processes all components
 * and renders the appropriate affordances.
 */
export function CapabilityRenderer({
  entityId,
  hovered = false,
  focused = false,
  className = '',
}: CapabilityRendererProps) {
  const entity = useEntity(entityId)

  // No capabilities attached? Render nothing.
  if (Object.keys(entity).length === 0) {
    return null
  }

  return (
    <div className={`contents ${className}`}>
      {/* Glowable: ring effect */}
      {entity.glowable && <GlowRing {...entity.glowable} />}

      {/* Tooltippable: hover tooltip */}
      {entity.tooltippable && (
        <Tooltip {...entity.tooltippable} visible={hovered} />
      )}

      {/* Badgeable: corner badge */}
      {entity.badgeable && <Badge {...entity.badgeable} />}

      {/* Draggable: drag handle affordance */}
      {entity.draggable && <DraggableAffordance {...entity.draggable} />}

      {/* Pulsable: handled via glowable.animated for now */}
      {/* Future: dedicated pulse wrapper */}

      {/* Clickable: cursor handled by withCapable */}

      {/* Selectable: selection ring */}
      {entity.selectable && <SelectionRing {...entity.selectable} />}

      {/* Focusable: future focus ring */}
    </div>
  )
}

/**
 * Standalone version that also provides the entity data
 * Useful when you need entity data outside the renderer
 */
export function useCapabilityRenderer(entityId: string) {
  const entity = useEntity(entityId)

  const render = (hovered = false, focused = false) => (
    <CapabilityRenderer
      entityId={entityId}
      hovered={hovered}
      focused={focused}
    />
  )

  return {
    entity,
    render,
    hasCapabilities: Object.keys(entity).length > 0,
  }
}

export default CapabilityRenderer
