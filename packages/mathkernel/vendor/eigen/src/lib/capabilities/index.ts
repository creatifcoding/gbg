/**
 * Capability System
 *
 * ECS-inspired capability injection for React components.
 *
 * Entity = targetId (the thing being injected into)
 * Component = Capability data (glowable, tooltippable, etc.)
 * System = Render components (GlowRing, Tooltip, Badge)
 *
 * @example
 * // RECOMMENDED: Use withCapable HOC for minimal boilerplate
 * const CapableButton = withCapable<ButtonProps>()(Button)
 * <CapableButton entityId="my-btn">Click</CapableButton>
 *
 * @example
 * // Manual: Consumer declares what capabilities it handles
 * function DmgBadge({ id }: { id: string }) {
 *   const entity = useEntity(id)
 *   const [hovered, setHovered] = useState(false)
 *
 *   return (
 *     <span style={{ position: 'relative' }}>
 *       DMG
 *       <CapabilityRenderer entityId={id} hovered={hovered} />
 *     </span>
 *   )
 * }
 *
 * // Injector attaches capabilities by name
 * function Injector({ targetId }: { targetId: string }) {
 *   const { attach } = useAttach()
 *
 *   useEffect(() => {
 *     attach(targetId, 'glowable', { color: 'orange' })
 *     attach(targetId, 'tooltippable', { text: 'Click to view' })
 *   }, [])
 *
 *   return null
 * }
 */

// Provider & Hooks
export {
  CapabilityProvider,
  useCapabilityContext,
  useCapabilityContextOptional,
  useCapability,
  useCapabilities,
  useEntity,
  useHasCapability,
  useAttach,
  useAttachOnMount,
} from './registry'

// Affordances (canonical render components + HOC)
export {
  withCapable,
  CapabilityRenderer,
  useCapabilityRenderer,
  GlowRing,
  Tooltip,
  Badge,
} from '@/components/affordances'

export type {
  CapabilityRendererProps,
  GlowRingProps,
  TooltipProps,
  BadgeProps,
} from '@/components/affordances'

// Types
export type {
  CapabilityMap,
  CapabilityName,
  EntityId,
  EntityComponents,
  GlowableData,
  TooltippableData,
  PulsableData,
  BadgeableData,
  ClickableData,
  DraggableData,
  SelectableData,
  FocusableData,
} from './types'

// Design Tokens
export { COLORS, TIMING, EASING, GEOMETRY, Z_INDEX, TYPOGRAPHY, type AccentColor } from './tokens'
