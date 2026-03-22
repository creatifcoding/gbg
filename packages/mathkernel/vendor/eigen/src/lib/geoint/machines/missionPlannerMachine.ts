/**
 * Mission Planner XState Machine
 *
 * State machine for mission planning workflows:
 * - Objective management with status tracking
 * - Waypoint creation and sequencing
 * - Resource allocation
 * - Timeline scheduling
 * - Mission execution phases
 *
 * @module geoint/machines/missionPlannerMachine
 */

import { setup, assign, emit } from 'xstate'

// =============================================================================
// TYPES
// =============================================================================

export type MissionPhase = 'planning' | 'briefing' | 'execution' | 'review' | 'archived'

export type ObjectiveStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export type ObjectivePriority = 'critical' | 'high' | 'medium' | 'low'

export type WaypointType = 'start' | 'checkpoint' | 'target' | 'rally' | 'extraction' | 'observation'

export type ResourceType = 'personnel' | 'vehicle' | 'equipment' | 'comms' | 'intel'

export type ResourceStatus = 'available' | 'assigned' | 'deployed' | 'unavailable'

export interface Objective {
  id: string
  name: string
  description: string
  status: ObjectiveStatus
  priority: ObjectivePriority
  assignedResources: string[]
  waypoints: string[]
  dependencies: string[]
  estimatedDuration: number // minutes
  actualDuration?: number
  startTime?: Date
  endTime?: Date
  notes: string[]
  order: number
}

export interface Waypoint {
  id: string
  name: string
  type: WaypointType
  position: [number, number] // [lng, lat]
  altitude?: number
  radius?: number // meters
  bearing?: number
  linkedObjectives: string[]
  order: number
  eta?: Date
  notes?: string
}

export interface Resource {
  id: string
  name: string
  type: ResourceType
  status: ResourceStatus
  assignedTo?: string // objective id
  capacity?: number
  currentLoad?: number
  location?: [number, number]
  notes?: string
}

export interface MissionTimeline {
  startTime: Date
  endTime: Date
  phases: Array<{
    name: string
    startTime: Date
    endTime: Date
    objectiveIds: string[]
  }>
}

export interface MissionPlannerContext {
  /** Mission metadata */
  missionId: string
  missionName: string
  missionDescription: string
  /** Current mission phase */
  phase: MissionPhase
  /** All objectives */
  objectives: Objective[]
  /** All waypoints */
  waypoints: Waypoint[]
  /** All resources */
  resources: Resource[]
  /** Mission timeline */
  timeline: MissionTimeline | null
  /** Currently selected objective */
  selectedObjectiveId: string | null
  /** Currently selected waypoint */
  selectedWaypointId: string | null
  /** Currently selected resource */
  selectedResourceId: string | null
  /** Active panel in sidebar */
  activePanel: 'objectives' | 'waypoints' | 'resources' | 'timeline'
  /** Is editing an item */
  isEditing: boolean
  /** Item being edited */
  editingItemId: string | null
  /** Waypoint placement mode */
  isPlacingWaypoint: boolean
  /** Waypoint type being placed */
  placingWaypointType: WaypointType | null
  /** Show dependency lines */
  showDependencies: boolean
  /** Show resource allocation */
  showResources: boolean
  /** Mission progress (0-100) */
  progress: number
  /** Auto-calculate timeline */
  autoTimeline: boolean
  /** Mission validation errors */
  validationErrors: string[]
}

