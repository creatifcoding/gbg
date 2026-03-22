/**
 * Property-Based Machine Tests: Plant, Line, WorkCell
 *
 * Tests Machine + StateService integration using property-based testing.
 * Generates random valid transition sequences and verifies:
 * - State consistency after transitions
 * - Idempotent GET after transitions
 * - Invalid transitions yield correct error types
 *
 * Uses @effect/vitest it.effect pattern with Machine.boot, Effect.scoped,
 * InMemory state layers, and IIoTFeatureFlagsDisabledLayer.
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { FastCheck as fc } from 'effect'
import { Machine } from '@effect/experimental'

// =============================================================================
// Plant Imports
// =============================================================================
import {
  makePlantMachine,
  InternalCreatePlant,
  InternalGetPlant,
  InternalCompleteCommissioning,
  InternalScheduledShutdown,
  InternalRestart,
  InternalEmergencyShutdown,
  InternalBeginEmergencyMaintenance,
  InternalMaintenanceShutdown,
  InternalCompleteMaintenanceRestart,
  InternalDecommissionPlant,
} from '../../../machines/PlantMachine'
import {
  ALL_STATES as PLANT_ALL_STATES,
  getValidNextStates as plantNextStates,
  type PlantStateNode,
} from '../../../machines/graphs/plant-graph'

// =============================================================================
// Line Imports
// =============================================================================
import {
  makeLineMachine,
  InternalCreateLine,
  InternalGetLine,
  InternalStart,
  InternalStop,
  InternalBeginChangeover,
  InternalCompleteChangeover,
  InternalMarkStarved,
  InternalClearStarved,
  InternalMarkBlocked,
  InternalClearBlocked,
  InternalEnterMaintenance,
  InternalCompleteMaintenance,
  InternalDecommissionLine,
} from '../../../machines/LineMachine'
import {
  ALL_STATES as LINE_ALL_STATES,
  getValidNextStates as lineNextStates,
  type LineStateNode,
} from '../../../machines/graphs/line-graph'

// =============================================================================
// WorkCell Imports
// =============================================================================
import {
  makeWorkCellMachine,
  InternalCreateWorkCell,
  InternalGetWorkCell,
  InternalBeginSetup,
  InternalCompleteSetup,
  InternalStopWorkCell,
  InternalMarkBlockedWorkCell,
  InternalClearBlockedWorkCell,
  InternalMarkFaulted,
  InternalClearFault,
  InternalEnterMaintenanceWorkCell,
  InternalCompleteMaintenanceWorkCell,
  InternalDecommissionWorkCell,
} from '../../../machines/WorkCellMachine'
import {
  ALL_STATES as WORKCELL_ALL_STATES,
  getValidNextStates as workcellNextStates,
  type WorkcellStateNode,
} from '../../../machines/graphs/workcell-graph'

// =============================================================================
// State & Infrastructure Imports
// =============================================================================
import {
  PlantState,
  PlantStateInMemory,
  LineState,
  LineStateInMemory,
  WorkCellState,
  WorkCellStateInMemory,
} from '../../../state'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../../infrastructure/feature-flags'
import type { CreatePlantParams } from '../../../schemas/assets/plant'
import type { CreateLineParams } from '../../../schemas/assets/line'
import type { CreateWorkCellParams } from '../../../schemas/assets/workcell'
import type { PlantId, LineId } from '../../../schemas/identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestPlantParams = (slug = 'prop-plant'): CreatePlantParams => ({
  slug,
  name: 'Property Test Plant' as CreatePlantParams['name'],
  timezone: 'America/Chicago',
  status: Option.none(),
  siteCode: Option.none(),
  description: Option.none(),
  location: Option.none(),
  metadata: Option.none(),
})

const createTestLineParams = (slug = 'prop-line'): CreateLineParams => ({
  slug: slug as CreateLineParams['slug'],
  name: 'Property Test Line' as CreateLineParams['name'],
  plantId: 'PLT-prop-plant' as PlantId,
  status: 'idle',
})

const createTestWorkCellParams = (slug = 'prop-workcell'): CreateWorkCellParams => ({
  slug: slug as CreateWorkCellParams['slug'],
  name: 'Property Test WorkCell' as CreateWorkCellParams['name'],
  lineId: 'LIN-prop-line' as LineId,
  status: 'idle',
})

// =============================================================================
// Plant Transition Mapping
// =============================================================================

/**
 * Maps a (from, to) transition pair to the correct InternalRequest for Plant.
 */
