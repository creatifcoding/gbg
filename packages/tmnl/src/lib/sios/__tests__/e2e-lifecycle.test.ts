/**
 * SIOS E2E Lifecycle Test
 *
 * Proves the full vertical:
 *   Create Project → Zones → Work Packages → Tasks → Start Tasks →
 *   Record Progress → Complete Tasks → Verify EVM calculations →
 *   Complete WP → Project lifecycle transitions
 *
 * Runs against FullTestingStack (in-memory state, no SQL, no cluster).
 * Uses Machine.boot directly — no Entity/cluster layer needed.
 *
 * @module sios/__tests__/e2e-lifecycle
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { Machine } from '@effect/experimental'

// State services
import {
  ProjectState, ProjectStateInMemory,
  ZoneState, ZoneStateInMemory,
  WorkPackageState, WorkPackageStateInMemory,
  TaskState, TaskStateInMemory,
  AllStateServicesInMemory,
} from '../state'

// Machines + Internal commands
import {
  makeProjectMachine,
  InternalCreateProject, InternalGetProject,
  InternalAwardProject, InternalMobiliseProject,
  InternalActivateProject, InternalCommissionProject,
  InternalCompleteProject,
} from '../machines/ProjectMachine'
import {
  makeZoneMachine,
  InternalCreateZone, InternalActivateZone,
} from '../machines/ZoneMachine'
import {
  makeWorkPackageMachine,
  InternalCreateWP, InternalActivateWP,
  InternalRecordProgress, InternalCompleteWP,
} from '../machines/WorkPackageMachine'
import {
  makeTaskMachine,
  InternalCreateTask, InternalStartTask,
  InternalCompleteTask,
} from '../machines/TaskMachine'

// Infrastructure
import { SiosFlagsDisabledLayer, SiosFeatureFlags } from '../infrastructure'

// Types
import type { ProjectId } from '../schemas/identifiers'

// =============================================================================
// Tests
// =============================================================================

describe('SIOS E2E Lifecycle', () => {

  it.effect('full airport BHS project lifecycle: create → zones → WPs → tasks → EVM → complete', () =>
    Effect.gen(function* () {
      // ─── Boot all machines ─────────────────────────────────────────
      const projectState = yield* ProjectState
      const zoneState = yield* ZoneState
      const wpState = yield* WorkPackageState
      const taskState = yield* TaskState
      const flags = yield* SiosFeatureFlags

      const projectMachine = makeProjectMachine({ state: projectState, flags })
      const zoneMachine = makeZoneMachine({ state: zoneState, flags })
      const wpMachine = makeWorkPackageMachine({ state: wpState, flags })
      const taskMachine = makeTaskMachine({ state: taskState, flags })

      const projectActor = yield* Machine.boot(projectMachine)
      const zoneActor = yield* Machine.boot(zoneMachine)
      const wpActor = yield* Machine.boot(wpMachine)
      const taskActor = yield* Machine.boot(taskMachine)

      // ─── 1. Create Project ─────────────────────────────────────────
      const project = yield* projectActor.send(
        new InternalCreateProject({
          params: {
            name: 'DFW Terminal B BHS Modernization' as any,
            code: 'DFW-BHS-2025' as any,
            client: 'Dallas Fort Worth International Airport' as any,
            projectType: 'airport_bhs',
            deliveryMethod: 'design_build',
            siteCondition: 'brownfield_full',
            budgetedCost: 12_500_000,
          },
        })
      )
      expect(project.status).toBe('bidding')
      expect(project.name).toBe('DFW Terminal B BHS Modernization')

      // ─── 2. Project lifecycle: bidding → awarded → mobilising → active
      const awarded = yield* projectActor.send(
        new InternalAwardProject({ projectId: project.id })
      )
      expect(awarded.status).toBe('awarded')

      const mobilised = yield* projectActor.send(
        new InternalMobiliseProject({ projectId: project.id })
      )
      expect(mobilised.status).toBe('mobilising')

      const active = yield* projectActor.send(
        new InternalActivateProject({ projectId: project.id })
      )
      expect(active.status).toBe('active')

      // ─── 3. Create Zones ───────────────────────────────────────────
      const zone1 = yield* zoneActor.send(
        new InternalCreateZone({
          params: {
            projectId: project.id,
            name: 'Ticketing Hall' as any,
            code: 'Z-TH' as any,
            phaseNumber: 1,
          },
        })
      )
      expect(zone1.status).toBe('defined')

      const zone2 = yield* zoneActor.send(
        new InternalCreateZone({
          params: {
            projectId: project.id,
            name: 'Sortation Level' as any,
            code: 'Z-SL' as any,
            phaseNumber: 2,
          },
        })
      )
      expect(zone2.status).toBe('defined')

      // Activate zones
      const z1Active = yield* zoneActor.send(
        new InternalActivateZone({ zoneId: zone1.id })
      )
      expect(z1Active.status).toBe('active')

      // ─── 4. Create Work Packages ───────────────────────────────────
      const wpConveyor = yield* wpActor.send(
        new InternalCreateWP({
          params: {
            zoneId: zone1.id,
            projectId: project.id,
            discipline: 'mechanical',
            name: 'Belt Conveyor Installation' as any,
            progressUnit: 'linear_meters',
            plannedQty: 1000,
            budgetedHours: 500,
            budgetedCost: 250_000,
          },
        })
      )
      expect(wpConveyor.status).toBe('planned')
      expect(wpConveyor.budgetedCost).toBe(250_000)
      expect(wpConveyor.plannedQty).toBe(1000)

      const wpElectrical = yield* wpActor.send(
        new InternalCreateWP({
          params: {
            zoneId: zone1.id,
            projectId: project.id,
            discipline: 'electrical',
            name: 'Power Distribution' as any,
            progressUnit: 'units',
            plannedQty: 50,
            budgetedHours: 200,
            budgetedCost: 100_000,
          },
        })
      )
      expect(wpElectrical.status).toBe('planned')

      // Activate WP
      const wpActive = yield* wpActor.send(
        new InternalActivateWP({ workPackageId: wpConveyor.id })
      )
      expect(wpActive.status).toBe('active')

      // ─── 5. Create Tasks ───────────────────────────────────────────
      const task1 = yield* taskActor.send(
        new InternalCreateTask({
          params: {
            workPackageId: wpConveyor.id,
            title: 'Install belt sections A1-A10' as any,
            priority: 'high',
            plannedQty: 400,
            plannedHours: 200,
            requiresEvidence: false,
            sortOrder: 1,
          },
        })
      )
      expect(task1.status).toBe('pending')

      const task2 = yield* taskActor.send(
        new InternalCreateTask({
          params: {
            workPackageId: wpConveyor.id,
            title: 'Install belt sections A11-A25' as any,
            priority: 'normal',
            plannedQty: 600,
            plannedHours: 300,
            requiresEvidence: false,
            sortOrder: 2,
          },
        })
      )
      expect(task2.status).toBe('pending')

      // ─── 6. Start and Complete Tasks ───────────────────────────────
      const t1Started = yield* taskActor.send(
        new InternalStartTask({ taskId: task1.id })
      )
      expect(t1Started.status).toBe('active')

      // Complete task 1 with actual work
      const t1Done = yield* taskActor.send(
        new InternalCompleteTask({
          taskId: task1.id,
          actualQty: 400,
          actualHours: 180,
        })
      )
      expect(t1Done.status).toBe('done')
      expect(t1Done.actualQty).toBe(400)
      expect(t1Done.actualHours).toBe(180)

      // ─── 7. Record Progress on Work Package ───────────────────────
      // Record the progress from completed task 1 onto the WP
      const wpAfterProgress = yield* wpActor.send(
        new InternalRecordProgress({
          workPackageId: wpConveyor.id,
          qtyCompleted: 400,
          hoursExpended: 180,
          costExpended: 90_000,
        })
      )

      // ─── 8. Verify EVM Calculations ────────────────────────────────
      // 400/1000 = 40% complete
      expect(wpAfterProgress.percentComplete()).toBe(40)
      // EV = budgetedCost × (actualQty/plannedQty) = 250000 × 0.4 = 100000
      expect(wpAfterProgress.earnedValue()).toBe(100_000)
      // CPI = EV / AC = 100000 / 90000 ≈ 1.11
      expect(wpAfterProgress.cpi()).toBeCloseTo(1.11, 1)
      // CV = EV - AC = 100000 - 90000 = 10000
      expect(wpAfterProgress.costVariance()).toBe(10_000)
      // Under budget!
      expect(wpAfterProgress.isOverBudget()).toBe(false)

      // ─── 9. Start task 2, complete, record more progress ───────────
      yield* taskActor.send(new InternalStartTask({ taskId: task2.id }))

      yield* taskActor.send(
        new InternalCompleteTask({
          taskId: task2.id,
          actualQty: 600,
          actualHours: 350,
        })
      )

      const wpFinal = yield* wpActor.send(
        new InternalRecordProgress({
          workPackageId: wpConveyor.id,
          qtyCompleted: 600,
          hoursExpended: 350,
          costExpended: 175_000,
        })
      )

      // 1000/1000 = 100% complete
      expect(wpFinal.percentComplete()).toBe(100)
      // EV = 250000 × 1.0 = 250000
      expect(wpFinal.earnedValue()).toBe(250_000)
      // Total AC = 90000 + 175000 = 265000
      expect(wpFinal.actualCost).toBe(265_000)
      // CPI = 250000 / 265000 ≈ 0.94
      expect(wpFinal.cpi()).toBeCloseTo(0.943, 2)
      // Now slightly over budget
      expect(wpFinal.isOverBudget()).toBe(true)

      // ─── 10. Complete the Work Package ─────────────────────────────
      const wpCompleted = yield* wpActor.send(
        new InternalCompleteWP({ workPackageId: wpConveyor.id })
      )
      expect(wpCompleted.status).toBe('complete')

      // ─── 11. Project lifecycle: active → commissioning → complete ──
      const commissioning = yield* projectActor.send(
        new InternalCommissionProject({ projectId: project.id })
      )
      expect(commissioning.status).toBe('commissioning')

      const completed = yield* projectActor.send(
        new InternalCompleteProject({ projectId: project.id })
      )
      expect(completed.status).toBe('complete')

      // Verify final state
      const finalProject = yield* projectActor.send(
        new InternalGetProject({ projectId: project.id })
      )
      expect(finalProject.status).toBe('complete')
      expect(finalProject.name).toBe('DFW Terminal B BHS Modernization')
    }).pipe(
      Effect.scoped,
      Effect.provide(AllStateServicesInMemory),
      Effect.provide(SiosFlagsDisabledLayer),
    )
  )

  it.effect('rejects invalid state transitions', () =>
    Effect.gen(function* () {
      const projectState = yield* ProjectState
      const flags = yield* SiosFeatureFlags

      const projectMachine = makeProjectMachine({ state: projectState, flags })
      const projectActor = yield* Machine.boot(projectMachine)

      const project = yield* projectActor.send(
        new InternalCreateProject({
          params: {
            name: 'Test Project' as any,
            code: 'TST-001' as any,
            client: 'Test Client' as any,
            projectType: 'warehouse_sortation',
            deliveryMethod: 'design_build',
            siteCondition: 'greenfield',
            budgetedCost: 1_000_000,
          },
        })
      )
      expect(project.status).toBe('bidding')

      // Can't activate from bidding (must go through awarded → mobilising first)
      const badTransition = yield* projectActor.send(
        new InternalActivateProject({ projectId: project.id })
      ).pipe(Effect.either)

      expect(badTransition._tag).toBe('Left')

      // Can't commission from bidding
      const badCommission = yield* projectActor.send(
        new InternalCommissionProject({ projectId: project.id })
      ).pipe(Effect.either)

      expect(badCommission._tag).toBe('Left')
    }).pipe(
      Effect.scoped,
      Effect.provide(ProjectStateInMemory),
      Effect.provide(SiosFlagsDisabledLayer),
    )
  )
})
