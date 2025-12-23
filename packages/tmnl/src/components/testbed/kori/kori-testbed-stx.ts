/**
 * KORI Testbed UI State with stx
 *
 * Tri-library state management for KORI ECS testbed.
 * - REPL history and command execution
 * - Entity inspector state
 * - Scenario runner for stress tests
 * - World statistics
 *
 * @pattern stx tri-library composition
 * @pattern Effect Schema for all types
 * @module
 */

import { Effect, Schema, Layer, ManagedRuntime, Scope } from "effect"
import { setup, assign } from "xstate"
import { Atom } from "@effect-atom/atom-react"

import { stx, type StxInstance } from "@/lib/stx"
import {
  KoriWorld,
  KoriWorldLive,
  KoriQueryStream,
  KoriQueryStreamLive,
  KoriBatchQueue,
  KoriBatchQueueLive,
  KoriActor,
  KoriActorLive,
  KoriMerge,
  KoriMergeLive,
  type KoriEntity,
  type TraitId,
} from "@/lib/kori"
import {
  selectItem,
  selectItems,
  deselectItem,
  deselectAll,
  getSelectedIds,
  isSelected,
  hasSelection,
  getSelectedCount,
  subscribeToSelection,
  type SelectionMode,
} from "@/lib/selection"

// =============================================================================
// Schemas
// =============================================================================

/**
 * REPL history entry
 */
export const ReplHistoryEntry = Schema.Struct({
  id: Schema.String,
  input: Schema.String,
  output: Schema.String,
  timestamp: Schema.Number,
  isError: Schema.Boolean,
})
export type ReplHistoryEntry = typeof ReplHistoryEntry.Type

/**
 * Entity display for inspector
 */
export const EntityDisplay = Schema.Struct({
  id: Schema.String,
  traits: Schema.Array(Schema.String),
  actorId: Schema.NullOr(Schema.String),
  position: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.optional(Schema.Number),
    })
  ),
  health: Schema.optional(
    Schema.Struct({
      current: Schema.Number,
      max: Schema.Number,
    })
  ),
  name: Schema.optional(Schema.String),
})
export type EntityDisplay = typeof EntityDisplay.Type

/**
 * World statistics
 */
export const WorldStats = Schema.Struct({
  entityCount: Schema.Number,
  traitCounts: Schema.Record({ key: Schema.String, value: Schema.Number }),
  actorCount: Schema.Number,
  queueDepth: Schema.Number,
  lastFlushMs: Schema.optional(Schema.Number),
})
export type WorldStats = typeof WorldStats.Type

/**
 * Scenario step status
 */
export const ScenarioStepStatus = Schema.Literal(
  "pending",
  "running",
  "passed",
  "failed",
  "skipped"
)
export type ScenarioStepStatus = typeof ScenarioStepStatus.Type

/**
 * Scenario step
 */
export const ScenarioStep = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  description: Schema.String,
  effect: Schema.String,
  status: ScenarioStepStatus,
  durationMs: Schema.optional(Schema.Number),
  error: Schema.optional(Schema.String),
})
export type ScenarioStep = typeof ScenarioStep.Type

/**
 * Scenario status
 */
export const ScenarioStatus = Schema.Literal(
  "idle",
  "running",
  "paused",
  "passed",
  "failed"
)
export type ScenarioStatus = typeof ScenarioStatus.Type

/**
 * Scenario definition
 */
export const Scenario = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  steps: Schema.Array(ScenarioStep),
  status: ScenarioStatus,
  currentStepIndex: Schema.Number,
  startedAt: Schema.optional(Schema.Number),
  completedAt: Schema.optional(Schema.Number),
})
export type Scenario = typeof Scenario.Type

// =============================================================================
// Machine Definition
// =============================================================================

type TestbedContext = {
  worldInitialized: boolean
  selectedEntityId: string | null
}

type TestbedEvents =
  | { type: "INIT_WORLD" }
  | { type: "WORLD_READY" }
  | { type: "SELECT_ENTITY"; id: string }
  | { type: "DESELECT_ENTITY" }
  | { type: "RESET" }

const testbedMachine = setup({
  types: {
    context: {} as TestbedContext,
    events: {} as TestbedEvents,
  },
  actions: {
    markWorldReady: assign({ worldInitialized: true }),
    selectEntity: assign({
      selectedEntityId: (_, params: { id: string }) => params.id,
    }),
    deselectEntity: assign({ selectedEntityId: null }),
    resetWorld: assign({ worldInitialized: false, selectedEntityId: null }),
  },
}).createMachine({
  id: "koriTestbed",
  initial: "uninitialized",
  context: {
    worldInitialized: false,
    selectedEntityId: null,
  },
  states: {
    uninitialized: {
      on: {
        INIT_WORLD: "initializing",
      },
    },
    initializing: {
      on: {
        WORLD_READY: {
          target: "ready",
          actions: "markWorldReady",
        },
      },
    },
    ready: {
      on: {
        SELECT_ENTITY: {
          actions: {
            type: "selectEntity",
            params: ({ event }) => ({ id: event.id }),
          },
        },
        DESELECT_ENTITY: {
          actions: "deselectEntity",
        },
        RESET: {
          target: "uninitialized",
          actions: "resetWorld",
        },
      },
    },
  },
})

