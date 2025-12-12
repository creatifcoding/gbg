/**
 * Types and Schema Codec Tests
 *
 * Tests for DragPhase, GridDragEvent factories, DragState, and config types.
 * @module data-grid/__tests__/types
 */

import { describe, test, expect } from 'bun:test'
import {
  DragPhase as DragPhaseEnum,
  INITIAL_DRAG_STATE,
  type DragState,
  type DragPhase,
  type GridDragEvent,
  type DataGridRow,
  type EmitterRow,
  type ActorRow,
  type GridRow,
  type GridThemeConfig,
  type GridBehaviorConfig,
} from '../types'
import {
  gridDragStart,
  gridDragMove,
  gridExit,
  canvasEnter,
  canvasMove,
  drop,
  cancel,
} from '../services'

// =============================================================================
// DragPhase Enum Tests
// =============================================================================

describe('DragPhase', () => {
  test('has all expected phases', () => {
    expect(DragPhaseEnum.Idle).toBe('idle')
    expect(DragPhaseEnum.GridInternal).toBe('grid-internal')
    expect(DragPhaseEnum.Transitioning).toBe('transitioning')
    expect(DragPhaseEnum.CanvasTracking).toBe('canvas-tracking')
  })

  test('phases are string literals', () => {
    expect(typeof DragPhaseEnum.Idle).toBe('string')
    expect(typeof DragPhaseEnum.GridInternal).toBe('string')
    expect(typeof DragPhaseEnum.Transitioning).toBe('string')
    expect(typeof DragPhaseEnum.CanvasTracking).toBe('string')
  })

  test('all phases are unique', () => {
    const phases = Object.values(DragPhaseEnum)
    const uniquePhases = new Set(phases)
    expect(uniquePhases.size).toBe(phases.length)
  })
})

// =============================================================================
// INITIAL_DRAG_STATE Tests
// =============================================================================

describe('INITIAL_DRAG_STATE', () => {
  test('phase is Idle', () => {
    expect(INITIAL_DRAG_STATE.phase).toBe(DragPhaseEnum.Idle)
  })

  test('rowData is null', () => {
    expect(INITIAL_DRAG_STATE.rowData).toBeNull()
  })

  test('ghostShapeId is null', () => {
    expect(INITIAL_DRAG_STATE.ghostShapeId).toBeNull()
  })

  test('startPos is null', () => {
    expect(INITIAL_DRAG_STATE.startPos).toBeNull()
  })

  test('currentPos is null', () => {
    expect(INITIAL_DRAG_STATE.currentPos).toBeNull()
  })

  test('gridId is null', () => {
    expect(INITIAL_DRAG_STATE.gridId).toBeNull()
  })

  test('is immutable reference', () => {
    const ref1 = INITIAL_DRAG_STATE
    const ref2 = INITIAL_DRAG_STATE
    expect(ref1).toBe(ref2)
  })
})

// =============================================================================
// GridDragEvent Factory Tests
// =============================================================================

