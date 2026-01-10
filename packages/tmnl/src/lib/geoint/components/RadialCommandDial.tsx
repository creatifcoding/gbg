/**
 * Radial Command Dial
 *
 * A radial action menu invoked with Ctrl+Click on entities.
 * Actions are derived from entity traits and filtered by context/role.
 *
 * Features:
 * - Radial layout with sections for action groups
 * - Keyboard hotkey bindings
 * - Anime.js animations for open/close/hover
 * - Context-aware action filtering
 *
 * @module geoint/components/RadialCommandDial
 */

import { FC, useCallback, useEffect, useRef, useState, useMemo, createContext, useContext } from 'react'
import { useMachine } from '@xstate/react'
import { animate, createTimeline } from 'animejs'
import type { ComposedEntity } from '../cards/traits'
import type { ActionDefinition } from '../cards/registry'
import { useGroupedActions, useActionExecutor, useHotkeyAction } from '../cards/hooks'
import { TIMING, EASING } from '../tokens'
import {
  radialDialMachine,
  type RadialDialInput,
  type DialPosition,
  type GestureType,
} from '../machines/radialDialMachine'

// =============================================================================
// TYPES
// =============================================================================

export interface RadialCommandDialProps {
  /** Entity to show actions for */
  entity: ComposedEntity | null
  /** Position to display dial at */
  position: { x: number; y: number }
  /** Whether dial is open */
  isOpen: boolean
  /** Called when dial should close */
  onClose: () => void
  /** Optional role filter for actions */
  role?: 'analyst' | 'operator' | 'admin'
}

interface ActionSlice {
  action: ActionDefinition
  startAngle: number
  endAngle: number
  midAngle: number
}

interface SectionConfig {
  group: ActionDefinition['group']
  label: string
  color: string
  startAngle: number
  endAngle: number
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DIAL_RADIUS = 120
const INNER_RADIUS = 40
const SLICE_GAP = 2 // degrees

/** Section configuration - radial layout divided into quadrants */
const SECTION_CONFIG: readonly SectionConfig[] = [
  { group: 'navigation', label: 'Navigate', color: '#3b82f6', startAngle: 315, endAngle: 45 },
  { group: 'primary', label: 'Actions', color: '#22c55e', startAngle: 45, endAngle: 135 },
  { group: 'secondary', label: 'Data', color: '#6b7280', startAngle: 135, endAngle: 225 },
  { group: 'danger', label: 'Danger', color: '#ef4444', startAngle: 225, endAngle: 315 },
]

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert degrees to radians.
 */
const degToRad = (deg: number): number => (deg * Math.PI) / 180

/**
 * Get point on circle at given angle and radius.
 */
const polarToCartesian = (
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } => {
  const angleRad = degToRad(angleDeg - 90) // Offset so 0 degrees is up
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  }
}

/**
 * Generate SVG arc path.
 */