// =============================================================================
// Data Shape
// =============================================================================

interface KoriTestbedData {
  // REPL
  replHistory: readonly ReplHistoryEntry[]
  replCommandHistory: readonly string[]
  replHistoryIndex: number

  // Entities
  entities: readonly EntityDisplay[]
  /**
   * @deprecated Use selectedEntityIds for multi-select support
   * Kept for backward compatibility - reflects first selected entity
   */
  selectedEntityId: string | null
  /**
   * Multi-select support via selection subsystem
   * Array representation for Legend-State compatibility
   */
  selectedEntityIds: readonly string[]

  // World stats
  stats: WorldStats

  // Scenarios
  scenarios: readonly Scenario[]
  activeScenarioId: string | null

  // Layout
  panelVisibility: {
    repl: boolean
    inspector: boolean
    scenario: boolean
    canvas: boolean
  }
}

// =============================================================================
// Predefined Scenarios
// =============================================================================

const createStep = (
  id: string,
  label: string,
  description: string,
  effect: string
): ScenarioStep => ({
  id,
  label,
  description,
  effect,
  status: "pending",
})

const predefinedScenarios: Scenario[] = [
  {
    id: "scenario-basic-crud",
    name: "Basic CRUD",
    description: "Spawn → Update → Destroy cycle",
    steps: [
      createStep("s1", "Spawn Entity", "Create entity with Position2D + Health", "spawnBasic"),
      createStep("s2", "Add Trait", "Attach Name trait", "addTrait"),
      createStep("s3", "Update Trait", "Modify Health value", "updateTrait"),
      createStep("s4", "Query", "Query entities with Health", "queryHealth"),
      createStep("s5", "Destroy", "Destroy the entity", "destroyEntity"),
    ],
    status: "idle",
    currentStepIndex: -1,
  },
  {
    id: "scenario-spawn-burst",
    name: "Spawn Burst",
    description: "Spawn 100 entities rapidly",
    steps: [
      createStep("s1", "Prepare", "Clear existing entities", "clearWorld"),
      createStep("s2", "Burst Spawn", "Spawn 100 entities", "spawnBurst"),
      createStep("s3", "Verify Count", "Check entity count", "verifyCount"),
      createStep("s4", "Query All", "Query all entities", "queryAll"),
    ],
    status: "idle",
    currentStepIndex: -1,
  },
  {
    id: "scenario-batch-updates",
    name: "Batch Updates",
    description: "Batch queue mutation throughput test",
    steps: [
      createStep("s1", "Spawn Targets", "Create 50 entities", "spawn50"),
      createStep("s2", "Enqueue Updates", "Batch enqueue 200 mutations", "enqueueBatch"),
      createStep("s3", "Flush", "Flush batch queue", "flushQueue"),
      createStep("s4", "Verify Updates", "Check trait values updated", "verifyUpdates"),
    ],
    status: "idle",
    currentStepIndex: -1,
  },
  {
    id: "scenario-query-stream",
    name: "Query Stream",
    description: "Reactive query subscription test",
    steps: [
      createStep("s1", "Subscribe", "Create query subscription for Health", "subscribeHealth"),
      createStep("s2", "Trigger Add", "Spawn entity with Health", "spawnHealthy"),
      createStep("s3", "Trigger Update", "Update Health value", "updateHealth"),
      createStep("s4", "Trigger Remove", "Destroy entity", "destroyHealthy"),
      createStep("s5", "Unsubscribe", "Close subscription", "unsubscribe"),
    ],
    status: "idle",
    currentStepIndex: -1,
  },
]

const initialData: KoriTestbedData = {
  replHistory: [],
  replCommandHistory: [],
  replHistoryIndex: -1,
  entities: [],
  selectedEntityId: null,
  selectedEntityIds: [],
  stats: {
    entityCount: 0,
    traitCounts: {},
    actorCount: 0,
    queueDepth: 0,
  },
  scenarios: predefinedScenarios,
  activeScenarioId: null,
  panelVisibility: {
    repl: true,
    inspector: true,
    scenario: true,
    canvas: true,
  },
}

// =============================================================================
// Full KORI Layer & Runtime Atom
// =============================================================================

const FullKoriLayer = Layer.mergeAll(
  KoriWorldLive,
  KoriQueryStreamLive,
  KoriBatchQueueLive,
  KoriActorLive,
  KoriMergeLive
)

/**
 * KORI Runtime Atom — SINGLETON (for React hooks)
 *
 * Atom.runtime creates a ManagedRuntime under the hood that is
 * instantiated ONCE and shared across all operations.
 *
 * @pattern Atom.runtime for React integration
 */
export const koriRuntimeAtom = Atom.runtime(FullKoriLayer)

/**
 * KORI Managed Runtime — SINGLETON (for stx effects)
 *
 * ManagedRuntime is instantiated ONCE and shared across all stx effects.
 * All effects access the SAME KoriWorld instance.
 *
 * @pattern ManagedRuntime for Effect.promise() in stx effects
 */