describe('GridDragEvent factories', () => {
  const mockRow: DataGridRow = {
    id: 'test-1',
    name: 'Test Row',
    value: 42,
    status: 'active',
  }

  const mockPoint = { x: 100, y: 200 }

  describe('gridDragStart', () => {
    test('creates GridDragStart event with correct _tag', () => {
      const event = gridDragStart(mockRow, 'grid-001', mockPoint)
      expect(event._tag).toBe('GridDragStart')
    })

    test('includes rowData', () => {
      const event = gridDragStart(mockRow, 'grid-001', mockPoint)
      expect(event).toHaveProperty('rowData', mockRow)
    })

    test('includes gridId', () => {
      const event = gridDragStart(mockRow, 'grid-001', mockPoint)
      expect(event).toHaveProperty('gridId', 'grid-001')
    })

    test('includes startPos', () => {
      const event = gridDragStart(mockRow, 'grid-001', mockPoint)
      expect(event).toHaveProperty('startPos', mockPoint)
    })
  })

  describe('gridDragMove', () => {
    test('creates GridDragMove event with correct _tag', () => {
      const event = gridDragMove(mockPoint, true)
      expect(event._tag).toBe('GridDragMove')
    })

    test('includes currentPos', () => {
      const event = gridDragMove(mockPoint, true)
      expect(event).toHaveProperty('currentPos', mockPoint)
    })

    test('includes isInsideGrid boolean', () => {
      const inside = gridDragMove(mockPoint, true)
      const outside = gridDragMove(mockPoint, false)

      expect(inside).toHaveProperty('isInsideGrid', true)
      expect(outside).toHaveProperty('isInsideGrid', false)
    })
  })

  describe('gridExit', () => {
    test('creates GridExit event with correct _tag', () => {
      const event = gridExit(mockPoint, mockRow)
      expect(event._tag).toBe('GridExit')
    })

    test('includes exitPos', () => {
      const event = gridExit(mockPoint, mockRow)
      expect(event).toHaveProperty('exitPos', mockPoint)
    })

    test('includes rowData', () => {
      const event = gridExit(mockPoint, mockRow)
      expect(event).toHaveProperty('rowData', mockRow)
    })
  })

  describe('canvasEnter', () => {
    test('creates CanvasEnter event with correct _tag', () => {
      const event = canvasEnter(mockPoint, 'ghost-shape-001')
      expect(event._tag).toBe('CanvasEnter')
    })

    test('includes canvasPos', () => {
      const event = canvasEnter(mockPoint, 'ghost-shape-001')
      expect(event).toHaveProperty('canvasPos', mockPoint)
    })

    test('includes ghostShapeId', () => {
      const event = canvasEnter(mockPoint, 'ghost-shape-001')
      expect(event).toHaveProperty('ghostShapeId', 'ghost-shape-001')
    })
  })

  describe('canvasMove', () => {
    test('creates CanvasMove event with correct _tag', () => {
      const screenPos = { x: 150, y: 250 }
      const event = canvasMove(screenPos, mockPoint)
      expect(event._tag).toBe('CanvasMove')
    })

    test('includes both screenPos and canvasPos', () => {
      const screenPos = { x: 150, y: 250 }
      const event = canvasMove(screenPos, mockPoint)

      expect(event).toHaveProperty('screenPos', screenPos)
      expect(event).toHaveProperty('canvasPos', mockPoint)
    })
  })

  describe('drop', () => {
    test('creates Drop event with correct _tag', () => {
      const event = drop(mockPoint, mockRow)
      expect(event._tag).toBe('Drop')
    })

    test('includes canvasPos', () => {
      const event = drop(mockPoint, mockRow)
      expect(event).toHaveProperty('canvasPos', mockPoint)
    })

    test('includes rowData', () => {
      const event = drop(mockPoint, mockRow)
      expect(event).toHaveProperty('rowData', mockRow)
    })
  })

  describe('cancel', () => {
    test('creates Cancel event with correct _tag', () => {
      const event = cancel('User pressed Escape')
      expect(event._tag).toBe('Cancel')
    })

    test('includes reason string', () => {
      const event = cancel('User pressed Escape')
      expect(event).toHaveProperty('reason', 'User pressed Escape')
    })
  })
})

// =============================================================================
// DataGridRow Type Tests (Runtime shape validation)
// =============================================================================

describe('DataGridRow shape', () => {
  test('valid DataGridRow has required fields', () => {
    const row: DataGridRow = {
      id: 'row-1',
      name: 'Alpha',
      value: 100,
      status: 'active',
    }

    expect(row.id).toBe('row-1')
    expect(row.name).toBe('Alpha')
    expect(row.value).toBe(100)
    expect(row.status).toBe('active')
  })

  test('status must be one of active, pending, inactive', () => {
    const active: DataGridRow = { id: '1', name: 'A', value: 1, status: 'active' }
    const pending: DataGridRow = { id: '2', name: 'B', value: 2, status: 'pending' }
    const inactive: DataGridRow = { id: '3', name: 'C', value: 3, status: 'inactive' }

    expect(['active', 'pending', 'inactive']).toContain(active.status)
    expect(['active', 'pending', 'inactive']).toContain(pending.status)
    expect(['active', 'pending', 'inactive']).toContain(inactive.status)
  })
})

