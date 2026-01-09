/**
 * Mission Planner Component
 *
 * Compound component for mission planning workflows:
 * - Objective list with drag-and-drop reordering
 * - Waypoint placement on map
 * - Resource allocation matrix
 * - Mission timeline with phases
 * - Progress tracking
 *
 * ASCII Layout:
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ ┌─ HEADER ────────────────────────────────────────────────────────────┐   │
 * │ │ Mission Alpha │ Phase: PLANNING │ Progress ████████░░ 75% │ Actions │   │
 * │ └────────────────────────────────────────────────────────────────────┘   │
 * │ ┌─ SIDEBAR ──────┐┌─────────────── MAP ──────────────────┐┌─ TIMELINE ─┐ │
 * │ │ [Objectives]   ││                                      ││            │ │
 * │ │ ├─ ● Alpha     ││    ◆ Start                           ││ ▐▌ Obj 1   │ │
 * │ │ │   ↳ Res: 2   ││         ↘                            ││ ▐▌ Obj 2   │ │
 * │ │ ├─ ○ Beta      ││           ◇ Checkpoint               ││ ▐▌ Obj 3   │ │
 * │ │ │   ↳ Res: 1   ││              ↘                       ││            │ │
 * │ │ └─ ○ Gamma     ││                ◆ Target              ││ ──────────│ │
 * │ │                ││                   ↘                  ││ 14:00     │ │
 * │ │ [Waypoints]    ││                     ◇ Rally          ││ 15:30     │ │
 * │ │ ├─ ◆ Start     ││                        ↘             ││ 17:00     │ │
 * │ │ ├─ ◇ CP-1      ││                          ◆ Extract   ││            │ │
 * │ │ └─ ◆ Target    ││                                      ││            │ │
 * │ │                ││     [Dependency Lines]               ││            │ │
 * │ │ [Resources]    ││     [Resource Markers]               ││            │ │
 * │ │ ├─ Team A (2)  ││                                      ││            │ │
 * │ │ └─ Team B (3)  ││                                      ││            │ │
 * │ └────────────────┘└──────────────────────────────────────┘└────────────┘ │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * @module geoint/components/MissionPlanner
 */

import * as React from 'react'
import { createContext, useContext, useCallback, useMemo } from 'react'
import { useMachine } from '@xstate/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import {
  missionPlannerMachine,
  PHASE_ORDER,
  WAYPOINT_COLORS,
  type MissionPlannerContext as MissionPlannerState,
  type MissionPlannerEvent,
  type MissionPhase,
  type Objective,
  type ObjectiveStatus,
  type ObjectivePriority,
  type Waypoint,
  type WaypointType,
  type Resource,
  type ResourceType,
  type MissionPlannerInput,
} from '../machines/missionPlannerMachine'

// =============================================================================
// CONTEXT
// =============================================================================

interface MissionPlannerContextValue {
  state: MissionPlannerState
  send: (event: MissionPlannerEvent) => void
  // Computed values
  canEdit: boolean
  selectedObjective: Objective | null
  selectedWaypoint: Waypoint | null
  selectedResource: Resource | null
  objectivesByPriority: Record<ObjectivePriority, Objective[]>
  waypointsByType: Record<WaypointType, Waypoint[]>
  resourcesByType: Record<ResourceType, Resource[]>
  availableResources: Resource[]
  assignedResources: Resource[]
}

const MissionPlannerContext = createContext<MissionPlannerContextValue | null>(null)