const koriManagedRuntime = ManagedRuntime.make(FullKoriLayer)

/**
 * Persistent Scope for Entity Lifetime Management
 *
 * This scope is created ONCE and NEVER closes during the testbed's
 * lifetime. Entities spawned within this scope persist until explicitly
 * destroyed.
 *
 * The key insight: spawn() uses Effect.acquireRelease which marks entities
 * as destroyed when scope closes. By providing a persistent scope, entities
 * survive beyond individual effect calls.
 *
 * @pattern Persistent Scope for Resource Lifetime
 */
let persistentScope: Scope.CloseableScope | null = null

const ensurePersistentScope: Effect.Effect<Scope.CloseableScope> = Effect.suspend(() => {
  if (persistentScope) {
    return Effect.succeed(persistentScope)
  }
  return Effect.map(Scope.make(), (scope) => {
    persistentScope = scope
    return scope
  })
})

// =============================================================================
// KORI Operations (Callable Functions for stx effects)
// =============================================================================

/**
 * These operations use the singleton koriManagedRuntime.
 * All calls access the SAME KoriWorld instance.
 *
 * Pattern: Each operation is a plain function that returns a Promise.
 * Internally it runs an Effect via the shared ManagedRuntime.
 *
 * NOTE: spawn() uses Effect.acquireRelease, which requires a Scope.
 * The ManagedRuntime provides a persistent scope, so entities survive
 * beyond individual effect calls.
 */
export const koriOps = {
  /**
   * Query all entities from the world
   */
  queryAll: () =>
    koriManagedRuntime.runPromise(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        return yield* world.queryAll()
      })
    ),

  /**
   * Spawn an entity with traits
   *
   * CRITICAL FIX: The entity persists because we provide a persistent scope
   * that NEVER closes. Without this, spawn()'s acquireRelease would mark
   * the entity as destroyed when the scope closes.
   *
   * Flow:
   * 1. Ensure persistent scope exists (created once, never closed)
   * 2. Run spawn effect with that scope provided
   * 3. Entity's release function is registered with persistent scope
   * 4. Since scope never closes, entity stays alive
   */
  spawnWithTraits: (traits: ReadonlyArray<{ id: TraitId; data: unknown }>) =>
    koriManagedRuntime.runPromise(
      Effect.gen(function* () {
        const scope = yield* ensurePersistentScope
        const world = yield* KoriWorld
        const spawned = yield* world.spawn(traits).pipe(
          Effect.provideService(Scope.Scope, scope)
        )
        return spawned
      })
    ),

  /**
   * Destroy an entity by ID
   */
  destroy: (entityId: string) =>
    koriManagedRuntime.runPromise(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        yield* world.destroy(entityId as any)
      })
    ),

  /**
   * Add trait to entity
   */
  addTrait: (params: { entityId: string; traitId: TraitId; data: unknown }) =>
    koriManagedRuntime.runPromise(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        yield* world.addTrait(params.entityId as any, params.traitId, params.data)
      })
    ),

  /**
   * Destroy all entities in the world.
   * Used to reset state before re-initializing.
   */
  destroyAll: () =>
    koriManagedRuntime.runPromise(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entities = yield* world.queryAll()
        for (const entity of entities) {
          yield* world.destroy(entity.id)
        }
      })
    ),
}

// =============================================================================
// Entity Helpers
// =============================================================================

let entityIdCounter = 0
let replIdCounter = 0

/**
 * Convert a KoriEntity to EntityDisplay for UI
 *
 * Note: entity.traits is a ReadonlyMap<TraitId, unknown>, not an array.
 */
const toEntityDisplay = (entity: KoriEntity): EntityDisplay => {
  // Convert Map to array of trait IDs
  const traitIds = Array.from(entity.traits.keys())

  // Extract position from Position2D or Position3D trait
  const positionData = entity.traits.get("Position2D" as TraitId) ||
    entity.traits.get("Position3D" as TraitId)
  const position = positionData
    ? {
        x: (positionData as { x: number }).x,
        y: (positionData as { y: number }).y,
        z: (positionData as { z?: number }).z,
      }
    : undefined

  // Extract health from Health trait
  const healthData = entity.traits.get("Health" as TraitId)
  const health = healthData
    ? {
        current: (healthData as { current: number }).current,
        max: (healthData as { max: number }).max,
      }
    : undefined

  // Extract name from Name trait
  const nameData = entity.traits.get("Name" as TraitId)
  const name = nameData
    ? (nameData as { value: string }).value
    : undefined

  return {
    id: entity.id,
    traits: traitIds,
    actorId: null,
    position,
    health,
    name,
  }
}

// =============================================================================
// Effects
// =============================================================================