export type MissionPlannerEvent =
  // Phase management
  | { type: 'SET_PHASE'; phase: MissionPhase }
  | { type: 'ADVANCE_PHASE' }

  // Objective management
  | { type: 'ADD_OBJECTIVE'; objective: Omit<Objective, 'id' | 'order'> }
  | { type: 'UPDATE_OBJECTIVE'; id: string; updates: Partial<Objective> }
  | { type: 'DELETE_OBJECTIVE'; id: string }
  | { type: 'REORDER_OBJECTIVES'; ids: string[] }
  | { type: 'SET_OBJECTIVE_STATUS'; id: string; status: ObjectiveStatus }
  | { type: 'SELECT_OBJECTIVE'; id: string | null }

  // Waypoint management
  | { type: 'ADD_WAYPOINT'; waypoint: Omit<Waypoint, 'id' | 'order'> }
  | { type: 'UPDATE_WAYPOINT'; id: string; updates: Partial<Waypoint> }
  | { type: 'DELETE_WAYPOINT'; id: string }
  | { type: 'REORDER_WAYPOINTS'; ids: string[] }
  | { type: 'SELECT_WAYPOINT'; id: string | null }
  | { type: 'START_WAYPOINT_PLACEMENT'; waypointType: WaypointType }
  | { type: 'CANCEL_WAYPOINT_PLACEMENT' }
  | { type: 'PLACE_WAYPOINT'; position: [number, number] }

  // Resource management
  | { type: 'ADD_RESOURCE'; resource: Omit<Resource, 'id'> }
  | { type: 'UPDATE_RESOURCE'; id: string; updates: Partial<Resource> }
  | { type: 'DELETE_RESOURCE'; id: string }
  | { type: 'ASSIGN_RESOURCE'; resourceId: string; objectiveId: string }
  | { type: 'UNASSIGN_RESOURCE'; resourceId: string }
  | { type: 'SELECT_RESOURCE'; id: string | null }

  // Timeline management
  | { type: 'SET_TIMELINE'; timeline: MissionTimeline }
  | { type: 'CALCULATE_TIMELINE' }
  | { type: 'CLEAR_TIMELINE' }
  | { type: 'TOGGLE_AUTO_TIMELINE' }

  // UI state
  | { type: 'SET_ACTIVE_PANEL'; panel: 'objectives' | 'waypoints' | 'resources' | 'timeline' }
  | { type: 'START_EDITING'; itemId: string }
  | { type: 'STOP_EDITING' }
  | { type: 'TOGGLE_DEPENDENCIES' }
  | { type: 'TOGGLE_RESOURCES' }

  // Validation
  | { type: 'VALIDATE_MISSION' }
  | { type: 'CLEAR_VALIDATION_ERRORS' }

  // Mission metadata
  | { type: 'SET_MISSION_NAME'; name: string }
  | { type: 'SET_MISSION_DESCRIPTION'; description: string }

export type MissionPlannerEmittedEvent =
  | { type: 'onPhaseChange'; phase: MissionPhase }
  | { type: 'onObjectiveStatusChange'; objectiveId: string; status: ObjectiveStatus }
  | { type: 'onWaypointPlaced'; waypoint: Waypoint }
  | { type: 'onResourceAssigned'; resourceId: string; objectiveId: string }
  | { type: 'onMissionValidated'; errors: string[] }
  | { type: 'onProgressUpdate'; progress: number }

export interface MissionPlannerInput {
  missionId?: string
  missionName?: string
  initialObjectives?: Objective[]
  initialWaypoints?: Waypoint[]
  initialResources?: Resource[]
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const PHASE_ORDER: MissionPhase[] = ['planning', 'briefing', 'execution', 'review', 'archived']

export const WAYPOINT_COLORS: Record<WaypointType, string> = {
  start: '#22c55e',      // green
  checkpoint: '#3b82f6', // blue
  target: '#ef4444',     // red
  rally: '#f59e0b',      // amber
  extraction: '#8b5cf6', // purple
  observation: '#06b6d4' // cyan
}

export const PRIORITY_WEIGHTS: Record<ObjectivePriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
}

// =============================================================================
// HELPERS
// =============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function calculateProgress(objectives: Objective[]): number {
  if (objectives.length === 0) return 0
  const completed = objectives.filter(o => o.status === 'completed').length
  return Math.round((completed / objectives.length) * 100)
}

function getNextPhase(current: MissionPhase): MissionPhase {
  const idx = PHASE_ORDER.indexOf(current)
  return idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : current
}

function validateMission(ctx: MissionPlannerContext): string[] {
  const errors: string[] = []

  // Must have at least one objective
  if (ctx.objectives.length === 0) {
    errors.push('Mission must have at least one objective')
  }

  // Critical objectives must have assigned resources
  ctx.objectives
    .filter(o => o.priority === 'critical' && o.assignedResources.length === 0)
    .forEach(o => errors.push(`Critical objective "${o.name}" has no assigned resources`))

  // Check for circular dependencies
  const visited = new Set<string>()
  const checkCycle = (id: string, path: Set<string>): boolean => {
    if (path.has(id)) return true
    if (visited.has(id)) return false
    visited.add(id)
    path.add(id)
    const obj = ctx.objectives.find(o => o.id === id)
    if (obj) {
      for (const dep of obj.dependencies) {
        if (checkCycle(dep, new Set(path))) return true
      }
    }
    return false
  }
  ctx.objectives.forEach(o => {
    if (checkCycle(o.id, new Set())) {
      errors.push(`Circular dependency detected involving "${o.name}"`)
    }
  })

  // Waypoints should be linked to objectives
  const unlinkedWaypoints = ctx.waypoints.filter(w => w.linkedObjectives.length === 0)
  if (unlinkedWaypoints.length > 0) {
    errors.push(`${unlinkedWaypoints.length} waypoint(s) not linked to any objective`)
  }

  // Resources with insufficient capacity
  ctx.resources
    .filter(r => r.capacity !== undefined && r.currentLoad !== undefined && r.currentLoad > r.capacity)
    .forEach(r => errors.push(`Resource "${r.name}" is over capacity`))

  return errors
}

