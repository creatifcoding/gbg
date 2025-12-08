/**
 * withCapable HOC
 *
 * Wraps a component to make it "capable" — auto-manages hover/focus state
 * and renders all attached capabilities.
 *
 * @example
 * // Basic usage with entityId prop
 * const CapableButton = withCapable<ButtonProps>()(Button)
 * <CapableButton entityId="my-button">Click</CapableButton>
 *
 * @example
 * // With static entityId
 * const DmgBadge = withCapable({ entityId: 'dmg-badge' })(Badge)
 * <DmgBadge>DMG</DmgBadge>
 *
 * @example
 * // With dynamic entityId from props
 * const FindingCard = withCapable<{ id: string }>(props => `finding-${props.id}`)(Card)
 * <FindingCard id="123">Content</FindingCard>
 */

import {
  forwardRef,
  useState,
  useCallback,
  type ComponentType,
  type ForwardedRef,
  type HTMLAttributes,
  type MouseEvent,
  type FocusEvent,
} from 'react'
import { useEntity } from '@/lib/capabilities/registry'
import type { ClickableData } from '@/lib/capabilities/types'
import { CapabilityRenderer } from './CapabilityRenderer'

// =============================================================================
// TYPES
// =============================================================================

type EntityIdResolver<P> = string | ((props: P) => string)

interface WithCapableOptions<P> {
  /** Static entityId or function to derive from props */
  entityId?: EntityIdResolver<P>
}

interface CapableInjectedProps {
  /** Entity ID for capability lookup (if not provided via options) */
  entityId?: string
}

type CapableProps<P> = P & CapableInjectedProps

// =============================================================================
// CURSOR MAPPING
// =============================================================================

const CURSOR_MAP: Record<NonNullable<ClickableData['cursor']>, string> = {
  pointer: 'cursor-pointer',
  grab: 'cursor-grab',
  cell: 'cursor-cell',
  'zoom-in': 'cursor-zoom-in',
  help: 'cursor-help',
  'not-allowed': 'cursor-not-allowed',
}

// =============================================================================
// HOC IMPLEMENTATION
// =============================================================================

/**
 * Higher-Order Component that wraps a component with capability rendering.
 *
 * The wrapped component receives:
 * - Auto-managed hover/focus state
 * - Auto-rendered capability affordances
 * - Cursor styling from clickable capability
 */
export function withCapable<P extends object>(
  optionsOrResolver?: WithCapableOptions<P> | EntityIdResolver<P>
) {
  // Normalize options
  const options: WithCapableOptions<P> =
    typeof optionsOrResolver === 'function' || typeof optionsOrResolver === 'string'
      ? { entityId: optionsOrResolver }
      : optionsOrResolver ?? {}

  return function wrapper(
    WrappedComponent: ComponentType<P>
  ): ComponentType<CapableProps<P>> {
    const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

    const CapableComponent = forwardRef(function CapableComponent(
      props: CapableProps<P>,
      ref: ForwardedRef<HTMLElement>
    ) {
      const { entityId: propEntityId, ...restProps } = props as CapableProps<P> & { entityId?: string }

      // Resolve entity ID
      const entityId = resolveEntityId(options.entityId, propEntityId, props as P)

      // Auto-managed state
      const [hovered, setHovered] = useState(false)
      const [focused, setFocused] = useState(false)

      // Get entity for cursor styling
      const entity = useEntity(entityId ?? '')

      // Event handlers
      const handleMouseEnter = useCallback((e: MouseEvent) => {
        setHovered(true)
        // Call original handler if exists
        const original = (restProps as HTMLAttributes<HTMLElement>).onMouseEnter
        if (typeof original === 'function') original(e as MouseEvent<HTMLElement>)
      }, [restProps])

      const handleMouseLeave = useCallback((e: MouseEvent) => {
        setHovered(false)
        const original = (restProps as HTMLAttributes<HTMLElement>).onMouseLeave
        if (typeof original === 'function') original(e as MouseEvent<HTMLElement>)
      }, [restProps])

      const handleFocus = useCallback((e: FocusEvent) => {
        setFocused(true)
        const original = (restProps as HTMLAttributes<HTMLElement>).onFocus
        if (typeof original === 'function') original(e as FocusEvent<HTMLElement>)
      }, [restProps])

      const handleBlur = useCallback((e: FocusEvent) => {
        setFocused(false)
        const original = (restProps as HTMLAttributes<HTMLElement>).onBlur
        if (typeof original === 'function') original(e as FocusEvent<HTMLElement>)
      }, [restProps])

      // Compute cursor class from clickable capability
      const cursorClass = entity.clickable?.cursor
        ? CURSOR_MAP[entity.clickable.cursor]
        : ''

      // No entityId = render without capabilities
      if (!entityId) {
        return <WrappedComponent {...(restProps as P)} ref={ref as any} />
      }

      return (
        <div
          className={`relative inline-block ${cursorClass}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          <WrappedComponent {...(restProps as P)} ref={ref as any} />
          <CapabilityRenderer entityId={entityId} hovered={hovered} focused={focused} />
        </div>
      )
    })

    CapableComponent.displayName = `withCapable(${displayName})`

    return CapableComponent as ComponentType<CapableProps<P>>
  }
}

// =============================================================================
// HELPER
// =============================================================================

function resolveEntityId<P>(
  optionId: EntityIdResolver<P> | undefined,
  propId: string | undefined,
  props: P
): string | undefined {
  // Prop takes precedence
  if (propId) return propId

  // Then option resolver
  if (typeof optionId === 'function') {
    return optionId(props)
  }

  if (typeof optionId === 'string') {
    return optionId
  }

  return undefined
}

export default withCapable