const testbedEffects = {
  /**
   * Initialize the KORI world with demo entities.
   * Clears existing entities first to prevent duplicates.
   */
  initWorld: Effect.gen(function* () {
    const state = getKoriTestbedStx()
    state.actor?.send({ type: "INIT_WORLD" })

    // Clear existing entities first (prevents duplicates on re-init)
    yield* Effect.promise(() => koriOps.destroyAll())

    // Spawn demo entities
    const demoEntities = [
      { name: "Player", health: { current: 100, max: 100 }, pos: { x: 0, y: 0 } },
      { name: "Enemy Alpha", health: { current: 75, max: 100 }, pos: { x: 50, y: 30 } },
      { name: "Enemy Beta", health: { current: 50, max: 80 }, pos: { x: -20, y: 45 } },
      { name: "Drone", health: { current: 25, max: 25 }, pos: { x: 100, y: -10 } },
    ]

    for (const demo of demoEntities) {
      yield* Effect.promise(() =>
        koriOps.spawnWithTraits([
          { id: "Position2D" as TraitId, data: { _tag: "Position2D", x: demo.pos.x, y: demo.pos.y } },
          { id: "Health" as TraitId, data: { _tag: "Health", current: demo.health.current, max: demo.health.max } },
          { id: "Name" as TraitId, data: { _tag: "Name", value: demo.name } },
        ])
      )
    }

    // Refresh entity list after spawning demo entities
    const entities = yield* Effect.promise(() => koriOps.queryAll())
    state.data.entities.set(entities.map(toEntityDisplay))

    state.actor?.send({ type: "WORLD_READY" })
    return "World initialized with demo entities"
  }),

  /**
   * Execute a REPL command
   */
  executeCommand: (input: string) =>
    Effect.gen(function* () {
      const state = getKoriTestbedStx()
      const trimmed = input.trim()

      if (!trimmed) return

      const entry: ReplHistoryEntry = {
        id: `repl-${++replIdCounter}`,
        input: trimmed,
        output: "",
        timestamp: Date.now(),
        isError: false,
      }

      // Add to command history
      if (trimmed.startsWith("!") || trimmed.startsWith(":")) {
        state.data.replCommandHistory.set([
          trimmed,
          ...state.data.replCommandHistory.get(),
        ].slice(0, 100))
      }

      // Execute command
      const result = yield* executeReplCommand(trimmed)
      entry.output = result.output
      entry.isError = result.isError

      // Add to history
      state.data.replHistory.set([...state.data.replHistory.get(), entry])
      state.data.replHistoryIndex.set(-1)

      return entry
    }),

  /**
   * Navigate REPL history
   */
  navigateHistory: (direction: "up" | "down") =>
    Effect.sync(() => {
      const state = getKoriTestbedStx()
      const cmdHistory = state.data.replCommandHistory.get()
      const currentIndex = state.data.replHistoryIndex.get()

      if (direction === "up") {
        const newIndex = Math.min(currentIndex + 1, cmdHistory.length - 1)
        state.data.replHistoryIndex.set(newIndex)
        return cmdHistory[newIndex] ?? ""
      } else {
        const newIndex = Math.max(currentIndex - 1, -1)
        state.data.replHistoryIndex.set(newIndex)
        return newIndex >= 0 ? cmdHistory[newIndex] : ""
      }
    }),

  /**
   * Clear REPL history
   */
  clearRepl: Effect.sync(() => {
    const state = getKoriTestbedStx()
    state.data.replHistory.set([])
  }),

  /**
   * Refresh entities list from world
   *
   * Uses koriOps.queryAll() which accesses the singleton runtime.
   */
  refreshEntities: Effect.gen(function* () {
    const state = getKoriTestbedStx()
    // Use koriOps which shares the singleton runtime
    const entities = yield* Effect.promise(() => koriOps.queryAll())
    state.data.entities.set(entities.map(toEntityDisplay))
    return entities.length
  }),

  /**
   * Select an entity (single select, replaces previous selection)
   * Uses selection subsystem for multi-select support
   *
   * @param id Entity ID to select
   * @param mode Selection mode: 'replace' | 'add' | 'toggle'
   */
  selectEntity: (id: string, mode: SelectionMode = "replace") =>
    Effect.sync(() => {
      const state = getKoriTestbedStx()
      // Use selection subsystem
      selectItem(id, mode)
      // Sync with stx state
      const selectedIds = Array.from(getSelectedIds())
      state.data.selectedEntityIds.set(selectedIds)
      state.data.selectedEntityId.set(selectedIds[0] ?? null)
      state.actor?.send({ type: "SELECT_ENTITY", id })
    }),

  /**
   * Select multiple entities
   * Uses selection subsystem for multi-select support
   */
  selectEntities: (ids: string[], mode: SelectionMode = "replace") =>
    Effect.sync(() => {
      const state = getKoriTestbedStx()
      selectItems(ids, mode)
      const selectedIds = Array.from(getSelectedIds())
      state.data.selectedEntityIds.set(selectedIds)
      state.data.selectedEntityId.set(selectedIds[0] ?? null)
    }),

  /**
   * Deselect a specific entity
   */
  deselectEntity: (id?: string) =>
    Effect.sync(() => {
      const state = getKoriTestbedStx()
      if (id) {
        deselectItem(id)
      } else {
        deselectAll()
      }
      const selectedIds = Array.from(getSelectedIds())
      state.data.selectedEntityIds.set(selectedIds)
      state.data.selectedEntityId.set(selectedIds[0] ?? null)
      state.actor?.send({ type: "DESELECT_ENTITY" })
    }),

  /**
   * Deselect all entities
   */
  deselectAllEntities: Effect.sync(() => {
    const state = getKoriTestbedStx()
    deselectAll()
    state.data.selectedEntityIds.set([])
    state.data.selectedEntityId.set(null)
    state.actor?.send({ type: "DESELECT_ENTITY" })
  }),

  /**
   * Spawn a basic entity with Position2D and Health
   *
   * Uses koriOps.spawnWithTraits() which accesses the singleton runtime.
   */
  spawnBasicEntity: Effect.gen(function* () {
    const state = getKoriTestbedStx()

    const traits = [
      {
        id: "Position2D" as TraitId,
        data: {
          _tag: "Position2D" as const,
          x: Math.random() * 100,
          y: Math.random() * 100,
        },
      },
      {
        id: "Health" as TraitId,
        data: {
          _tag: "Health" as const,
          current: 100,
          max: 100,
        },
      },
    ]

    // Use koriOps which shares the singleton runtime
    const entity = yield* Effect.promise(() => koriOps.spawnWithTraits(traits))

    // Refresh entities from the same singleton world
    const entities = yield* Effect.promise(() => koriOps.queryAll())
    state.data.entities.set(entities.map(toEntityDisplay))

    return entity.id
  }),

  /**
   * Destroy an entity
   *
   * Uses koriOps.destroy() which accesses the singleton runtime.
   * Also removes the entity from selection subsystem.
   */
  destroyEntity: (id: string) =>
    Effect.gen(function* () {
      const state = getKoriTestbedStx()

      // Use koriOps which shares the singleton runtime
      yield* Effect.promise(() => koriOps.destroy(id))

      // Remove from selection subsystem
      if (isSelected(id)) {
        deselectItem(id)
        const selectedIds = Array.from(getSelectedIds())
        state.data.selectedEntityIds.set(selectedIds)
        state.data.selectedEntityId.set(selectedIds[0] ?? null)
        if (selectedIds.length === 0) {
          state.actor?.send({ type: "DESELECT_ENTITY" })
        }
      }

      // Refresh entities from the same singleton world
      const entities = yield* Effect.promise(() => koriOps.queryAll())
      state.data.entities.set(entities.map(toEntityDisplay))

      return id
    }),

  /**
   * Add a trait to an entity
   *
   * Uses koriOps.addTrait() which accesses the singleton runtime.
   */
  addTrait: (entityId: string, traitId: TraitId, data: unknown) =>
    Effect.gen(function* () {
      const state = getKoriTestbedStx()

      // Use koriOps which shares the singleton runtime
      yield* Effect.promise(() =>
        koriOps.addTrait({ entityId, traitId, data })
      )

      // Refresh entities from the same singleton world
      const entities = yield* Effect.promise(() => koriOps.queryAll())
      state.data.entities.set(entities.map(toEntityDisplay))

      return `Added ${traitId} to ${entityId}`
    }),

  /**
   * Toggle panel visibility
   */
  togglePanel: (panel: keyof KoriTestbedData["panelVisibility"]) =>
    Effect.sync(() => {
      const state = getKoriTestbedStx()
      const current = state.data.panelVisibility.get()
      state.data.panelVisibility.set({
        ...current,
        [panel]: !current[panel],
      })
    }),

  /**
   * Run a scenario
   */
  runScenario: (scenarioId: string) =>
    Effect.gen(function* () {
      const state = getKoriTestbedStx()
      const scenarios = [...state.data.scenarios.get()]
      const idx = scenarios.findIndex((s) => s.id === scenarioId)

      if (idx === -1) return

      // Reset scenario
      const scenario: Scenario = {
        ...scenarios[idx],
        status: "running",
        currentStepIndex: 0,
        startedAt: Date.now(),
        completedAt: undefined,
        steps: scenarios[idx].steps.map((s) => ({
          ...s,
          status: "pending",
          error: undefined,
          durationMs: undefined,
        })),
      }
      scenarios[idx] = scenario
      state.data.scenarios.set(scenarios)
      state.data.activeScenarioId.set(scenarioId)

      // Run steps
      yield* runScenarioSteps(scenarioId)
    }),

  /**
   * Reset a scenario
   */
  resetScenario: (scenarioId: string) =>
    Effect.sync(() => {
      const state = getKoriTestbedStx()
      const scenarios = [...state.data.scenarios.get()]
      const idx = scenarios.findIndex((s) => s.id === scenarioId)

      if (idx === -1) return

      const original = predefinedScenarios.find((s) => s.id === scenarioId)
      if (original) {
        scenarios[idx] = { ...original }
        state.data.scenarios.set(scenarios)
      }
    }),
}