function plantTransitionRequest(plantId: string, from: PlantStateNode, to: PlantStateNode) {
  if (from === 'commissioning' && to === 'operational') {
    return new InternalCompleteCommissioning({ plantId })
  }
  if (from === 'operational' && to === 'scheduled_shutdown') {
    return new InternalScheduledShutdown({ plantId })
  }
  if (from === 'operational' && to === 'emergency_shutdown') {
    return new InternalEmergencyShutdown({ plantId })
  }
  if (from === 'operational' && to === 'maintenance_shutdown') {
    return new InternalMaintenanceShutdown({ plantId })
  }
  if (from === 'scheduled_shutdown' && to === 'operational') {
    return new InternalRestart({ plantId })
  }
  if (from === 'scheduled_shutdown' && to === 'decommissioned') {
    return new InternalDecommissionPlant({ plantId })
  }
  if (from === 'emergency_shutdown' && to === 'maintenance_shutdown') {
    return new InternalBeginEmergencyMaintenance({ plantId })
  }
  if (from === 'maintenance_shutdown' && to === 'operational') {
    return new InternalCompleteMaintenanceRestart({ plantId })
  }
  if (from === 'maintenance_shutdown' && to === 'decommissioned') {
    return new InternalDecommissionPlant({ plantId })
  }
  throw new Error(`No request for plant transition ${from} -> ${to}`)
}

/**
 * Generate a random valid transition sequence for Plant, starting from commissioning.
 */
function generatePlantTransitionSequence(
  choices: number[],
  maxSteps: number
): Array<{ from: PlantStateNode; to: PlantStateNode }> {
  const transitions: Array<{ from: PlantStateNode; to: PlantStateNode }> = []
  let current: PlantStateNode = 'commissioning'

  for (let i = 0; i < Math.min(choices.length, maxSteps); i++) {
    const next = plantNextStates(current) as PlantStateNode[]
    if (next.length === 0) break
    const target = next[choices[i] % next.length]
    transitions.push({ from: current, to: target })
    current = target
  }

  return transitions
}

// =============================================================================
// Line Transition Mapping
// =============================================================================

function lineTransitionRequest(lineId: string, from: LineStateNode, to: LineStateNode) {
  if (from === 'idle' && to === 'running') return new InternalStart({ lineId })
  if (from === 'idle' && to === 'maintenance') return new InternalEnterMaintenance({ lineId })
  if (from === 'idle' && to === 'decommissioned') return new InternalDecommissionLine({ lineId })
  if (from === 'running' && to === 'idle') return new InternalStop({ lineId })
  if (from === 'running' && to === 'changeover') return new InternalBeginChangeover({ lineId })
  if (from === 'running' && to === 'starved') return new InternalMarkStarved({ lineId })
  if (from === 'running' && to === 'blocked') return new InternalMarkBlocked({ lineId })
  if (from === 'running' && to === 'maintenance') return new InternalEnterMaintenance({ lineId })
  if (from === 'changeover' && to === 'running') return new InternalCompleteChangeover({ lineId })
  if (from === 'starved' && to === 'running') return new InternalClearStarved({ lineId })
  if (from === 'blocked' && to === 'running') return new InternalClearBlocked({ lineId })
  if (from === 'maintenance' && to === 'idle') return new InternalCompleteMaintenance({ lineId })
  if (from === 'maintenance' && to === 'decommissioned') return new InternalDecommissionLine({ lineId })
  throw new Error(`No request for line transition ${from} -> ${to}`)
}

function generateLineTransitionSequence(
  choices: number[],
  maxSteps: number
): Array<{ from: LineStateNode; to: LineStateNode }> {
  const transitions: Array<{ from: LineStateNode; to: LineStateNode }> = []
  let current: LineStateNode = 'idle'

  for (let i = 0; i < Math.min(choices.length, maxSteps); i++) {
    const next = lineNextStates(current) as LineStateNode[]
    if (next.length === 0) break
    const target = next[choices[i] % next.length]
    transitions.push({ from: current, to: target })
    current = target
  }

  return transitions
}