const describeArc = (
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string => {
  const start1 = polarToCartesian(cx, cy, outerRadius, startAngle)
  const end1 = polarToCartesian(cx, cy, outerRadius, endAngle)
  const start2 = polarToCartesian(cx, cy, innerRadius, endAngle)
  const end2 = polarToCartesian(cx, cy, innerRadius, startAngle)

  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1

  return [
    'M', start1.x, start1.y,
    'A', outerRadius, outerRadius, 0, largeArcFlag, 1, end1.x, end1.y,
    'L', start2.x, start2.y,
    'A', innerRadius, innerRadius, 0, largeArcFlag, 0, end2.x, end2.y,
    'Z'
  ].join(' ')
}

/**
 * Distribute actions within a section's angle range.
 */
const distributeActionsInSection = (
  actions: readonly ActionDefinition[],
  section: SectionConfig
): readonly ActionSlice[] => {
  if (actions.length === 0) return []

  const totalAngle = (section.endAngle - section.startAngle + 360) % 360 || 360
  const sliceAngle = (totalAngle - SLICE_GAP * actions.length) / actions.length

  return actions.map((action, i) => {
    const startAngle = section.startAngle + i * (sliceAngle + SLICE_GAP)
    const endAngle = startAngle + sliceAngle
    return {
      action,
      startAngle,
      endAngle,
      midAngle: (startAngle + endAngle) / 2,
    }
  })
}

// =============================================================================
// ACTION SLICE COMPONENT
// =============================================================================

interface ActionSliceProps {
  slice: ActionSlice
  cx: number
  cy: number
  color: string
  isEnabled: boolean
  isHovered: boolean
  onHover: (action: ActionDefinition | null) => void
  onClick: (action: ActionDefinition) => void
}

const ActionSliceComponent: FC<ActionSliceProps> = ({
  slice,
  cx,
  cy,
  color,
  isEnabled,
  isHovered,
  onHover,
  onClick,
}) => {
  const pathRef = useRef<SVGPathElement>(null)
  const { action, startAngle, endAngle, midAngle } = slice

  // Label position
  const labelPos = polarToCartesian(
    cx,
    cy,
    (INNER_RADIUS + DIAL_RADIUS) / 2,
    midAngle
  )

  // Animate hover
  useEffect(() => {
    if (!pathRef.current) return

    animate(pathRef.current, {
      scale: isHovered ? 1.05 : 1,
      opacity: isEnabled ? (isHovered ? 1 : 0.8) : 0.3,
      duration: TIMING.fast,
      easing: EASING.anime.out,
    })
  }, [isHovered, isEnabled])

  return (
    <g
      className="cursor-pointer"
      onMouseEnter={() => isEnabled && onHover(action)}
      onMouseLeave={() => onHover(null)}
      onClick={() => isEnabled && onClick(action)}
    >
      <path
        ref={pathRef}
        d={describeArc(cx, cy, INNER_RADIUS, DIAL_RADIUS, startAngle, endAngle)}
        fill={color}
        opacity={isEnabled ? 0.8 : 0.3}
        className="origin-center"
        style={{ transformBox: 'fill-box' }}
      />
      <text
        x={labelPos.x}
        y={labelPos.y}
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-xs fill-white font-medium pointer-events-none"
        style={{ fontSize: 10 }}
      >
        {action.hotkey && (
          <tspan className="fill-white/60 font-mono">{action.hotkey} </tspan>
        )}
        <tspan>{action.label}</tspan>
      </text>
    </g>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const RadialCommandDial: FC<RadialCommandDialProps> = ({
  entity,
  position,
  isOpen,
  onClose,
  role: _role,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredAction, setHoveredAction] = useState<ActionDefinition | null>(null)

  const groupedActions = useGroupedActions(entity)
  const executeAction = useActionExecutor()
  const handleHotkey = useHotkeyAction(entity)

  // Build slices from grouped actions
  const slicesBySection = useMemo(() => {
    return SECTION_CONFIG.map((section) => ({
      section,
      slices: distributeActionsInSection(groupedActions[section.group], section),
    }))
  }, [groupedActions])

  // Total action count
  const totalActions = useMemo(
    () => slicesBySection.reduce((sum, s) => sum + s.slices.length, 0),
    [slicesBySection]
  )

  // Handle action click
  const handleActionClick = useCallback(
    (action: ActionDefinition) => {
      if (!entity) return
      if (action.isEnabled && !action.isEnabled(entity)) return
      executeAction(action, entity)
      onClose()
    },
    [entity, executeAction, onClose]
  )

  // Keyboard handler
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Try to execute action by hotkey
      if (handleHotkey(e.key)) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleHotkey, onClose])

  // Click outside closes
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Delay to avoid closing immediately on the same click that opened
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Open/close animation
  useEffect(() => {
    if (!containerRef.current) return

    animate(containerRef.current, {
      scale: isOpen ? [0, 1] : [1, 0],
      opacity: isOpen ? [0, 1] : [1, 0],
      duration: TIMING.normal,
      easing: EASING.anime.bounce,
    })
  }, [isOpen])

  if (!entity || totalActions === 0) return null

  const cx = DIAL_RADIUS + 10 // Padding
  const cy = DIAL_RADIUS + 10

  return (
    <div
      ref={containerRef}
      className="fixed z-50 pointer-events-auto"
      style={{
        left: position.x - cx,
        top: position.y - cy,
        opacity: 0,
        transform: 'scale(0)',
      }}
    >
      <svg
        width={(DIAL_RADIUS + 10) * 2}
        height={(DIAL_RADIUS + 10) * 2}
        className="drop-shadow-lg"
      >
        {/* Background circle */}
        <circle
          cx={cx}
          cy={cy}
          r={DIAL_RADIUS}
          className="fill-surface-1/90 stroke-surface-3"
          strokeWidth={2}
        />

        {/* Inner circle (entity indicator) */}
        <circle
          cx={cx}
          cy={cy}
          r={INNER_RADIUS - 5}
          className="fill-surface-2 stroke-surface-3"
          strokeWidth={1}
        />

        {/* Section labels */}
        {SECTION_CONFIG.map((section) => {
          const labelAngle = (section.startAngle + section.endAngle) / 2
          const labelPos = polarToCartesian(cx, cy, DIAL_RADIUS + 5, labelAngle)
          return (
            <text
              key={section.group}
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-foreground-tertiary font-medium"
              style={{ fontSize: 8 }}
            >
              {section.label.toUpperCase()}
            </text>
          )
        })}

        {/* Action slices */}
        {slicesBySection.map(({ section, slices }) =>
          slices.map((slice) => (
            <ActionSliceComponent
              key={slice.action.id}
              slice={slice}
              cx={cx}
              cy={cy}
              color={section.color}
              isEnabled={
                !slice.action.isEnabled || slice.action.isEnabled(entity)
              }
              isHovered={hoveredAction === slice.action}
              onHover={setHoveredAction}
              onClick={handleActionClick}
            />
          ))
        )}

        {/* Center text (entity info) */}
        <text
          x={cx}
          y={cy - 5}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs fill-foreground-secondary font-medium"
        >
          {entity.entityId.split(':')[0]}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs fill-foreground-tertiary font-mono"
          style={{ fontSize: 8 }}
        >
          ESC to close
        </text>
      </svg>

      {/* Hovered action tooltip */}
      {hoveredAction && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-surface-2 rounded text-xs whitespace-nowrap"
        >
          <div className="font-medium">{hoveredAction.label}</div>
          {hoveredAction.description && (
            <div className="text-foreground-tertiary">{hoveredAction.description}</div>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// HOOK FOR DIAL STATE
// =============================================================================

export interface UseRadialDialResult {
  isOpen: boolean
  position: { x: number; y: number }
  entity: ComposedEntity | null
  open: (entity: ComposedEntity, x: number, y: number) => void
  close: () => void
}

/**
 * Hook to manage radial dial state.
 */
export const useRadialDial = (): UseRadialDialResult => {
  const [state, setState] = useState<{
    isOpen: boolean
    position: { x: number; y: number }
    entity: ComposedEntity | null
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    entity: null,
  })

  const open = useCallback((entity: ComposedEntity, x: number, y: number) => {
    setState({ isOpen: true, position: { x, y }, entity })
  }, [])

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  return {
    ...state,
    open,
    close,
  }
}

/**
 * Hook to handle Ctrl+Click for opening dial.
 */
export const useCtrlClickDial = (
  dial: UseRadialDialResult,
  getEntityAtPosition: (x: number, y: number) => ComposedEntity | null
) => {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!e.ctrlKey && !e.metaKey) return

      const entity = getEntityAtPosition(e.clientX, e.clientY)
      if (entity) {
        e.preventDefault()
        dial.open(entity, e.clientX, e.clientY)
      }
    }

    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [dial, getEntityAtPosition])
}

// =============================================================================
// XSTATE-ENHANCED VERSION
// =============================================================================

export interface XStateRadialDialContextValue {
  /** XState machine snapshot */
  machineState: ReturnType<typeof radialDialMachine.getInitialSnapshot>
  /** XState send function */
  send: ReturnType<typeof useMachine<typeof radialDialMachine>>[1]
  /** Whether dial is open */
  isOpen: boolean
  /** Current position */
  position: DialPosition
  /** Entity being acted on */
  entity: ComposedEntity | null
  /** Gesture type that opened dial */
  openGesture: GestureType
  /** Open the dial */
  open: (entity: ComposedEntity, position: DialPosition, gesture?: GestureType) => void
  /** Close the dial */
  close: () => void
  /** Close with action selection */
  selectAction: (actionId: string) => void
}

const XStateRadialDialContext = createContext<XStateRadialDialContextValue | null>(null)

export const useXStateRadialDial = () => {
  const ctx = useContext(XStateRadialDialContext)
  if (!ctx) throw new Error('useXStateRadialDial must be used within RadialDialWithMachine.Provider')
  return ctx
}

export interface RadialDialProviderProps {
  /** Children */
  children: React.ReactNode
  /** Entity lookup function */
  getEntity: (entityId: string) => ComposedEntity | null
  /** Callback when action is selected */
  onActionSelect?: (actionId: string, entity: ComposedEntity) => void
  /** Long press threshold in ms */
  longPressThreshold?: number
  /** Drag threshold in pixels */
  dragThreshold?: number
}

/**
 * XState-enhanced Radial Dial Provider
 *
 * Provides context for radial dial with gesture support:
 * - Long press to open
 * - Drag gesture detection
 * - Keyboard navigation
 */
export const RadialDialProvider: FC<RadialDialProviderProps> = ({
  children,
  getEntity,
  onActionSelect,
  longPressThreshold,
  dragThreshold,
}) => {
  const [entity, setEntity] = useState<ComposedEntity | null>(null)

  const machineInput: RadialDialInput = useMemo(() => ({
    longPressThreshold,
    dragThreshold,
  }), [longPressThreshold, dragThreshold])

  const [state, send, actor] = useMachine(radialDialMachine, {
    input: machineInput,
  })

  // Handle emitted events
  useEffect(() => {
    const subscription = actor.on('*', (event) => {
      if (event.type === 'onOpen') {
        const openEvent = event as { entityId: string }
        const foundEntity = getEntity(openEvent.entityId)
        setEntity(foundEntity)
      } else if (event.type === 'onClose') {
        setEntity(null)
      } else if (event.type === 'onActionSelect') {
        const selectEvent = event as { actionId: string; entityId: string }
        const foundEntity = getEntity(selectEvent.entityId)
        if (foundEntity && onActionSelect) {
          onActionSelect(selectEvent.actionId, foundEntity)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [actor, getEntity, onActionSelect])

  const open = useCallback((e: ComposedEntity, position: DialPosition, gesture?: GestureType) => {
    send({ type: 'OPEN', entityId: e.entityId, position, gesture })
    setEntity(e)
  }, [send])

  const close = useCallback(() => {
    send({ type: 'CLOSE' })
  }, [send])

  const selectAction = useCallback((actionId: string) => {
    send({ type: 'CLOSE_WITH_SELECTION', actionId })
  }, [send])

  const isOpen = state.matches('open') || state.matches('opening') || state.matches('selecting')

  const contextValue: XStateRadialDialContextValue = {
    machineState: state,
    send,
    isOpen,
    position: state.context.position,
    entity,
    openGesture: state.context.openGesture,
    open,
    close,
    selectAction,
  }

  return (
    <XStateRadialDialContext.Provider value={contextValue}>
      {children}
    </XStateRadialDialContext.Provider>
  )
}

export interface XStateRadialDialProps {
  /** Role filter for actions */
  role?: 'analyst' | 'operator' | 'admin'
}

/**
 * XState-enhanced Radial Command Dial
 *
 * Uses the XState machine for state management with enhanced animations.
 */
export const XStateRadialDial: FC<XStateRadialDialProps> = ({
  role: _role,
}) => {
  const { machineState, send, isOpen, position, entity, close, selectAction } = useXStateRadialDial()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredAction, setHoveredAction] = useState<ActionDefinition | null>(null)

  const groupedActions = useGroupedActions(entity)
  const executeAction = useActionExecutor()
  const handleHotkey = useHotkeyAction(entity)

  // Build slices from grouped actions
  const slicesBySection = useMemo(() => {
    return SECTION_CONFIG.map((section) => ({
      section,
      slices: distributeActionsInSection(groupedActions[section.group], section),
    }))
  }, [groupedActions])

  // Total action count
  const totalActions = useMemo(
    () => slicesBySection.reduce((sum, s) => sum + s.slices.length, 0),
    [slicesBySection]
  )

  // Handle action click
  const handleActionClick = useCallback(
    (action: ActionDefinition) => {
      if (!entity) return
      if (action.isEnabled && !action.isEnabled(entity)) return
      executeAction(action, entity)
      selectAction(action.id)
    },
    [entity, executeAction, selectAction]
  )

  // Keyboard handler
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        send({ type: 'ESCAPE' })
        return
      }

      // Arrow keys for section navigation
      if (e.key === 'ArrowRight') {
        send({ type: 'NAV_NEXT_SECTION' })
        return
      }
      if (e.key === 'ArrowLeft') {
        send({ type: 'NAV_PREV_SECTION' })
        return
      }
      if (e.key === 'ArrowDown') {
        send({ type: 'NAV_NEXT_ACTION' })
        return
      }
      if (e.key === 'ArrowUp') {
        send({ type: 'NAV_PREV_ACTION' })
        return
      }
      if (e.key === 'Enter') {
        send({ type: 'SELECT_FOCUSED' })
        return
      }

      // Try to execute action by hotkey
      if (handleHotkey(e.key)) {
        close()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleHotkey, close, send])

  // Click outside closes
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close()
      }
    }

    const timer = setTimeout(() => {
      window.addEventListener('click', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen, close])

  // Enhanced open/close animation with timeline
  useEffect(() => {
    if (!containerRef.current) return

    const animationPhase = machineState.context.animationPhase

    if (animationPhase === 'opening') {
      const timeline = createTimeline({ defaults: { easing: EASING.anime.bounce } })

      // Container scale in
      timeline.add(containerRef.current, {
        scale: [0, 1],
        opacity: [0, 1],
        duration: TIMING.normal,
      })

      // Stagger the slices
      const slices = containerRef.current.querySelectorAll('.action-slice')
      slices.forEach((slice, i) => {
        timeline.add(slice, {
          scale: [0.8, 1],
          opacity: [0, 1],
          duration: TIMING.fast,
        }, i * 30)
      })
    } else if (animationPhase === 'closing') {
      animate(containerRef.current, {
        scale: [1, 0],
        opacity: [1, 0],
        duration: TIMING.fast,
        easing: EASING.anime.in,
      })
    } else if (animationPhase === 'selecting') {
      // Pulse animation for selection
      animate(containerRef.current, {
        scale: [1, 1.1, 0],
        opacity: [1, 1, 0],
        duration: TIMING.normal,
        easing: EASING.anime.out,
      })
    }
  }, [machineState.context.animationPhase])

  if (!entity || totalActions === 0) return null

  const cx = DIAL_RADIUS + 10
  const cy = DIAL_RADIUS + 10

  return (
    <div
      ref={containerRef}
      className="fixed z-50 pointer-events-auto"
      style={{
        left: position.x - cx,
        top: position.y - cy,
        opacity: 0,
        transform: 'scale(0)',
      }}
    >
      <svg
        width={(DIAL_RADIUS + 10) * 2}
        height={(DIAL_RADIUS + 10) * 2}
        className="drop-shadow-lg"
      >
        {/* Background circle */}
        <circle
          cx={cx}
          cy={cy}
          r={DIAL_RADIUS}
          className="fill-surface-1/90 stroke-surface-3"
          strokeWidth={2}
        />

        {/* Inner circle (entity indicator) */}
        <circle
          cx={cx}
          cy={cy}
          r={INNER_RADIUS - 5}
          className="fill-surface-2 stroke-surface-3"
          strokeWidth={1}
        />

        {/* Section labels */}
        {SECTION_CONFIG.map((section) => {
          const labelAngle = (section.startAngle + section.endAngle) / 2
          const labelPos = polarToCartesian(cx, cy, DIAL_RADIUS + 5, labelAngle)
          return (
            <text
              key={section.group}
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-foreground-tertiary font-medium"
              style={{ fontSize: 8 }}
            >
              {section.label.toUpperCase()}
            </text>
          )
        })}

        {/* Action slices */}
        {slicesBySection.map(({ section, slices }) =>
          slices.map((slice) => (
            <ActionSliceComponent
              key={slice.action.id}
              slice={slice}
              cx={cx}
              cy={cy}
              color={section.color}
              isEnabled={
                !slice.action.isEnabled || slice.action.isEnabled(entity)
              }
              isHovered={hoveredAction === slice.action}
              onHover={setHoveredAction}
              onClick={handleActionClick}
            />
          ))
        )}

        {/* Center text (entity info) */}
        <text
          x={cx}
          y={cy - 5}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs fill-foreground-secondary font-medium"
        >
          {entity.entityId.split(':')[0]}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs fill-foreground-tertiary font-mono"
          style={{ fontSize: 8 }}
        >
          ESC to close
        </text>
      </svg>

      {/* Hovered action tooltip */}
      {hoveredAction && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-surface-2 rounded text-xs whitespace-nowrap"
        >
          <div className="font-medium">{hoveredAction.label}</div>
          {hoveredAction.description && (
            <div className="text-foreground-tertiary">{hoveredAction.description}</div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Hook to handle gesture detection for opening dial.
 * Supports: Ctrl+Click, Long Press, Drag
 */
export const useGestureDialTrigger = (
  getEntityAtPosition: (x: number, y: number) => ComposedEntity | null
) => {
  const { send, open } = useXStateRadialDial()

  useEffect(() => {
    // Ctrl+Click handler
    const handleClick = (e: MouseEvent) => {
      if (!e.ctrlKey && !e.metaKey) return

      const entity = getEntityAtPosition(e.clientX, e.clientY)
      if (entity) {
        e.preventDefault()
        open(entity, { x: e.clientX, y: e.clientY }, 'click')
      }
    }

    // Pointer down for gesture detection
    const handlePointerDown = (e: PointerEvent) => {
      const entity = getEntityAtPosition(e.clientX, e.clientY)
      if (entity) {
        send({
          type: 'POINTER_DOWN',
          position: { x: e.clientX, y: e.clientY },
          entityId: entity.entityId,
        })
      }
    }

    const handlePointerMove = (e: PointerEvent) => {
      send({
        type: 'POINTER_MOVE',
        position: { x: e.clientX, y: e.clientY },
      })
    }

    const handlePointerUp = (e: PointerEvent) => {
      send({
        type: 'POINTER_UP',
        position: { x: e.clientX, y: e.clientY },
      })
    }

    window.addEventListener('click', handleClick)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [send, open, getEntityAtPosition])
}

/** Compound export for XState-enhanced version */
export const RadialDialWithMachine = Object.assign(XStateRadialDial, {
  Provider: RadialDialProvider,
  Dial: XStateRadialDial,
})

export default RadialCommandDial