// =============================================================================
// Scenario Step Execution
// =============================================================================

const runScenarioSteps = (scenarioId: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    const state = getKoriTestbedStx()

    while (true) {
      const scenarios = state.data.scenarios.get()
      const scenario = scenarios.find((s) => s.id === scenarioId)

      if (!scenario || scenario.status !== "running") break
      if (scenario.currentStepIndex >= scenario.steps.length) {
        updateScenarioStatus(scenarioId, "passed")
        break
      }

      const stepIdx = scenario.currentStepIndex
      const step = scenario.steps[stepIdx]

      updateStepStatus(scenarioId, stepIdx, "running")
      const startTime = Date.now()

      const result = yield* Effect.either(
        executeScenarioStep(step.effect)
      )

      const duration = Date.now() - startTime

      if (result._tag === "Right") {
        updateStepStatus(scenarioId, stepIdx, "passed", undefined, duration)
        incrementStepIndex(scenarioId)
        yield* Effect.sleep(200)
      } else {
        updateStepStatus(scenarioId, stepIdx, "failed", String(result.left), duration)
        updateScenarioStatus(scenarioId, "failed")
        break
      }
    }
  })

const executeScenarioStep = (effectName: string): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const state = getKoriTestbedStx()

    switch (effectName) {
      case "spawnBasic":
        yield* testbedEffects.spawnBasicEntity
        break

      case "addTrait": {
        // Add Name trait to most recently spawned entity
        const entities = state.data.entities.get()
        if (entities.length === 0) {
          yield* Effect.fail(new Error("No entities to add trait to"))
          return
        }
        const target = entities[entities.length - 1]
        yield* testbedEffects.addTrait(target.id, "Name" as any, {
          _tag: "Name",
          value: `Entity-${target.id.slice(0, 4)}`,
        })
        break
      }

      case "updateTrait": {
        // Update Health trait on most recent entity
        const entities = state.data.entities.get()
        if (entities.length === 0) {
          yield* Effect.fail(new Error("No entities to update"))
          return
        }
        const target = entities[entities.length - 1]
        // Use setTrait via koriOps (direct call since testbedEffects doesn't have setTrait)
        yield* Effect.promise(() =>
          koriManagedRuntime.runPromise(
            Effect.gen(function* () {
              const world = yield* KoriWorld
              yield* world.setTrait(target.id as any, "Health" as any, {
                _tag: "Health",
                current: 50,
                max: 100,
              })
            })
          )
        )
        yield* testbedEffects.refreshEntities
        break
      }

      case "queryHealth": {
        // Query entities with Health trait
        yield* testbedEffects.refreshEntities
        const entities = state.data.entities.get()
        const withHealth = entities.filter((e) => e.health !== undefined)
        yield* Effect.log(`Found ${withHealth.length} entities with Health`)
        break
      }

      case "destroyEntity": {
        // Destroy most recently spawned entity
        const entities = state.data.entities.get()
        if (entities.length === 0) {
          yield* Effect.fail(new Error("No entities to destroy"))
          return
        }
        const target = entities[entities.length - 1]
        yield* testbedEffects.destroyEntity(target.id)
        break
      }

      case "spawnHealthy": {
        // Spawn entity with Health trait for stream tests
        yield* testbedEffects.spawnBasicEntity
        break
      }

      case "updateHealth": {
        // Update Health on most recent entity
        const entities = state.data.entities.get()
        if (entities.length === 0) return
        const target = entities[entities.length - 1]
        yield* Effect.promise(() =>
          koriManagedRuntime.runPromise(
            Effect.gen(function* () {
              const world = yield* KoriWorld
              yield* world.setTrait(target.id as any, "Health" as any, {
                _tag: "Health",
                current: 75,
                max: 100,
              })
            })
          )
        )
        yield* testbedEffects.refreshEntities
        break
      }

      case "destroyHealthy": {
        // Destroy most recent entity
        const entities = state.data.entities.get()
        if (entities.length === 0) return
        const target = entities[entities.length - 1]
        yield* testbedEffects.destroyEntity(target.id)
        break
      }

      case "subscribeHealth":
      case "unsubscribe":
        // Stream subscription steps - log for now
        yield* Effect.log(`Stream step: ${effectName}`)
        break

      case "enqueueBatch":
      case "flushQueue":
      case "verifyUpdates":
        // Batch queue steps - log for now
        yield* Effect.log(`Batch step: ${effectName}`)
        break

      case "clearWorld": {
        // Clear all entities
        const entities = state.data.entities.get()
        for (const e of entities) {
          yield* testbedEffects.destroyEntity(e.id)
        }
        break
      }

      case "spawn50":
      case "spawnBurst": {
        const count = effectName === "spawnBurst" ? 100 : 50
        for (let i = 0; i < count; i++) {
          yield* testbedEffects.spawnBasicEntity
        }
        break
      }

      case "queryAll":
        yield* testbedEffects.refreshEntities
        break

      case "verifyCount": {
        const current = state.data.entities.get().length
        if (current < 50) {
          yield* Effect.fail(new Error(`Expected >= 50 entities, got ${current}`))
        }
        break
      }

      default:
        yield* Effect.log(`Unknown step: ${effectName}`)
    }
  })