function useMissionPlanner() {
  const context = useContext(MissionPlannerContext)
  if (!context) {
    throw new Error('useMissionPlanner must be used within MissionPlanner.Root')
  }
  return context
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

interface RootProps {
  children: React.ReactNode
  input?: MissionPlannerInput
  className?: string
  onPhaseChange?: (phase: MissionPhase) => void
  onProgressUpdate?: (progress: number) => void
}

function Root({ children, input = {}, className, onPhaseChange, onProgressUpdate }: RootProps) {
  const [snapshot, send] = useMachine(missionPlannerMachine, { input })
  const state = snapshot.context

  // Subscribe to emitted events
  React.useEffect(() => {
    // XState v5 emitted events would be handled here
    // For now, use callbacks directly
  }, [onPhaseChange, onProgressUpdate])

  // Computed values
  const canEdit = state.phase === 'planning'

  const selectedObjective = useMemo(
    () => state.objectives.find(o => o.id === state.selectedObjectiveId) ?? null,
    [state.objectives, state.selectedObjectiveId]
  )

  const selectedWaypoint = useMemo(
    () => state.waypoints.find(w => w.id === state.selectedWaypointId) ?? null,
    [state.waypoints, state.selectedWaypointId]
  )

  const selectedResource = useMemo(
    () => state.resources.find(r => r.id === state.selectedResourceId) ?? null,
    [state.resources, state.selectedResourceId]
  )

  const objectivesByPriority = useMemo(() => {
    const grouped: Record<ObjectivePriority, Objective[]> = {
      critical: [],
      high: [],
      medium: [],
      low: []
    }
    state.objectives.forEach(o => grouped[o.priority].push(o))
    return grouped
  }, [state.objectives])

  const waypointsByType = useMemo(() => {
    const grouped: Record<WaypointType, Waypoint[]> = {
      start: [],
      checkpoint: [],
      target: [],
      rally: [],
      extraction: [],
      observation: []
    }
    state.waypoints.forEach(w => grouped[w.type].push(w))
    return grouped
  }, [state.waypoints])

  const resourcesByType = useMemo(() => {
    const grouped: Record<ResourceType, Resource[]> = {
      personnel: [],
      vehicle: [],
      equipment: [],
      comms: [],
      intel: []
    }
    state.resources.forEach(r => grouped[r.type].push(r))
    return grouped
  }, [state.resources])

  const availableResources = useMemo(
    () => state.resources.filter(r => r.status === 'available'),
    [state.resources]
  )

  const assignedResources = useMemo(
    () => state.resources.filter(r => r.status === 'assigned'),
    [state.resources]
  )

  const contextValue: MissionPlannerContextValue = {
    state,
    send,
    canEdit,
    selectedObjective,
    selectedWaypoint,
    selectedResource,
    objectivesByPriority,
    waypointsByType,
    resourcesByType,
    availableResources,
    assignedResources,
  }

  return (
    <MissionPlannerContext.Provider value={contextValue}>
      <div className={cn('flex flex-col h-full bg-surface-0', className)}>
        {children}
      </div>
    </MissionPlannerContext.Provider>
  )
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

interface HeaderProps {
  className?: string
  children?: React.ReactNode
}

function Header({ className, children }: HeaderProps) {
  const { state, send } = useMissionPlanner()

  const phaseColors: Record<MissionPhase, string> = {
    planning: 'bg-blue-500/20 text-blue-400',
    briefing: 'bg-amber-500/20 text-amber-400',
    execution: 'bg-green-500/20 text-green-400',
    review: 'bg-purple-500/20 text-purple-400',
    archived: 'bg-zinc-500/20 text-zinc-400'
  }

  return (
    <header className={cn(
      'flex items-center justify-between px-4 py-3',
      'border-b border-white/10 bg-surface-1/50 backdrop-blur-sm',
      className
    )}>
      <div className="flex items-center gap-4">
        {/* Mission Name */}
        <h1 className="text-lg font-medium text-white">
          {state.missionName}
        </h1>

        {/* Phase Badge */}
        <span className={cn(
          'px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider',
          phaseColors[state.phase]
        )}>
          {state.phase}
        </span>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">Progress</span>
          <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-cyan to-accent-blue transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <span className="text-xs font-mono text-white/80">{state.progress}%</span>
        </div>

        {/* Phase Controls */}
        {state.phase !== 'archived' && (
          <button
            onClick={() => send({ type: 'ADVANCE_PHASE' })}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-medium',
              'bg-accent-cyan/20 text-accent-cyan',
              'hover:bg-accent-cyan/30 transition-colors'
            )}
          >
            Advance to {PHASE_ORDER[PHASE_ORDER.indexOf(state.phase) + 1]}
          </button>
        )}

        {children}
      </div>
    </header>
  )
}

// =============================================================================
// SIDEBAR COMPONENT
// =============================================================================

interface SidebarProps {
  className?: string
  children?: React.ReactNode
}