// =============================================================================
// WorkCell Transition Mapping
// =============================================================================

function workcellTransitionRequest(workCellId: string, from: WorkcellStateNode, to: WorkcellStateNode) {
  if (from === 'idle' && to === 'setup') return new InternalBeginSetup({ workCellId })
  if (from === 'idle' && to === 'maintenance') return new InternalEnterMaintenanceWorkCell({ workCellId })
  if (from === 'idle' && to === 'decommissioned') return new InternalDecommissionWorkCell({ workCellId })
  if (from === 'setup' && to === 'running') return new InternalCompleteSetup({ workCellId })
  if (from === 'running' && to === 'idle') return new InternalStopWorkCell({ workCellId })
  if (from === 'running' && to === 'blocked') return new InternalMarkBlockedWorkCell({ workCellId })
  if (from === 'running' && to === 'faulted') return new InternalMarkFaulted({ workCellId })
  if (from === 'blocked' && to === 'running') return new InternalClearBlockedWorkCell({ workCellId })
  if (from === 'faulted' && to === 'idle') return new InternalClearFault({ workCellId })
  if (from === 'faulted' && to === 'maintenance') return new InternalEnterMaintenanceWorkCell({ workCellId })
  if (from === 'maintenance' && to === 'idle') return new InternalCompleteMaintenanceWorkCell({ workCellId })
  if (from === 'maintenance' && to === 'decommissioned') return new InternalDecommissionWorkCell({ workCellId })
  throw new Error(`No request for workcell transition ${from} -> ${to}`)
}

function generateWorkcellTransitionSequence(
  choices: number[],
  maxSteps: number
): Array<{ from: WorkcellStateNode; to: WorkcellStateNode }> {
  const transitions: Array<{ from: WorkcellStateNode; to: WorkcellStateNode }> = []
  let current: WorkcellStateNode = 'idle'

  for (let i = 0; i < Math.min(choices.length, maxSteps); i++) {
    const next = workcellNextStates(current) as WorkcellStateNode[]
    if (next.length === 0) break
    const target = next[choices[i] % next.length]
    transitions.push({ from: current, to: target })
    current = target
  }

  return transitions
}

// =============================================================================
// Plant Machine Property Tests
// =============================================================================