const updateScenarioStatus = (scenarioId: string, status: ScenarioStatus): void => {
  const state = getKoriTestbedStx()
  const scenarios = [...state.data.scenarios.get()]
  const idx = scenarios.findIndex((s) => s.id === scenarioId)

  if (idx !== -1) {
    scenarios[idx] = {
      ...scenarios[idx],
      status,
      completedAt: status === "passed" || status === "failed" ? Date.now() : undefined,
    }
    state.data.scenarios.set(scenarios)
  }
}

const updateStepStatus = (
  scenarioId: string,
  stepIdx: number,
  status: ScenarioStepStatus,
  error?: string,
  durationMs?: number
): void => {
  const state = getKoriTestbedStx()
  const scenarios = [...state.data.scenarios.get()]
  const scenarioIdx = scenarios.findIndex((s) => s.id === scenarioId)

  if (scenarioIdx !== -1) {
    const steps = [...scenarios[scenarioIdx].steps]
    steps[stepIdx] = { ...steps[stepIdx], status, error, durationMs }
    scenarios[scenarioIdx] = { ...scenarios[scenarioIdx], steps }
    state.data.scenarios.set(scenarios)
  }
}

const incrementStepIndex = (scenarioId: string): void => {
  const state = getKoriTestbedStx()
  const scenarios = [...state.data.scenarios.get()]
  const idx = scenarios.findIndex((s) => s.id === scenarioId)

  if (idx !== -1) {
    scenarios[idx] = {
      ...scenarios[idx],
      currentStepIndex: scenarios[idx].currentStepIndex + 1,
    }
    state.data.scenarios.set(scenarios)
  }
}

