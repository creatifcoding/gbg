/**
 * GridDragService Tests
 *
 * Tests for the Effect-based drag service state machine.
 * @module data-grid/__tests__/GridDragService
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import {
  GridDragService,
  GridDragServiceLive,
  gridDragStart,
  gridDragMove,
  gridExit,
  canvasEnter,
  canvasMove,
  drop,
  cancel,
} from '../services'
import { DragPhase as DragPhaseEnum, INITIAL_DRAG_STATE, type DataGridRow } from '../types'

// =============================================================================
// Test Helpers
// =============================================================================

const runTest = <A, E>(effect: Effect.Effect<A, E, GridDragService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(GridDragServiceLive)))

const mockRow: DataGridRow = {
  id: 'test-row-1',
  name: 'Test Row',
  value: 42,
  status: 'active',
}

const mockPoint = { x: 100, y: 200 }

// =============================================================================
// Service Initialization Tests
// =============================================================================

describe('GridDragService', () => {
  describe('initialization', () => {
    test('service starts with INITIAL_DRAG_STATE', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService
          const state = yield* service.getState

          expect(state.phase).toBe(DragPhaseEnum.Idle)
          expect(state.rowData).toBeNull()
          expect(state.ghostShapeId).toBeNull()
          expect(state.startPos).toBeNull()
          expect(state.currentPos).toBeNull()
          expect(state.gridId).toBeNull()
        })
      )
    })

    test('isDragging returns false initially', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService
          const dragging = yield* service.isDragging

          expect(dragging).toBe(false)
        })
      )
    })
  })

  // ===========================================================================
  // Event Dispatch Tests
  // ===========================================================================

  describe('dispatch: GridDragStart', () => {
    test('transitions from Idle to GridInternal', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))

          const state = yield* service.getState
          expect(state.phase).toBe(DragPhaseEnum.GridInternal)
        })
      )
    })

    test('captures rowData', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))

          const state = yield* service.getState
          expect(state.rowData).toEqual(mockRow)
        })
      )
    })

    test('captures gridId', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))

          const state = yield* service.getState
          expect(state.gridId).toBe('grid-001')
        })
      )
    })

    test('sets both startPos and currentPos', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))

          const state = yield* service.getState
          expect(state.startPos).toEqual(mockPoint)
          expect(state.currentPos).toEqual(mockPoint)
        })
      )
    })

    test('isDragging returns true after start', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))

          const dragging = yield* service.isDragging
          expect(dragging).toBe(true)
        })
      )
    })
  })

  describe('dispatch: GridDragMove', () => {
    test('updates currentPos while inside grid', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          // Start drag
          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))

          // Move inside
          const newPos = { x: 150, y: 250 }
          yield* service.dispatch(gridDragMove(newPos, true))

          const state = yield* service.getState
          expect(state.currentPos).toEqual(newPos)
          expect(state.phase).toBe(DragPhaseEnum.GridInternal)
        })
      )
    })

    test('transitions to Transitioning when exiting grid', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          // Start drag
          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))

          // Move outside
          const exitPos = { x: 500, y: 500 }
          yield* service.dispatch(gridDragMove(exitPos, false))

          const state = yield* service.getState
          expect(state.phase).toBe(DragPhaseEnum.Transitioning)
          expect(state.currentPos).toEqual(exitPos)
        })
      )
    })
  })

  describe('dispatch: GridExit', () => {
    test('sets phase to Transitioning', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))
          yield* service.dispatch(gridExit({ x: 300, y: 300 }, mockRow))

          const state = yield* service.getState
          expect(state.phase).toBe(DragPhaseEnum.Transitioning)
        })
      )
    })

    test('updates currentPos to exitPos', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))

          const exitPos = { x: 300, y: 300 }
          yield* service.dispatch(gridExit(exitPos, mockRow))

          const state = yield* service.getState
          expect(state.currentPos).toEqual(exitPos)
        })
      )
    })
  })

  describe('dispatch: CanvasEnter', () => {
    test('transitions to CanvasTracking', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))
          yield* service.dispatch(canvasEnter({ x: 400, y: 400 }, 'ghost-123'))

          const state = yield* service.getState
          expect(state.phase).toBe(DragPhaseEnum.CanvasTracking)
        })
      )
    })

    test('captures ghostShapeId', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))
          yield* service.dispatch(canvasEnter({ x: 400, y: 400 }, 'ghost-123'))

          const state = yield* service.getState
          expect(state.ghostShapeId).toBe('ghost-123')
        })
      )
    })
  })

  describe('dispatch: CanvasMove', () => {
    test('updates currentPos during canvas tracking', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))
          yield* service.dispatch(canvasEnter({ x: 400, y: 400 }, 'ghost-123'))

          const newCanvasPos = { x: 500, y: 500 }
          yield* service.dispatch(canvasMove({ x: 550, y: 550 }, newCanvasPos))

          const state = yield* service.getState
          expect(state.currentPos).toEqual(newCanvasPos)
        })
      )
    })
  })

  describe('dispatch: Drop', () => {
    test('resets to INITIAL_DRAG_STATE', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          // Full drag sequence
          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))
          yield* service.dispatch(canvasEnter({ x: 400, y: 400 }, 'ghost-123'))
          yield* service.dispatch(drop({ x: 450, y: 450 }, mockRow))

          const state = yield* service.getState
          expect(state).toEqual(INITIAL_DRAG_STATE)
        })
      )
    })

    test('isDragging returns false after drop', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))
          yield* service.dispatch(drop({ x: 450, y: 450 }, mockRow))

          const dragging = yield* service.isDragging
          expect(dragging).toBe(false)
        })
      )
    })
  })

  describe('dispatch: Cancel', () => {
    test('resets to INITIAL_DRAG_STATE', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))
          yield* service.dispatch(cancel('User pressed Escape'))

          const state = yield* service.getState
          expect(state).toEqual(INITIAL_DRAG_STATE)
        })
      )
    })

    test('isDragging returns false after cancel', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))
          yield* service.dispatch(cancel('Escape'))

          const dragging = yield* service.isDragging
          expect(dragging).toBe(false)
        })
      )
    })
  })

  // ===========================================================================
  // Reset Tests
  // ===========================================================================

  describe('reset', () => {
    test('returns to INITIAL_DRAG_STATE from any phase', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          // Get into complex state
          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))
          yield* service.dispatch(canvasEnter({ x: 400, y: 400 }, 'ghost-123'))

          // Verify we're not in initial state
          const beforeReset = yield* service.getState
          expect(beforeReset.phase).not.toBe(DragPhaseEnum.Idle)

          // Reset
          yield* service.reset

          // Verify we're back to initial
          const afterReset = yield* service.getState
          expect(afterReset).toEqual(INITIAL_DRAG_STATE)
        })
      )
    })
  })

  // ===========================================================================
  // Full Drag Sequence Tests
  // ===========================================================================

  describe('full drag sequence', () => {
    test('internal reorder: start → move → end', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          // Start
          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))
          expect((yield* service.getState).phase).toBe(DragPhaseEnum.GridInternal)

          // Move within grid
          yield* service.dispatch(gridDragMove({ x: 150, y: 250 }, true))
          expect((yield* service.getState).phase).toBe(DragPhaseEnum.GridInternal)

          // Complete (simulated by reset since AG-Grid handles internally)
          yield* service.reset
          expect((yield* service.getState).phase).toBe(DragPhaseEnum.Idle)
        })
      )
    })

    test('external drop: start → exit → canvas → drop', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          // Start drag
          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))
          expect((yield* service.getState).phase).toBe(DragPhaseEnum.GridInternal)

          // Exit grid bounds
          yield* service.dispatch(gridDragMove({ x: 500, y: 500 }, false))
          expect((yield* service.getState).phase).toBe(DragPhaseEnum.Transitioning)

          // Enter canvas tracking
          yield* service.dispatch(canvasEnter({ x: 600, y: 600 }, 'ghost-shape'))
          expect((yield* service.getState).phase).toBe(DragPhaseEnum.CanvasTracking)

          // Move on canvas
          yield* service.dispatch(canvasMove({ x: 650, y: 650 }, { x: 700, y: 700 }))
          expect((yield* service.getState).currentPos).toEqual({ x: 700, y: 700 })

          // Drop
          yield* service.dispatch(drop({ x: 700, y: 700 }, mockRow))
          expect((yield* service.getState).phase).toBe(DragPhaseEnum.Idle)
        })
      )
    })

    test('cancelled drag: start → exit → cancel', async () => {
      await runTest(
        Effect.gen(function* () {
          const service = yield* GridDragService

          yield* service.dispatch(gridDragStart(mockRow, 'grid-001', mockPoint))
          yield* service.dispatch(gridDragMove({ x: 500, y: 500 }, false))
          yield* service.dispatch(cancel('User pressed Escape'))

          const state = yield* service.getState
          expect(state.phase).toBe(DragPhaseEnum.Idle)
          expect(state.rowData).toBeNull()
          expect(state.ghostShapeId).toBeNull()
        })
      )
    })
  })
})