describe('PlantMachine Property Tests', () => {
  it.effect('random valid transition sequences maintain state consistency', () =>
    Effect.gen(function* () {
      const state = yield* PlantState
      const flags = yield* IIoTFeatureFlags
      const machine = makePlantMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      // Run 10 random sequences within a single scoped machine
      const sequences = fc.sample(
        fc.array(fc.nat({ max: 50 }), { minLength: 1, maxLength: 8 }),
        10
      )

      for (let seqIdx = 0; seqIdx < sequences.length; seqIdx++) {
        const slug = `plant-seq-${seqIdx}`
        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams(slug) })
        )

        const transitions = generatePlantTransitionSequence(sequences[seqIdx], 8)

        let expectedState: PlantStateNode = 'commissioning'
        for (const { from, to } of transitions) {
          expect(from).toBe(expectedState)
          const request = plantTransitionRequest(created.id, from, to)
          const result = yield* actor.send(request)
          expect(result.status).toBe(to)
          expectedState = to
        }

        // Idempotent GET after all transitions
        const fetched = yield* actor.send(
          new InternalGetPlant({ plantId: created.id })
        )
        expect(fetched.status).toBe(expectedState)
      }
    }).pipe(
      Effect.scoped,
      Effect.provide(PlantStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('invalid transitions yield MachinePlantInvalidTransitionError', () =>
    Effect.gen(function* () {
      const state = yield* PlantState
      const flags = yield* IIoTFeatureFlags
      const machine = makePlantMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreatePlant({ params: createTestPlantParams('invalid-test') })
      )

      // Plant starts in 'commissioning' -- try decommission (invalid from commissioning)
      const result = yield* actor.send(
        new InternalDecommissionPlant({ plantId: created.id })
      ).pipe(Effect.either)

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('MachinePlantInvalidTransitionError')
      }
    }).pipe(
      Effect.scoped,
      Effect.provide(PlantStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('GET is idempotent (multiple GETs return same result)', () =>
    Effect.gen(function* () {
      const state = yield* PlantState
      const flags = yield* IIoTFeatureFlags
      const machine = makePlantMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreatePlant({ params: createTestPlantParams('idempotent-test') })
      )

      yield* actor.send(new InternalCompleteCommissioning({ plantId: created.id }))

      const get1 = yield* actor.send(new InternalGetPlant({ plantId: created.id }))
      const get2 = yield* actor.send(new InternalGetPlant({ plantId: created.id }))

      expect(get1.id).toBe(get2.id)
      expect(get1.status).toBe(get2.status)
      expect(get1.status).toBe('operational')
    }).pipe(
      Effect.scoped,
      Effect.provide(PlantStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )
})

// =============================================================================
// Line Machine Property Tests
// =============================================================================

describe('LineMachine Property Tests', () => {
  it.effect('random valid transition sequences maintain state consistency', () =>
    Effect.gen(function* () {
      const state = yield* LineState
      const flags = yield* IIoTFeatureFlags
      const machine = makeLineMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const sequences = fc.sample(
        fc.array(fc.nat({ max: 50 }), { minLength: 1, maxLength: 10 }),
        10
      )

      for (let seqIdx = 0; seqIdx < sequences.length; seqIdx++) {
        const slug = `line-seq-${seqIdx}`
        const created = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams(slug) })
        )

        const transitions = generateLineTransitionSequence(sequences[seqIdx], 10)

        let expectedState: LineStateNode = 'idle'
        for (const { from, to } of transitions) {
          expect(from).toBe(expectedState)
          const request = lineTransitionRequest(created.id, from, to)
          const result = yield* actor.send(request)
          expect(result.status).toBe(to)
          expectedState = to
        }

        // Idempotent GET
        const fetched = yield* actor.send(
          new InternalGetLine({ lineId: created.id })
        )
        expect(fetched.status).toBe(expectedState)
      }
    }).pipe(
      Effect.scoped,
      Effect.provide(LineStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('invalid transitions yield MachineLineInvalidTransitionError', () =>
    Effect.gen(function* () {
      const state = yield* LineState
      const flags = yield* IIoTFeatureFlags
      const machine = makeLineMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateLine({ params: createTestLineParams('invalid-test') })
      )

      // Line starts in 'idle' -- try changeover (only valid from running)
      const result = yield* actor.send(
        new InternalBeginChangeover({ lineId: created.id })
      ).pipe(Effect.either)

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('MachineLineInvalidTransitionError')
      }
    }).pipe(
      Effect.scoped,
      Effect.provide(LineStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('GET is idempotent (multiple GETs return same result)', () =>
    Effect.gen(function* () {
      const state = yield* LineState
      const flags = yield* IIoTFeatureFlags
      const machine = makeLineMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateLine({ params: createTestLineParams('idempotent-test') })
      )

      yield* actor.send(new InternalStart({ lineId: created.id }))

      const get1 = yield* actor.send(new InternalGetLine({ lineId: created.id }))
      const get2 = yield* actor.send(new InternalGetLine({ lineId: created.id }))

      expect(get1.id).toBe(get2.id)
      expect(get1.status).toBe(get2.status)
      expect(get1.status).toBe('running')
    }).pipe(
      Effect.scoped,
      Effect.provide(LineStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('changeover cycle returns to running', () =>
    Effect.gen(function* () {
      const state = yield* LineState
      const flags = yield* IIoTFeatureFlags
      const machine = makeLineMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateLine({ params: createTestLineParams('changeover-cycle') })
      )

      // idle -> running -> changeover -> running
      yield* actor.send(new InternalStart({ lineId: created.id }))
      yield* actor.send(new InternalBeginChangeover({ lineId: created.id }))
      const result = yield* actor.send(new InternalCompleteChangeover({ lineId: created.id }))

      expect(result.status).toBe('running')
    }).pipe(
      Effect.scoped,
      Effect.provide(LineStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )
})

// =============================================================================
// WorkCell Machine Property Tests
// =============================================================================

describe('WorkCellMachine Property Tests', () => {
  it.effect('random valid transition sequences maintain state consistency', () =>
    Effect.gen(function* () {
      const state = yield* WorkCellState
      const flags = yield* IIoTFeatureFlags
      const machine = makeWorkCellMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const sequences = fc.sample(
        fc.array(fc.nat({ max: 50 }), { minLength: 1, maxLength: 10 }),
        10
      )

      for (let seqIdx = 0; seqIdx < sequences.length; seqIdx++) {
        const slug = `workcell-seq-${seqIdx}`
        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams(slug) })
        )

        const transitions = generateWorkcellTransitionSequence(sequences[seqIdx], 10)

        let expectedState: WorkcellStateNode = 'idle'
        for (const { from, to } of transitions) {
          expect(from).toBe(expectedState)
          const request = workcellTransitionRequest(created.id, from, to)
          const result = yield* actor.send(request)
          expect(result.status).toBe(to)
          expectedState = to
        }

        // Idempotent GET
        const fetched = yield* actor.send(
          new InternalGetWorkCell({ workCellId: created.id })
        )
        expect(fetched.status).toBe(expectedState)
      }
    }).pipe(
      Effect.scoped,
      Effect.provide(WorkCellStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('invalid transitions yield MachineWorkCellInvalidTransitionError', () =>
    Effect.gen(function* () {
      const state = yield* WorkCellState
      const flags = yield* IIoTFeatureFlags
      const machine = makeWorkCellMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateWorkCell({ params: createTestWorkCellParams('invalid-test') })
      )

      // WorkCell starts in 'idle' -- try stop (only valid from running)
      const result = yield* actor.send(
        new InternalStopWorkCell({ workCellId: created.id })
      ).pipe(Effect.either)

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('MachineWorkCellInvalidTransitionError')
      }
    }).pipe(
      Effect.scoped,
      Effect.provide(WorkCellStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('GET is idempotent (multiple GETs return same result)', () =>
    Effect.gen(function* () {
      const state = yield* WorkCellState
      const flags = yield* IIoTFeatureFlags
      const machine = makeWorkCellMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateWorkCell({ params: createTestWorkCellParams('idempotent-test') })
      )

      // idle -> setup -> running
      yield* actor.send(new InternalBeginSetup({ workCellId: created.id }))
      yield* actor.send(new InternalCompleteSetup({ workCellId: created.id }))

      const get1 = yield* actor.send(new InternalGetWorkCell({ workCellId: created.id }))
      const get2 = yield* actor.send(new InternalGetWorkCell({ workCellId: created.id }))

      expect(get1.id).toBe(get2.id)
      expect(get1.status).toBe(get2.status)
      expect(get1.status).toBe('running')
    }).pipe(
      Effect.scoped,
      Effect.provide(WorkCellStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('setup -> producing cycle (idle -> setup -> running)', () =>
    Effect.gen(function* () {
      const state = yield* WorkCellState
      const flags = yield* IIoTFeatureFlags
      const machine = makeWorkCellMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateWorkCell({ params: createTestWorkCellParams('setup-cycle') })
      )

      const setup = yield* actor.send(new InternalBeginSetup({ workCellId: created.id }))
      expect(setup.status).toBe('setup')

      const running = yield* actor.send(new InternalCompleteSetup({ workCellId: created.id }))
      expect(running.status).toBe('running')
    }).pipe(
      Effect.scoped,
      Effect.provide(WorkCellStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('fault recovery: running -> faulted -> idle', () =>
    Effect.gen(function* () {
      const state = yield* WorkCellState
      const flags = yield* IIoTFeatureFlags
      const machine = makeWorkCellMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateWorkCell({ params: createTestWorkCellParams('fault-recovery') })
      )

      // idle -> setup -> running -> faulted -> idle
      yield* actor.send(new InternalBeginSetup({ workCellId: created.id }))
      yield* actor.send(new InternalCompleteSetup({ workCellId: created.id }))
      yield* actor.send(new InternalMarkFaulted({ workCellId: created.id }))
      const recovered = yield* actor.send(new InternalClearFault({ workCellId: created.id }))

      expect(recovered.status).toBe('idle')
    }).pipe(
      Effect.scoped,
      Effect.provide(WorkCellStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )
})