// =============================================================================
// REPL Command Execution
// =============================================================================

interface CommandResult {
  output: string
  isError: boolean
}

/**
 * Expand selection tags to selected entity IDs
 *
 * Tags:
 * - <sel>  → First selected entity ID (backward compat)
 * - <sels> → All selected entity IDs (space-separated)
 * - <selc> → Count of selected entities
 *
 * Allows quick REPL actions:
 * - :destroy <sel>   — destroys first selected entity
 * - :destroy <sels>  — destroys all selected entities (if command supports multiple args)
 * - :count returns <selc> selected
 */
const expandSelectionTags = (input: string, selectedIds: readonly string[]): string => {
  let result = input

  // <sel> → first selected (or empty if none)
  if (result.includes("<sel>")) {
    result = result.replace(/<sel>/g, selectedIds[0] ?? "")
  }

  // <sels> → all selected (space-separated)
  if (result.includes("<sels>")) {
    result = result.replace(/<sels>/g, selectedIds.join(" "))
  }

  // <selc> → selection count
  if (result.includes("<selc>")) {
    result = result.replace(/<selc>/g, String(selectedIds.length))
  }

  return result
}

/**
 * Check if input uses any selection tag
 */
const usesSelectionTag = (input: string): boolean =>
  input.includes("<sel>") || input.includes("<sels>") || input.includes("<selc>")

const executeReplCommand = (input: string): Effect.Effect<CommandResult> =>
  Effect.gen(function* () {
    const state = getKoriTestbedStx()
    const selectedIds = state.data.selectedEntityIds.get()

    // Check if selection tag was used but no entities are selected
    if (usesSelectionTag(input) && selectedIds.length === 0) {
      return {
        output: "Error: Selection tag used but no entities are selected. Click entity to select.",
        isError: true,
      }
    }

    // Expand selection tags to selected entity IDs
    const expandedInput = expandSelectionTags(input, selectedIds)

    // Handle : prefix (like vim commands)
    if (expandedInput.startsWith(":")) {
      const parts = expandedInput.slice(1).split(/\s+/).filter(Boolean)
      const cmd = parts[0].toLowerCase()
      const args = parts.slice(1)

      return yield* handleCommand(cmd, args)
    }

    // Handle ! prefix (legacy)
    if (expandedInput.startsWith("!")) {
      const parts = expandedInput.slice(1).split(/\s+/).filter(Boolean)
      const cmd = parts[0].toLowerCase()
      const args = parts.slice(1)

      return yield* handleCommand(cmd, args)
    }

    // Treat as expression - show help
    return {
      output: 'Type :help or !help for available commands',
      isError: false,
    }
  })