function Sidebar({ className, children }: SidebarProps) {
  const { state, send } = useMissionPlanner()

  const panels = [
    { id: 'objectives' as const, label: 'Objectives', count: state.objectives.length },
    { id: 'waypoints' as const, label: 'Waypoints', count: state.waypoints.length },
    { id: 'resources' as const, label: 'Resources', count: state.resources.length },
    { id: 'timeline' as const, label: 'Timeline', count: state.timeline?.phases.length ?? 0 },
  ]

  return (
    <aside className={cn(
      'flex flex-col w-72 border-r border-white/10 bg-surface-1/30',
      className
    )}>
      {/* Panel Tabs */}
      <div className="flex border-b border-white/10">
        {panels.map(panel => (
          <button
            key={panel.id}
            onClick={() => send({ type: 'SET_ACTIVE_PANEL', panel: panel.id })}
            className={cn(
              'flex-1 px-2 py-2 text-xs font-medium transition-colors',
              state.activePanel === panel.id
                ? 'text-accent-cyan border-b-2 border-accent-cyan bg-accent-cyan/5'
                : 'text-white/60 hover:text-white/80'
            )}
          >
            {panel.label}
            {panel.count > 0 && (
              <span className="ml-1 text-xs opacity-60">({panel.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </aside>
  )
}

// =============================================================================
// OBJECTIVE LIST COMPONENT
// =============================================================================

interface ObjectiveListProps {
  className?: string
}

function ObjectiveList({ className }: ObjectiveListProps) {
  const { state, send, canEdit } = useMissionPlanner()
  const parentRef = React.useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: state.objectives.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  })

  const statusIcons: Record<ObjectiveStatus, string> = {
    pending: '○',
    in_progress: '◐',
    completed: '●',
    failed: '✕',
    cancelled: '⊘'
  }

  const priorityColors: Record<ObjectivePriority, string> = {
    critical: 'text-red-400 border-red-400/30',
    high: 'text-amber-400 border-amber-400/30',
    medium: 'text-blue-400 border-blue-400/30',
    low: 'text-zinc-400 border-zinc-400/30'
  }

  if (state.activePanel !== 'objectives') return null

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Add Button */}
      {canEdit && (
        <div className="p-2 border-b border-white/5">
          <button
            onClick={() => send({
              type: 'ADD_OBJECTIVE',
              objective: {
                name: `Objective ${state.objectives.length + 1}`,
                description: '',
                status: 'pending',
                priority: 'medium',
                assignedResources: [],
                waypoints: [],
                dependencies: [],
                estimatedDuration: 60,
                notes: []
              }
            })}
            className={cn(
              'w-full px-3 py-2 rounded text-xs font-medium',
              'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20',
              'hover:bg-accent-cyan/20 transition-colors'
            )}
          >
            + Add Objective
          </button>
        </div>
      )}

      {/* Virtual List */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const objective = state.objectives[virtualRow.index]
            const isSelected = objective.id === state.selectedObjectiveId

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <button
                  onClick={() => send({ type: 'SELECT_OBJECTIVE', id: objective.id })}
                  className={cn(
                    'w-full p-3 text-left transition-colors',
                    'border-b border-white/5',
                    isSelected
                      ? 'bg-accent-cyan/10'
                      : 'hover:bg-white/5'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {/* Status Icon */}
                    <span className={cn(
                      'text-sm',
                      objective.status === 'completed' ? 'text-green-400' :
                      objective.status === 'failed' ? 'text-red-400' :
                      objective.status === 'in_progress' ? 'text-amber-400' :
                      'text-white/40'
                    )}>
                      {statusIcons[objective.status]}
                    </span>

                    <div className="flex-1 min-w-0">
                      {/* Name */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white truncate">
                          {objective.name}
                        </span>
                        <span className={cn(
                          'px-1.5 py-0.5 text-xs font-medium rounded border',
                          priorityColors[objective.priority]
                        )}>
                          {objective.priority.slice(0, 1).toUpperCase()}
                        </span>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
                        <span>{objective.assignedResources.length} resources</span>
                        <span>•</span>
                        <span>{objective.waypoints.length} waypoints</span>
                        <span>•</span>
                        <span>{objective.estimatedDuration}m</span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// WAYPOINT LIST COMPONENT
// =============================================================================

interface WaypointListProps {
  className?: string
}

function WaypointList({ className }: WaypointListProps) {
  const { state, send, canEdit } = useMissionPlanner()

  const waypointTypes: WaypointType[] = ['start', 'checkpoint', 'target', 'rally', 'extraction', 'observation']

  if (state.activePanel !== 'waypoints') return null

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Waypoint Type Buttons */}
      {canEdit && (
        <div className="p-2 border-b border-white/5">
          <div className="text-xs text-white/40 mb-2">Place Waypoint</div>
          <div className="grid grid-cols-3 gap-1">
            {waypointTypes.map(type => (
              <button
                key={type}
                onClick={() => send({ type: 'START_WAYPOINT_PLACEMENT', waypointType: type })}
                className={cn(
                  'px-2 py-1.5 rounded text-xs font-medium transition-colors',
                  'border',
                  state.placingWaypointType === type
                    ? 'bg-white/10 border-white/20'
                    : 'border-white/5 hover:border-white/10'
                )}
                style={{ color: WAYPOINT_COLORS[type] }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Waypoint List */}
      <div className="flex-1 overflow-auto">
        {state.waypoints.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-white/40">
            No waypoints placed
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {state.waypoints.map((waypoint, index) => {
              const isSelected = waypoint.id === state.selectedWaypointId

              return (
                <button
                  key={waypoint.id}
                  onClick={() => send({ type: 'SELECT_WAYPOINT', id: waypoint.id })}
                  className={cn(
                    'w-full p-3 text-left transition-colors',
                    isSelected ? 'bg-accent-cyan/10' : 'hover:bg-white/5'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {/* Icon */}
                    <span
                      className="text-lg"
                      style={{ color: WAYPOINT_COLORS[waypoint.type] }}
                    >
                      {waypoint.type === 'start' || waypoint.type === 'target' || waypoint.type === 'extraction'
                        ? '◆' : '◇'}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {waypoint.name}
                      </div>
                      <div className="text-xs text-white/40">
                        {waypoint.position[1].toFixed(4)}, {waypoint.position[0].toFixed(4)}
                      </div>
                    </div>

                    {/* Order */}
                    <span className="text-xs text-white/20 font-mono">
                      #{index + 1}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// RESOURCE LIST COMPONENT
// =============================================================================

interface ResourceListProps {
  className?: string
}

function ResourceList({ className }: ResourceListProps) {
  const { state, send, canEdit, resourcesByType } = useMissionPlanner()

  const resourceTypeIcons: Record<ResourceType, string> = {
    personnel: '👤',
    vehicle: '🚗',
    equipment: '🔧',
    comms: '📡',
    intel: '📊'
  }

  if (state.activePanel !== 'resources') return null

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Add Resource */}
      {canEdit && (
        <div className="p-2 border-b border-white/5">
          <button
            onClick={() => send({
              type: 'ADD_RESOURCE',
              resource: {
                name: `Resource ${state.resources.length + 1}`,
                type: 'personnel',
                status: 'available',
              }
            })}
            className={cn(
              'w-full px-3 py-2 rounded text-xs font-medium',
              'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20',
              'hover:bg-accent-cyan/20 transition-colors'
            )}
          >
            + Add Resource
          </button>
        </div>
      )}

      {/* Resource Groups */}
      <div className="flex-1 overflow-auto">
        {Object.entries(resourcesByType).map(([type, resources]) => {
          if (resources.length === 0) return null

          return (
            <div key={type} className="border-b border-white/5">
              {/* Group Header */}
              <div className="px-3 py-2 bg-white/5">
                <span className="text-xs text-white/60 uppercase tracking-wider">
                  {resourceTypeIcons[type as ResourceType]} {type}
                </span>
                <span className="ml-2 text-xs text-white/40">
                  ({resources.length})
                </span>
              </div>

              {/* Resources */}
              {resources.map(resource => {
                const isSelected = resource.id === state.selectedResourceId

                return (
                  <button
                    key={resource.id}
                    onClick={() => send({ type: 'SELECT_RESOURCE', id: resource.id })}
                    className={cn(
                      'w-full p-3 text-left transition-colors',
                      isSelected ? 'bg-accent-cyan/10' : 'hover:bg-white/5'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white">{resource.name}</span>
                      <span className={cn(
                        'px-1.5 py-0.5 text-xs rounded',
                        resource.status === 'available'
                          ? 'bg-green-500/20 text-green-400'
                          : resource.status === 'assigned'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-red-500/20 text-red-400'
                      )}>
                        {resource.status}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// TIMELINE PANEL COMPONENT
// =============================================================================

interface TimelinePanelProps {
  className?: string
}

function TimelinePanel({ className }: TimelinePanelProps) {
  const { state, send } = useMissionPlanner()

  if (state.activePanel !== 'timeline') return null

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Controls */}
      <div className="p-2 border-b border-white/5 space-y-2">
        <button
          onClick={() => send({ type: 'CALCULATE_TIMELINE' })}
          className={cn(
            'w-full px-3 py-2 rounded text-xs font-medium',
            'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20',
            'hover:bg-accent-cyan/20 transition-colors'
          )}
        >
          Calculate Timeline
        </button>

        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={state.autoTimeline}
            onChange={() => send({ type: 'TOGGLE_AUTO_TIMELINE' })}
            className="rounded border-white/20"
          />
          Auto-calculate on changes
        </label>
      </div>

      {/* Timeline Display */}
      <div className="flex-1 overflow-auto p-2">
        {state.timeline ? (
          <div className="space-y-2">
            {/* Total Duration */}
            <div className="text-xs text-white/60 mb-3">
              Total Duration:{' '}
              <span className="text-white font-mono">
                {Math.round((state.timeline.endTime.getTime() - state.timeline.startTime.getTime()) / 60000)}m
              </span>
            </div>

            {/* Phases */}
            {state.timeline.phases.map((phase, index) => {
              const duration = Math.round(
                (phase.endTime.getTime() - phase.startTime.getTime()) / 60000
              )
              const startOffset = Math.round(
                (phase.startTime.getTime() - state.timeline!.startTime.getTime()) / 60000
              )

              return (
                <div
                  key={index}
                  className="relative pl-6 pb-4 border-l border-white/10"
                >
                  {/* Timeline Dot */}
                  <div className="absolute left-0 top-0 w-3 h-3 -translate-x-1/2 rounded-full bg-accent-cyan" />

                  {/* Time */}
                  <div className="text-xs text-white/40 font-mono mb-1">
                    +{startOffset}m
                  </div>

                  {/* Phase Name */}
                  <div className="text-sm text-white mb-1">{phase.name}</div>

                  {/* Duration Bar */}
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-cyan/50"
                      style={{ width: `${Math.min(100, duration)}%` }}
                    />
                  </div>
                  <div className="text-xs text-white/40 mt-1">
                    {duration}m duration
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-white/40">
            No timeline calculated
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// MAP CANVAS COMPONENT
// =============================================================================

interface MapCanvasProps {
  className?: string
  children?: React.ReactNode
}

function MapCanvas({ className, children }: MapCanvasProps) {
  const { state, send } = useMissionPlanner()

  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!state.isPlacingWaypoint) return

    // Calculate position from click (simplified - would use actual map coords)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 360 - 180 // lng
    const y = 90 - ((e.clientY - rect.top) / rect.height) * 180 // lat

    send({ type: 'PLACE_WAYPOINT', position: [x, y] })
  }, [state.isPlacingWaypoint, send])

  return (
    <div
      className={cn(
        'relative flex-1 bg-surface-0 overflow-hidden',
        state.isPlacingWaypoint && 'cursor-crosshair',
        className
      )}
      onClick={handleMapClick}
    >
      {/* Placement Indicator */}
      {state.isPlacingWaypoint && state.placingWaypointType && (
        <div className="absolute inset-x-0 top-0 py-2 px-4 bg-accent-cyan/20 backdrop-blur-sm text-center">
          <span className="text-xs text-accent-cyan">
            Click to place {state.placingWaypointType} waypoint
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              send({ type: 'CANCEL_WAYPOINT_PLACEMENT' })
            }}
            className="ml-2 text-xs text-white/60 hover:text-white underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Waypoint Markers */}
      <div className="absolute inset-0">
        {state.waypoints.map((waypoint, index) => {
          // Convert lng/lat to screen position (simplified)
          const x = ((waypoint.position[0] + 180) / 360) * 100
          const y = ((90 - waypoint.position[1]) / 180) * 100
          const isSelected = waypoint.id === state.selectedWaypointId

          return (
            <div
              key={waypoint.id}
              className={cn(
                'absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2',
                'flex items-center justify-center',
                'rounded-full border-2 transition-transform',
                isSelected ? 'scale-125' : 'hover:scale-110'
              )}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                backgroundColor: `${WAYPOINT_COLORS[waypoint.type]}20`,
                borderColor: WAYPOINT_COLORS[waypoint.type],
                color: WAYPOINT_COLORS[waypoint.type]
              }}
              onClick={(e) => {
                e.stopPropagation()
                send({ type: 'SELECT_WAYPOINT', id: waypoint.id })
              }}
            >
              <span className="text-xs font-bold">{index + 1}</span>
            </div>
          )
        })}

        {/* Dependency Lines */}
        {state.showDependencies && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {state.waypoints.slice(0, -1).map((wp, i) => {
              const next = state.waypoints[i + 1]
              if (!next) return null

              const x1 = ((wp.position[0] + 180) / 360) * 100
              const y1 = ((90 - wp.position[1]) / 180) * 100
              const x2 = ((next.position[0] + 180) / 360) * 100
              const y2 = ((90 - next.position[1]) / 180) * 100

              return (
                <line
                  key={`${wp.id}-${next.id}`}
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1"
                  strokeDasharray="4 2"
                />
              )
            })}
          </svg>
        )}
      </div>

      {/* Map Placeholder */}
      <div className="absolute inset-0 flex items-center justify-center text-white/20">
        <div className="text-center">
          <div className="text-4xl mb-2">🗺️</div>
          <div className="text-xs">Map Canvas</div>
        </div>
      </div>

      {children}
    </div>
  )
}

// =============================================================================
// VALIDATION PANEL COMPONENT
// =============================================================================

interface ValidationPanelProps {
  className?: string
}

function ValidationPanel({ className }: ValidationPanelProps) {
  const { state, send } = useMissionPlanner()

  if (state.validationErrors.length === 0) return null

  return (
    <div className={cn(
      'absolute bottom-4 right-4 max-w-sm',
      'bg-red-500/10 border border-red-500/20 rounded-lg p-4',
      'backdrop-blur-sm',
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-red-400">
          Validation Errors ({state.validationErrors.length})
        </span>
        <button
          onClick={() => send({ type: 'CLEAR_VALIDATION_ERRORS' })}
          className="text-xs text-white/40 hover:text-white"
        >
          Dismiss
        </button>
      </div>
      <ul className="space-y-1">
        {state.validationErrors.map((error, i) => (
          <li key={i} className="text-xs text-red-300">
            • {error}
          </li>
        ))}
      </ul>
    </div>
  )
}

// =============================================================================
// PROGRESS OVERLAY COMPONENT
// =============================================================================

interface ProgressOverlayProps {
  className?: string
}

function ProgressOverlay({ className }: ProgressOverlayProps) {
  const { state } = useMissionPlanner()

  const completedCount = state.objectives.filter(o => o.status === 'completed').length
  const inProgressCount = state.objectives.filter(o => o.status === 'in_progress').length
  const pendingCount = state.objectives.filter(o => o.status === 'pending').length

  return (
    <div className={cn(
      'absolute top-4 right-4',
      'bg-surface-1/80 border border-white/10 rounded-lg p-3',
      'backdrop-blur-sm',
      className
    )}>
      <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
        Mission Progress
      </div>
      <div className="flex items-center gap-4 text-xs">
        <div className="text-center">
          <div className="text-green-400 font-medium">{completedCount}</div>
          <div className="text-white/40">Done</div>
        </div>
        <div className="text-center">
          <div className="text-amber-400 font-medium">{inProgressCount}</div>
          <div className="text-white/40">Active</div>
        </div>
        <div className="text-center">
          <div className="text-white/60 font-medium">{pendingCount}</div>
          <div className="text-white/40">Pending</div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const MissionPlanner = Object.assign(Root, {
  Header,
  Sidebar,
  ObjectiveList,
  WaypointList,
  ResourceList,
  TimelinePanel,
  MapCanvas,
  ValidationPanel,
  ProgressOverlay,
})

export { useMissionPlanner }