// =============================================================================
// MACHINE
// =============================================================================

export const missionPlannerMachine = setup({
  types: {
    context: {} as MissionPlannerContext,
    events: {} as MissionPlannerEvent,
    emitted: {} as MissionPlannerEmittedEvent,
    input: {} as MissionPlannerInput,
  },
  actions: {
    // Phase
    setPhase: assign(({ event }) => {
      if (event.type !== 'SET_PHASE') return {}
      return { phase: event.phase }
    }),

    advancePhase: assign(({ context }) => ({
      phase: getNextPhase(context.phase)
    })),

    // Objectives
    addObjective: assign(({ context, event }) => {
      if (event.type !== 'ADD_OBJECTIVE') return {}
      const newObjective: Objective = {
        ...event.objective,
        id: generateId(),
        order: context.objectives.length
      }
      return { objectives: [...context.objectives, newObjective] }
    }),

    updateObjective: assign(({ context, event }) => {
      if (event.type !== 'UPDATE_OBJECTIVE') return {}
      return {
        objectives: context.objectives.map(o =>
          o.id === event.id ? { ...o, ...event.updates } : o
        )
      }
    }),

    deleteObjective: assign(({ context, event }) => {
      if (event.type !== 'DELETE_OBJECTIVE') return {}
      return {
        objectives: context.objectives.filter(o => o.id !== event.id),
        selectedObjectiveId: context.selectedObjectiveId === event.id ? null : context.selectedObjectiveId
      }
    }),

    reorderObjectives: assign(({ context, event }) => {
      if (event.type !== 'REORDER_OBJECTIVES') return {}
      const orderedObjectives = event.ids.map((id, idx) => {
        const obj = context.objectives.find(o => o.id === id)
        return obj ? { ...obj, order: idx } : null
      }).filter((o): o is Objective => o !== null)
      return { objectives: orderedObjectives }
    }),

    setObjectiveStatus: assign(({ context, event }) => {
      if (event.type !== 'SET_OBJECTIVE_STATUS') return {}
      const newObjectives = context.objectives.map(o =>
        o.id === event.id ? { ...o, status: event.status } : o
      )
      return {
        objectives: newObjectives,
        progress: calculateProgress(newObjectives)
      }
    }),

    selectObjective: assign(({ event }) => {
      if (event.type !== 'SELECT_OBJECTIVE') return {}
      return { selectedObjectiveId: event.id }
    }),

    // Waypoints
    addWaypoint: assign(({ context, event }) => {
      if (event.type !== 'ADD_WAYPOINT') return {}
      const newWaypoint: Waypoint = {
        ...event.waypoint,
        id: generateId(),
        order: context.waypoints.length
      }
      return {
        waypoints: [...context.waypoints, newWaypoint],
        isPlacingWaypoint: false,
        placingWaypointType: null
      }
    }),

    updateWaypoint: assign(({ context, event }) => {
      if (event.type !== 'UPDATE_WAYPOINT') return {}
      return {
        waypoints: context.waypoints.map(w =>
          w.id === event.id ? { ...w, ...event.updates } : w
        )
      }
    }),

    deleteWaypoint: assign(({ context, event }) => {
      if (event.type !== 'DELETE_WAYPOINT') return {}
      return {
        waypoints: context.waypoints.filter(w => w.id !== event.id),
        selectedWaypointId: context.selectedWaypointId === event.id ? null : context.selectedWaypointId
      }
    }),

    reorderWaypoints: assign(({ context, event }) => {
      if (event.type !== 'REORDER_WAYPOINTS') return {}
      const orderedWaypoints = event.ids.map((id, idx) => {
        const wp = context.waypoints.find(w => w.id === id)
        return wp ? { ...wp, order: idx } : null
      }).filter((w): w is Waypoint => w !== null)
      return { waypoints: orderedWaypoints }
    }),

    selectWaypoint: assign(({ event }) => {
      if (event.type !== 'SELECT_WAYPOINT') return {}
      return { selectedWaypointId: event.id }
    }),

    startWaypointPlacement: assign(({ event }) => {
      if (event.type !== 'START_WAYPOINT_PLACEMENT') return {}
      return {
        isPlacingWaypoint: true,
        placingWaypointType: event.waypointType
      }
    }),

    cancelWaypointPlacement: assign({
      isPlacingWaypoint: false,
      placingWaypointType: null
    }),

    placeWaypoint: assign(({ context, event }) => {
      if (event.type !== 'PLACE_WAYPOINT' || !context.placingWaypointType) return {}
      const newWaypoint: Waypoint = {
        id: generateId(),
        name: `${context.placingWaypointType} ${context.waypoints.length + 1}`,
        type: context.placingWaypointType,
        position: event.position,
        linkedObjectives: context.selectedObjectiveId ? [context.selectedObjectiveId] : [],
        order: context.waypoints.length
      }
      return {
        waypoints: [...context.waypoints, newWaypoint],
        isPlacingWaypoint: false,
        placingWaypointType: null,
        selectedWaypointId: newWaypoint.id
      }
    }),

    // Resources
    addResource: assign(({ context, event }) => {
      if (event.type !== 'ADD_RESOURCE') return {}
      const newResource: Resource = {
        ...event.resource,
        id: generateId()
      }
      return { resources: [...context.resources, newResource] }
    }),

    updateResource: assign(({ context, event }) => {
      if (event.type !== 'UPDATE_RESOURCE') return {}
      return {
        resources: context.resources.map(r =>
          r.id === event.id ? { ...r, ...event.updates } : r
        )
      }
    }),

    deleteResource: assign(({ context, event }) => {
      if (event.type !== 'DELETE_RESOURCE') return {}
      return {
        resources: context.resources.filter(r => r.id !== event.id),
        selectedResourceId: context.selectedResourceId === event.id ? null : context.selectedResourceId
      }
    }),

    assignResource: assign(({ context, event }) => {
      if (event.type !== 'ASSIGN_RESOURCE') return {}
      return {
        resources: context.resources.map(r =>
          r.id === event.resourceId
            ? { ...r, status: 'assigned' as ResourceStatus, assignedTo: event.objectiveId }
            : r
        ),
        objectives: context.objectives.map(o =>
          o.id === event.objectiveId
            ? { ...o, assignedResources: [...o.assignedResources, event.resourceId] }
            : o
        )
      }
    }),

    unassignResource: assign(({ context, event }) => {
      if (event.type !== 'UNASSIGN_RESOURCE') return {}
      const resource = context.resources.find(r => r.id === event.resourceId)
      const objectiveId = resource?.assignedTo
      return {
        resources: context.resources.map(r =>
          r.id === event.resourceId
            ? { ...r, status: 'available' as ResourceStatus, assignedTo: undefined }
            : r
        ),
        objectives: objectiveId
          ? context.objectives.map(o =>
              o.id === objectiveId
                ? { ...o, assignedResources: o.assignedResources.filter(id => id !== event.resourceId) }
                : o
            )
          : context.objectives
      }
    }),

    selectResource: assign(({ event }) => {
      if (event.type !== 'SELECT_RESOURCE') return {}
      return { selectedResourceId: event.id }
    }),

    // Timeline
    setTimeline: assign(({ event }) => {
      if (event.type !== 'SET_TIMELINE') return {}
      return { timeline: event.timeline }
    }),

    calculateTimeline: assign(({ context }) => {
      if (context.objectives.length === 0) return {}

      const now = new Date()
      let currentTime = new Date(now)
      const phases: MissionTimeline['phases'] = []

      // Sort objectives by priority and dependencies
      const sortedObjectives = [...context.objectives].sort((a, b) => {
        const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
        if (priorityDiff !== 0) return priorityDiff
        return a.order - b.order
      })

      // Create phases for each objective
      sortedObjectives.forEach(obj => {
        const phaseStart = new Date(currentTime)
        const phaseEnd = new Date(currentTime.getTime() + obj.estimatedDuration * 60 * 1000)

        phases.push({
          name: obj.name,
          startTime: phaseStart,
          endTime: phaseEnd,
          objectiveIds: [obj.id]
        })

        currentTime = phaseEnd
      })

      const timeline: MissionTimeline = {
        startTime: now,
        endTime: currentTime,
        phases
      }

      return { timeline }
    }),

    clearTimeline: assign({ timeline: null }),

    toggleAutoTimeline: assign(({ context }) => ({
      autoTimeline: !context.autoTimeline
    })),

    // UI State
    setActivePanel: assign(({ event }) => {
      if (event.type !== 'SET_ACTIVE_PANEL') return {}
      return { activePanel: event.panel }
    }),

    startEditing: assign(({ event }) => {
      if (event.type !== 'START_EDITING') return {}
      return { isEditing: true, editingItemId: event.itemId }
    }),

    stopEditing: assign({ isEditing: false, editingItemId: null }),

    toggleDependencies: assign(({ context }) => ({
      showDependencies: !context.showDependencies
    })),

    toggleResources: assign(({ context }) => ({
      showResources: !context.showResources
    })),

    // Validation
    validateMission: assign(({ context }) => ({
      validationErrors: validateMission(context)
    })),

    clearValidationErrors: assign({ validationErrors: [] }),

    // Metadata
    setMissionName: assign(({ event }) => {
      if (event.type !== 'SET_MISSION_NAME') return {}
      return { missionName: event.name }
    }),

    setMissionDescription: assign(({ event }) => {
      if (event.type !== 'SET_MISSION_DESCRIPTION') return {}
      return { missionDescription: event.description }
    }),

    // Progress
    updateProgress: assign(({ context }) => ({
      progress: calculateProgress(context.objectives)
    })),

    // Emitted events
    emitPhaseChange: emit(({ context }) => ({
      type: 'onPhaseChange' as const,
      phase: context.phase
    })),

    emitObjectiveStatusChange: emit(({ event }) => {
      if (event.type !== 'SET_OBJECTIVE_STATUS') {
        return { type: 'onObjectiveStatusChange' as const, objectiveId: '', status: 'pending' as ObjectiveStatus }
      }
      return {
        type: 'onObjectiveStatusChange' as const,
        objectiveId: event.id,
        status: event.status
      }
    }),

    emitProgressUpdate: emit(({ context }) => ({
      type: 'onProgressUpdate' as const,
      progress: context.progress
    })),

    emitMissionValidated: emit(({ context }) => ({
      type: 'onMissionValidated' as const,
      errors: context.validationErrors
    })),
  },
}).createMachine({
  id: 'missionPlanner',
  initial: 'planning',
  context: ({ input }) => ({
    missionId: input.missionId ?? generateId(),
    missionName: input.missionName ?? 'New Mission',
    missionDescription: '',
    phase: 'planning',
    objectives: input.initialObjectives ?? [],
    waypoints: input.initialWaypoints ?? [],
    resources: input.initialResources ?? [],
    timeline: null,
    selectedObjectiveId: null,
    selectedWaypointId: null,
    selectedResourceId: null,
    activePanel: 'objectives',
    isEditing: false,
    editingItemId: null,
    isPlacingWaypoint: false,
    placingWaypointType: null,
    showDependencies: true,
    showResources: true,
    progress: 0,
    autoTimeline: true,
    validationErrors: [],
  }),
  states: {
    planning: {
      on: {
        // Phase
        SET_PHASE: { actions: ['setPhase', 'emitPhaseChange'] },
        ADVANCE_PHASE: { target: 'briefing', actions: ['advancePhase', 'emitPhaseChange'] },

        // Objectives
        ADD_OBJECTIVE: { actions: ['addObjective', 'updateProgress'] },
        UPDATE_OBJECTIVE: { actions: ['updateObjective'] },
        DELETE_OBJECTIVE: { actions: ['deleteObjective', 'updateProgress'] },
        REORDER_OBJECTIVES: { actions: ['reorderObjectives'] },
        SET_OBJECTIVE_STATUS: { actions: ['setObjectiveStatus', 'emitObjectiveStatusChange', 'emitProgressUpdate'] },
        SELECT_OBJECTIVE: { actions: ['selectObjective'] },

        // Waypoints
        ADD_WAYPOINT: { actions: ['addWaypoint'] },
        UPDATE_WAYPOINT: { actions: ['updateWaypoint'] },
        DELETE_WAYPOINT: { actions: ['deleteWaypoint'] },
        REORDER_WAYPOINTS: { actions: ['reorderWaypoints'] },
        SELECT_WAYPOINT: { actions: ['selectWaypoint'] },
        START_WAYPOINT_PLACEMENT: { actions: ['startWaypointPlacement'] },
        CANCEL_WAYPOINT_PLACEMENT: { actions: ['cancelWaypointPlacement'] },
        PLACE_WAYPOINT: { actions: ['placeWaypoint'] },

        // Resources
        ADD_RESOURCE: { actions: ['addResource'] },
        UPDATE_RESOURCE: { actions: ['updateResource'] },
        DELETE_RESOURCE: { actions: ['deleteResource'] },
        ASSIGN_RESOURCE: { actions: ['assignResource'] },
        UNASSIGN_RESOURCE: { actions: ['unassignResource'] },
        SELECT_RESOURCE: { actions: ['selectResource'] },

        // Timeline
        SET_TIMELINE: { actions: ['setTimeline'] },
        CALCULATE_TIMELINE: { actions: ['calculateTimeline'] },
        CLEAR_TIMELINE: { actions: ['clearTimeline'] },
        TOGGLE_AUTO_TIMELINE: { actions: ['toggleAutoTimeline'] },

        // UI
        SET_ACTIVE_PANEL: { actions: ['setActivePanel'] },
        START_EDITING: { actions: ['startEditing'] },
        STOP_EDITING: { actions: ['stopEditing'] },
        TOGGLE_DEPENDENCIES: { actions: ['toggleDependencies'] },
        TOGGLE_RESOURCES: { actions: ['toggleResources'] },

        // Validation
        VALIDATE_MISSION: { actions: ['validateMission', 'emitMissionValidated'] },
        CLEAR_VALIDATION_ERRORS: { actions: ['clearValidationErrors'] },

        // Metadata
        SET_MISSION_NAME: { actions: ['setMissionName'] },
        SET_MISSION_DESCRIPTION: { actions: ['setMissionDescription'] },
      },
    },
    briefing: {
      on: {
        SET_PHASE: { actions: ['setPhase', 'emitPhaseChange'] },
        ADVANCE_PHASE: { target: 'execution', actions: ['advancePhase', 'emitPhaseChange'] },
        // Allow viewing but limited editing in briefing
        SELECT_OBJECTIVE: { actions: ['selectObjective'] },
        SELECT_WAYPOINT: { actions: ['selectWaypoint'] },
        SELECT_RESOURCE: { actions: ['selectResource'] },
        SET_ACTIVE_PANEL: { actions: ['setActivePanel'] },
        TOGGLE_DEPENDENCIES: { actions: ['toggleDependencies'] },
        TOGGLE_RESOURCES: { actions: ['toggleResources'] },
      },
    },
    execution: {
      on: {
        SET_PHASE: { actions: ['setPhase', 'emitPhaseChange'] },
        ADVANCE_PHASE: { target: 'review', actions: ['advancePhase', 'emitPhaseChange'] },
        // Only status updates during execution
        SET_OBJECTIVE_STATUS: { actions: ['setObjectiveStatus', 'emitObjectiveStatusChange', 'emitProgressUpdate'] },
        SELECT_OBJECTIVE: { actions: ['selectObjective'] },
        SELECT_WAYPOINT: { actions: ['selectWaypoint'] },
        SELECT_RESOURCE: { actions: ['selectResource'] },
        SET_ACTIVE_PANEL: { actions: ['setActivePanel'] },
      },
    },
    review: {
      on: {
        SET_PHASE: { actions: ['setPhase', 'emitPhaseChange'] },
        ADVANCE_PHASE: { target: 'archived', actions: ['advancePhase', 'emitPhaseChange'] },
        // Read-only in review
        SELECT_OBJECTIVE: { actions: ['selectObjective'] },
        SELECT_WAYPOINT: { actions: ['selectWaypoint'] },
        SELECT_RESOURCE: { actions: ['selectResource'] },
        SET_ACTIVE_PANEL: { actions: ['setActivePanel'] },
      },
    },
    archived: {
      on: {
        // Archived missions are read-only
        SELECT_OBJECTIVE: { actions: ['selectObjective'] },
        SELECT_WAYPOINT: { actions: ['selectWaypoint'] },
        SELECT_RESOURCE: { actions: ['selectResource'] },
        SET_ACTIVE_PANEL: { actions: ['setActivePanel'] },
      },
    },
  },
})

// =============================================================================
// EXPORTS
// =============================================================================

export type MissionPlannerMachine = typeof missionPlannerMachine
export type MissionPlannerSnapshot = ReturnType<typeof missionPlannerMachine.getInitialSnapshot>