const handleCommand = (cmd: string, args: string[]): Effect.Effect<CommandResult> =>
  Effect.gen(function* () {
    const state = getKoriTestbedStx()

    switch (cmd) {
      case "help":
      case "h":
        return {
          output: [
            "KORI REPL Commands:",
            "",
            "Entity Operations:",
            "  :spawn              Spawn entity with Position2D + Health",
            "  :destroy <id>       Destroy entity by ID",
            "  :list               List all entities",
            "  :select <id>        Select entity for inspection",
            "  :deselect           Deselect current entity",
            "",
            "Trait Operations:",
            "  :add <id> <trait>   Add trait to entity",
            "  :set <id> <trait> <json>  Set trait data",
            "",
            "Query Operations:",
            "  :query <trait>      Query entities with trait",
            "  :count              Count all entities",
            "",
            "World Operations:",
            "  :clear              Clear all entities",
            "  :stats              Show world statistics",
            "",
            "REPL:",
            "  :help               Show this help",
            "  :cls                Clear REPL output",
            "",
            "Selection Tags:",
            "  <sel>               First selected entity ID",
            "  <sels>              All selected entity IDs (space-separated)",
            "  <selc>              Count of selected entities",
            "",
            "Examples:",
            "  :destroy <sel>      Destroy first selected entity",
            "  :destroy <sels>     Destroy all selected entities",
            "",
            "Multi-select:",
            "  Click               Select entity (replaces)",
            "  Shift+Click         Add to selection",
            "  Ctrl+Click          Toggle selection",
          ].join("\n"),
          isError: false,
        }

      case "spawn":
        const entityId = yield* testbedEffects.spawnBasicEntity
        return { output: `Spawned entity: ${entityId}`, isError: false }

      case "destroy":
        if (!args[0]) return { output: "Usage: :destroy <entity-id>", isError: true }
        yield* testbedEffects.destroyEntity(args[0])
        return { output: `Destroyed: ${args[0]}`, isError: false }

      case "list":
      case "ls":
        yield* testbedEffects.refreshEntities
        const entities = state.data.entities.get()
        if (entities.length === 0) {
          return { output: "No entities in world", isError: false }
        }
        const lines = entities.map((e) =>
          `  ${e.id.slice(0, 8)}...  [${e.traits.join(", ")}]`
        )
        return { output: `Entities (${entities.length}):\n${lines.join("\n")}`, isError: false }

      case "select":
        if (!args[0]) return { output: "Usage: :select <entity-id>", isError: true }
        yield* testbedEffects.selectEntity(args[0])
        return { output: `Selected: ${args[0]}`, isError: false }

      case "deselect":
        yield* testbedEffects.deselectEntity
        return { output: "Deselected", isError: false }

      case "query":
        if (!args[0]) return { output: "Usage: :query <trait>", isError: true }
        yield* testbedEffects.refreshEntities
        const filtered = state.data.entities.get().filter((e) =>
          e.traits.includes(args[0])
        )
        if (filtered.length === 0) {
          return { output: `No entities with trait: ${args[0]}`, isError: false }
        }
        const queryLines = filtered.map((e) => `  ${e.id.slice(0, 8)}...`)
        return {
          output: `Entities with ${args[0]} (${filtered.length}):\n${queryLines.join("\n")}`,
          isError: false,
        }

      case "count":
        yield* testbedEffects.refreshEntities
        return {
          output: `Entity count: ${state.data.entities.get().length}`,
          isError: false,
        }

      case "clear":
        const toDestroy = [...state.data.entities.get()]
        for (const e of toDestroy) {
          yield* testbedEffects.destroyEntity(e.id)
        }
        return { output: `Cleared ${toDestroy.length} entities`, isError: false }

      case "stats":
        yield* testbedEffects.refreshEntities
        const allEntities = state.data.entities.get()
        const traitCounts: Record<string, number> = {}
        for (const e of allEntities) {
          for (const t of e.traits) {
            traitCounts[t] = (traitCounts[t] || 0) + 1
          }
        }
        const statsLines = [
          `Entities: ${allEntities.length}`,
          `Trait counts:`,
          ...Object.entries(traitCounts).map(([t, c]) => `  ${t}: ${c}`),
        ]
        return { output: statsLines.join("\n"), isError: false }

      case "cls":
        yield* testbedEffects.clearRepl
        return { output: "", isError: false }

      default:
        return { output: `Unknown command: ${cmd}. Type :help for commands.`, isError: true }
    }
  })

// =============================================================================
// Computed Values
// =============================================================================

const testbedComputed = {
  entityCount: (get: KoriTestbedStx) => get.data.entities.get().length,
  selectedEntity: (get: KoriTestbedStx) => {
    const id = get.data.selectedEntityId.get()
    if (!id) return null
    return get.data.entities.get().find((e) => e.id === id) ?? null
  },
  replEntryCount: (get: KoriTestbedStx) => get.data.replHistory.get().length,
  activeScenario: (get: KoriTestbedStx) => {
    const id = get.data.activeScenarioId.get()
    if (!id) return null
    return get.data.scenarios.get().find((s) => s.id === id) ?? null
  },
}

// =============================================================================
// stx Instance Type
// =============================================================================

export type KoriTestbedStx = StxInstance<
  KoriTestbedData,
  typeof testbedMachine,
  typeof testbedEffects,
  typeof testbedComputed
>

// =============================================================================
// Singleton Instance
// =============================================================================

let koriTestbedStxInstance: KoriTestbedStx | null = null

/**
 * Get or create the KORI Testbed stx instance
 */
export const getKoriTestbedStx = (): KoriTestbedStx => {
  if (!koriTestbedStxInstance) {
    koriTestbedStxInstance = stx({
      machine: testbedMachine,
      data: initialData,
      effects: testbedEffects,
      computed: testbedComputed,
    }) as KoriTestbedStx
  }
  return koriTestbedStxInstance
}

/**
 * Reset the KORI Testbed stx instance
 */
export const resetKoriTestbedStx = (): void => {
  if (koriTestbedStxInstance) {
    koriTestbedStxInstance.dispose()
    koriTestbedStxInstance = null
  }
}