// =============================================================================
// EmitterRow Type Tests
// =============================================================================

describe('EmitterRow shape', () => {
  test('extends DataGridRow with type="emitter"', () => {
    const emitter: EmitterRow = {
      id: 'emitter-1',
      name: 'RF Source',
      value: 50,
      status: 'active',
      type: 'emitter',
      frequency: '2.4GHz',
      power: 100,
      intent: 'cooperative',
    }

    expect(emitter.type).toBe('emitter')
    expect(emitter.frequency).toBe('2.4GHz')
    expect(emitter.power).toBe(100)
    expect(emitter.intent).toBe('cooperative')
  })

  test('intent can be cooperative, hostile, ambient, or unknown', () => {
    const intents = ['cooperative', 'hostile', 'ambient', 'unknown'] as const

    for (const intent of intents) {
      const emitter: EmitterRow = {
        id: 'e1',
        name: 'E',
        value: 0,
        status: 'active',
        type: 'emitter',
        intent,
      }
      expect(emitter.intent).toBe(intent)
    }
  })
})

// =============================================================================
// ActorRow Type Tests
// =============================================================================

describe('ActorRow shape', () => {
  test('extends DataGridRow with type="actor"', () => {
    const actor: ActorRow = {
      id: 'actor-1',
      name: 'Agent Alpha',
      value: 75,
      status: 'pending',
      type: 'actor',
      affiliation: 'blue',
      capabilities: ['SIGINT', 'COMINT'],
    }

    expect(actor.type).toBe('actor')
    expect(actor.affiliation).toBe('blue')
    expect(actor.capabilities).toEqual(['SIGINT', 'COMINT'])
  })

  test('affiliation can be blue, red, neutral, or unknown', () => {
    const affiliations = ['blue', 'red', 'neutral', 'unknown'] as const

    for (const affiliation of affiliations) {
      const actor: ActorRow = {
        id: 'a1',
        name: 'A',
        value: 0,
        status: 'active',
        type: 'actor',
        affiliation,
      }
      expect(actor.affiliation).toBe(affiliation)
    }
  })
})

// =============================================================================
// GridBehaviorConfig Type Tests
// =============================================================================

describe('GridBehaviorConfig', () => {
  test('all behavior flags are boolean', () => {
    const config: GridBehaviorConfig = {
      enableDrag: true,
      enableExternalDrop: false,
      enableReorder: true,
      enableEdit: false,
      enableSort: true,
      enableResize: true,
    }

    expect(typeof config.enableDrag).toBe('boolean')
    expect(typeof config.enableExternalDrop).toBe('boolean')
    expect(typeof config.enableReorder).toBe('boolean')
    expect(typeof config.enableEdit).toBe('boolean')
    expect(typeof config.enableSort).toBe('boolean')
    expect(typeof config.enableResize).toBe('boolean')
  })
})

// =============================================================================
// GridThemeConfig Type Tests
// =============================================================================

describe('GridThemeConfig shape', () => {
  test('has colors, typography, and spacing sections', () => {
    const theme: GridThemeConfig = {
      colors: {
        background: '#000',
        border: '#111',
        text: '#fff',
        textMuted: '#888',
        accent: '#0af',
        statusActive: '#0f0',
        statusPending: '#ff0',
        statusInactive: '#888',
      },
      typography: {
        fontFamily: 'monospace',
        fontSize: 14,
        fontSizeXs: 12,
        fontSizeSm: 12,
        fontSizeLg: 16,
      },
      spacing: {
        rowHeight: 32,
        headerHeight: 28,
        cellPadding: 8,
      },
    }

    expect(theme.colors).toBeDefined()
    expect(theme.typography).toBeDefined()
    expect(theme.spacing).toBeDefined()
  })
})
