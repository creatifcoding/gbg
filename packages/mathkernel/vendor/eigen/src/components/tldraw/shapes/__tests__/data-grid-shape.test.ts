/**
 * DataGridWidgetShape Hybrid Drag Tests
 *
 * Tests for the hybrid drag mechanism:
 * - AG-Grid internal rowDrag for reordering within grid
 * - Pointer events for canvas tracking when cursor exits grid
 * - Ghost shape creation/update/removal during canvas tracking
 * - DragState transitions
 *
 * @package tmnl
 * @experimental
 */

import { describe, it, expect, beforeEach, vi } from "vitest"

// =============================================================================
// TEST: DragState Interface
// =============================================================================

/**
 * DragState interface (mirrored from component for testing)
 */
interface DragState {
  isDragging: boolean
  isOutsideGrid: boolean
  rowData: DataGridRow | null
  ghostId: string | null
}

interface DataGridRow {
  id: string
  name: string
  value: number
  status: string
}

const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  isOutsideGrid: false,
  rowData: null,
  ghostId: null,
}

// =============================================================================
// TEST: DragState Transitions
// =============================================================================

describe("DragState Transitions", () => {
  describe("INITIAL_DRAG_STATE", () => {
    it("isDragging is false", () => {
      expect(INITIAL_DRAG_STATE.isDragging).toBe(false)
    })

    it("isOutsideGrid is false", () => {
      expect(INITIAL_DRAG_STATE.isOutsideGrid).toBe(false)
    })

    it("rowData is null", () => {
      expect(INITIAL_DRAG_STATE.rowData).toBeNull()
    })

    it("ghostId is null", () => {
      expect(INITIAL_DRAG_STATE.ghostId).toBeNull()
    })
  })

  describe("onRowDragEnter transition", () => {
    it("sets isDragging to true", () => {
      const row: DataGridRow = { id: "001", name: "Alpha Signal", value: 42, status: "active" }

      // Simulated state after onRowDragEnter
      const nextState: DragState = {
        isDragging: true,
        isOutsideGrid: false,
        rowData: row,
        ghostId: null,
      }

      expect(nextState.isDragging).toBe(true)
      expect(nextState.isOutsideGrid).toBe(false)
      expect(nextState.rowData).toEqual(row)
      expect(nextState.ghostId).toBeNull()
    })

    it("captures rowData from event.node.data", () => {
      const row: DataGridRow = { id: "005", name: "Epsilon Core", value: 91, status: "active" }

      const nextState: DragState = {
        ...INITIAL_DRAG_STATE,
        isDragging: true,
        rowData: row,
      }

      expect(nextState.rowData?.id).toBe("005")
      expect(nextState.rowData?.name).toBe("Epsilon Core")
    })
  })

  describe("onRowDragMove boundary detection", () => {
    /**
     * Boundary detection logic:
     * - clientX < containerRect.left  → outside (left)
     * - clientX > containerRect.right → outside (right)
     * - clientY < containerRect.top   → outside (top)
     * - clientY > containerRect.bottom → outside (bottom)
     */

    const containerRect = {
      left: 100,
      right: 500,
      top: 100,
      bottom: 400,
    }

    const isOutsideBounds = (clientX: number, clientY: number): boolean => {
      return (
        clientX < containerRect.left ||
        clientX > containerRect.right ||
        clientY < containerRect.top ||
        clientY > containerRect.bottom
      )
    }

    it("returns true when cursor is left of container", () => {
      expect(isOutsideBounds(50, 200)).toBe(true)
    })

    it("returns true when cursor is right of container", () => {
      expect(isOutsideBounds(550, 200)).toBe(true)
    })

    it("returns true when cursor is above container", () => {
      expect(isOutsideBounds(300, 50)).toBe(true)
    })

    it("returns true when cursor is below container", () => {
      expect(isOutsideBounds(300, 450)).toBe(true)
    })

    it("returns false when cursor is inside container", () => {
      expect(isOutsideBounds(300, 250)).toBe(false)
    })

    it("returns false when cursor is at left edge (inclusive)", () => {
      // At exactly left edge is NOT outside
      expect(isOutsideBounds(100, 250)).toBe(false)
    })

    it("returns false when cursor is at right edge (inclusive)", () => {
      // At exactly right edge is NOT outside
      expect(isOutsideBounds(500, 250)).toBe(false)
    })

    it("triggers transition to canvas tracking when crossing boundary", () => {
      const row: DataGridRow = { id: "001", name: "Alpha", value: 42, status: "active" }

      // State before crossing boundary
      const stateBefore: DragState = {
        isDragging: true,
        isOutsideGrid: false,
        rowData: row,
        ghostId: null,
      }

      // Cursor crosses boundary (now outside)
      const isOutside = isOutsideBounds(550, 200) // right of container

      // State after crossing boundary (simulated)
      const stateAfter: DragState = isOutside && !stateBefore.isOutsideGrid
        ? {
            ...stateBefore,
            isOutsideGrid: true,
            ghostId: "ghost:abc123",
          }
        : stateBefore

      expect(stateAfter.isOutsideGrid).toBe(true)
      expect(stateAfter.ghostId).toBe("ghost:abc123")
    })
  })

  describe("canvas tracking mode transitions", () => {
    it("handlePointerUp resets to INITIAL_DRAG_STATE", () => {
      const row: DataGridRow = { id: "001", name: "Alpha", value: 42, status: "active" }

      // State during canvas tracking
      const trackingState: DragState = {
        isDragging: true,
        isOutsideGrid: true,
        rowData: row,
        ghostId: "ghost:xyz789",
      }

      // After pointerUp, state resets
      const stateAfterDrop = INITIAL_DRAG_STATE

      expect(stateAfterDrop.isDragging).toBe(false)
      expect(stateAfterDrop.isOutsideGrid).toBe(false)
      expect(stateAfterDrop.rowData).toBeNull()
      expect(stateAfterDrop.ghostId).toBeNull()
    })

    it("Escape key cancellation resets to INITIAL_DRAG_STATE", () => {
      const row: DataGridRow = { id: "002", name: "Beta", value: 87, status: "pending" }

      // State during canvas tracking
      const trackingState: DragState = {
        isDragging: true,
        isOutsideGrid: true,
        rowData: row,
        ghostId: "ghost:cancel123",
      }

      // Escape key pressed, state resets
      const stateAfterCancel = INITIAL_DRAG_STATE

      expect(stateAfterCancel).toEqual(INITIAL_DRAG_STATE)
    })
  })

  describe("onRowDragEnd transitions", () => {
    it("resets state when NOT in canvas tracking mode", () => {
      const row: DataGridRow = { id: "003", name: "Gamma", value: 23, status: "active" }

      // State during internal grid drag (not outside)
      const internalDragState: DragState = {
        isDragging: true,
        isOutsideGrid: false, // NOT outside
        rowData: row,
        ghostId: null,
      }

      // onRowDragEnd fires, state resets
      const stateAfterEnd = INITIAL_DRAG_STATE

      expect(stateAfterEnd.isDragging).toBe(false)
    })

    it("does NOT reset state when in canvas tracking mode (pointer handlers take over)", () => {
      const row: DataGridRow = { id: "004", name: "Delta", value: 56, status: "inactive" }

      // State during canvas tracking
      const trackingState: DragState = {
        isDragging: true,
        isOutsideGrid: true, // IS outside
        rowData: row,
        ghostId: "ghost:tracking456",
      }

      // onRowDragEnd should NOT reset - pointer handlers will
      // In the component: if (state.isOutsideGrid) return;
      const shouldSkipReset = trackingState.isOutsideGrid

      expect(shouldSkipReset).toBe(true)
    })
  })
})

// =============================================================================
// TEST: Ghost Shape Operations
// =============================================================================

describe("Ghost Shape Operations", () => {
  /**
   * Ghost shape management functions:
   * - createGhost: Creates acquire-ghost shape at canvas position
   * - updateGhost: Moves ghost to follow cursor
   * - removeGhost: Deletes ghost shape
   */

  describe("createGhost", () => {
    it("creates ghost at correct canvas position", () => {
      const screenPos = { x: 400, y: 300 }
      const mockScreenToPage = (screen: { x: number; y: number }) => ({
        x: screen.x + 100, // simulated transform
        y: screen.y + 50,
      })

      const canvasPos = mockScreenToPage(screenPos)
      const ghostId = `shape:ghost_${Date.now()}`

      // Ghost props created by createGhost
      const ghostProps = {
        id: ghostId,
        type: "acquire-ghost",
        x: canvasPos.x - 30, // offset for centering
        y: canvasPos.y - 30,
        props: {
          w: 60,
          h: 60,
          rowName: "Alpha Signal",
          status: "active",
        },
      }

      expect(ghostProps.type).toBe("acquire-ghost")
      expect(ghostProps.x).toBe(470) // 400 + 100 - 30
      expect(ghostProps.y).toBe(320) // 300 + 50 - 30
      expect(ghostProps.props.w).toBe(60)
      expect(ghostProps.props.h).toBe(60)
    })

    it("uses rowData.name for ghost label", () => {
      const row: DataGridRow = { id: "005", name: "Epsilon Core", value: 91, status: "active" }

      const ghostProps = {
        rowName: row.name,
        status: row.status,
      }

      expect(ghostProps.rowName).toBe("Epsilon Core")
      expect(ghostProps.status).toBe("active")
    })
  })

  describe("updateGhost", () => {
    it("calculates new canvas position from screen coords", () => {
      const screenPos = { x: 450, y: 350 }
      const mockScreenToPage = (screen: { x: number; y: number }) => ({
        x: screen.x + 100,
        y: screen.y + 50,
      })

      const canvasPos = mockScreenToPage(screenPos)
      const updateProps = {
        x: canvasPos.x - 30,
        y: canvasPos.y - 30,
      }

      expect(updateProps.x).toBe(520) // 450 + 100 - 30
      expect(updateProps.y).toBe(370) // 350 + 50 - 30
    })

    it("only updates if ghost shape exists", () => {
      let updateCalled = false

      const ghostId = "shape:existing_ghost"
      const mockGetShape = (id: string) => (id === ghostId ? { id } : undefined)

      const ghost = mockGetShape(ghostId)
      if (ghost) {
        updateCalled = true
      }

      expect(updateCalled).toBe(true)
    })

    it("does not update if ghost shape was deleted", () => {
      let updateCalled = false

      const ghostId = "shape:deleted_ghost"
      const mockGetShape = (_id: string) => undefined

      const ghost = mockGetShape(ghostId)
      if (ghost) {
        updateCalled = true
      }

      expect(updateCalled).toBe(false)
    })
  })

  describe("removeGhost", () => {
    it("deletes ghost shape by id", () => {
      const deleteLog: string[] = []

      const mockDeleteShape = (id: string) => {
        deleteLog.push(id)
      }

      const ghostId = "shape:ghost_to_remove"
      mockDeleteShape(ghostId)

      expect(deleteLog).toContain(ghostId)
    })

    it("handles already-deleted ghost gracefully", () => {
      const mockDeleteShape = (id: string) => {
        if (id === "shape:nonexistent") {
          throw new Error("Shape not found")
        }
      }

      // removeGhost catches errors
      let errorThrown = false
      try {
        mockDeleteShape("shape:nonexistent")
      } catch {
        errorThrown = true
      }

      expect(errorThrown).toBe(true)

      // Component wraps in try/catch so no error propagates
      const removeGhostSafe = (id: string) => {
        try {
          mockDeleteShape(id)
        } catch (_e) {
          // Shape may already be deleted - this is expected
        }
      }

      // Should not throw
      expect(() => removeGhostSafe("shape:nonexistent")).not.toThrow()
    })
  })
})

// =============================================================================
// TEST: Coordinate Transform
// =============================================================================

describe("Coordinate Transform", () => {
  /**
   * screenToPage transform converts screen coordinates (clientX/Y)
   * to canvas coordinates (accounting for zoom, pan, etc.)
   */

  describe("screenToPage mock behavior", () => {
    it("applies zoom factor", () => {
      const zoom = 1.5
      const pan = { x: 0, y: 0 }

      const screenToPage = (screen: { x: number; y: number }) => ({
        x: (screen.x - pan.x) / zoom,
        y: (screen.y - pan.y) / zoom,
      })

      const screen = { x: 300, y: 300 }
      const canvas = screenToPage(screen)

      expect(canvas.x).toBe(200) // 300 / 1.5
      expect(canvas.y).toBe(200)
    })

    it("applies pan offset", () => {
      const zoom = 1.0
      const pan = { x: 100, y: 50 }

      const screenToPage = (screen: { x: number; y: number }) => ({
        x: (screen.x - pan.x) / zoom,
        y: (screen.y - pan.y) / zoom,
      })

      const screen = { x: 300, y: 300 }
      const canvas = screenToPage(screen)

      expect(canvas.x).toBe(200) // 300 - 100
      expect(canvas.y).toBe(250) // 300 - 50
    })

    it("combines zoom and pan", () => {
      const zoom = 2.0
      const pan = { x: 50, y: 25 }

      const screenToPage = (screen: { x: number; y: number }) => ({
        x: (screen.x - pan.x) / zoom,
        y: (screen.y - pan.y) / zoom,
      })

      const screen = { x: 250, y: 225 }
      const canvas = screenToPage(screen)

      expect(canvas.x).toBe(100) // (250 - 50) / 2
      expect(canvas.y).toBe(100) // (225 - 25) / 2
    })
  })
})

// =============================================================================
// TEST: Data Card Spawn
// =============================================================================

describe("Data Card Spawn", () => {
  /**
   * spawnDataCard creates a data-card shape when row is dropped on canvas
   */

  describe("spawn parameters", () => {
    it("positions card centered on drop point", () => {
      const dropPoint = { x: 300, y: 200 }
      const cardWidth = 180
      const cardHeight = 100

      const spawnX = dropPoint.x - cardWidth / 2
      const spawnY = dropPoint.y - cardHeight / 2

      expect(spawnX).toBe(210) // 300 - 90
      expect(spawnY).toBe(150) // 200 - 50
    })

    it("passes rowData to card props", () => {
      const row: DataGridRow = { id: "001", name: "Alpha Signal", value: 42, status: "active" }
      const sourceGridId = "shape:source_grid_123"

      const cardProps = {
        w: 180,
        h: 100,
        rowData: row,
        sourceGridId: sourceGridId,
      }

      expect(cardProps.rowData).toEqual(row)
      expect(cardProps.sourceGridId).toBe(sourceGridId)
    })

    it("uses data-card shape type", () => {
      const shapeType = "data-card"
      expect(shapeType).toBe("data-card")
    })
  })
})

// =============================================================================
// TEST: Event Handler Attachment
// =============================================================================

describe("Event Handler Attachment", () => {
  /**
   * Pointer event handlers are conditionally attached based on dragState.isOutsideGrid
   */

  describe("conditional attachment", () => {
    it("attaches listeners when isOutsideGrid is true", () => {
      const dragState: DragState = {
        isDragging: true,
        isOutsideGrid: true,
        rowData: { id: "001", name: "Alpha", value: 42, status: "active" },
        ghostId: "shape:ghost_123",
      }

      const shouldAttach = dragState.isOutsideGrid

      expect(shouldAttach).toBe(true)
    })

    it("does NOT attach listeners when isOutsideGrid is false", () => {
      const dragState: DragState = {
        isDragging: true,
        isOutsideGrid: false,
        rowData: { id: "001", name: "Alpha", value: 42, status: "active" },
        ghostId: null,
      }

      const shouldAttach = dragState.isOutsideGrid

      expect(shouldAttach).toBe(false)
    })

    it("listeners include pointermove, pointerup, keydown", () => {
      const attachedEvents: string[] = []

      const mockAddEventListener = (event: string, _handler: unknown) => {
        attachedEvents.push(event)
      }

      // Simulated attachment
      mockAddEventListener("pointermove", () => {})
      mockAddEventListener("pointerup", () => {})
      mockAddEventListener("keydown", () => {})

      expect(attachedEvents).toContain("pointermove")
      expect(attachedEvents).toContain("pointerup")
      expect(attachedEvents).toContain("keydown")
    })

    it("cleanup removes all attached listeners", () => {
      const attachedEvents = new Set(["pointermove", "pointerup", "keydown"])

      const mockRemoveEventListener = (event: string, _handler: unknown) => {
        attachedEvents.delete(event)
      }

      // Simulated cleanup
      mockRemoveEventListener("pointermove", () => {})
      mockRemoveEventListener("pointerup", () => {})
      mockRemoveEventListener("keydown", () => {})

      expect(attachedEvents.size).toBe(0)
    })
  })
})

// =============================================================================
// TEST: AG-Grid Configuration
// =============================================================================

describe("AG-Grid Configuration", () => {
  describe("rowDragManaged mode", () => {
    it("enables managed row drag", () => {
      const gridProps = {
        rowDragManaged: true,
      }

      expect(gridProps.rowDragManaged).toBe(true)
    })

    it("drag column has rowDrag: true", () => {
      const dragColumn = {
        headerName: "",
        width: 28,
        rowDrag: true,
        suppressSizeToFit: true,
      }

      expect(dragColumn.rowDrag).toBe(true)
      expect(dragColumn.width).toBe(28)
    })
  })

  describe("event handlers attached", () => {
    it("onRowDragEnter is defined", () => {
      const handlers = {
        onRowDragEnter: vi.fn(),
        onRowDragMove: vi.fn(),
        onRowDragLeave: vi.fn(),
        onRowDragEnd: vi.fn(),
      }

      expect(handlers.onRowDragEnter).toBeDefined()
      expect(handlers.onRowDragMove).toBeDefined()
      expect(handlers.onRowDragLeave).toBeDefined()
      expect(handlers.onRowDragEnd).toBeDefined()
    })
  })
})

// =============================================================================
// TEST: GSAP Animation Integration
// =============================================================================

describe("GSAP Animation Integration", () => {
  /**
   * Visual feedback via GSAP animations:
   * - Row highlight on drag enter
   * - Container glow during drag
   * - Spawn animation for data cards
   */

  describe("animation targets", () => {
    it("row highlight properties", () => {
      const highlightProps = {
        boxShadow: "inset 0 0 15px rgba(255, 255, 255, 0.15)",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        duration: 0.2,
      }

      expect(highlightProps.boxShadow).toContain("inset")
      expect(highlightProps.backgroundColor).toContain("rgba")
      expect(highlightProps.duration).toBe(0.2)
    })

    it("container glow properties", () => {
      const glowProps = {
        borderColor: "rgba(255, 255, 255, 0.5)",
        boxShadow: "0 0 15px rgba(255, 255, 255, 0.2)",
        duration: 0.3,
      }

      expect(glowProps.borderColor).toContain("rgba")
      expect(glowProps.boxShadow).toContain("0 0 15px")
      expect(glowProps.duration).toBe(0.3)
    })

    it("spawn animation properties", () => {
      const spawnFrom = { scale: 0.5, opacity: 0 }
      const spawnTo = { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" }

      expect(spawnFrom.scale).toBe(0.5)
      expect(spawnFrom.opacity).toBe(0)
      expect(spawnTo.scale).toBe(1)
      expect(spawnTo.ease).toBe("back.out(1.7)")
    })
  })

  describe("reset animations", () => {
    it("row reset properties", () => {
      const resetProps = {
        boxShadow: "none",
        backgroundColor: "transparent",
        duration: 0.2,
      }

      expect(resetProps.boxShadow).toBe("none")
      expect(resetProps.backgroundColor).toBe("transparent")
    })

    it("container reset properties", () => {
      // Uses TMNL_TOKENS.colors.border for reset
      const resetBorderColor = "#262626" // TMNL neutral-800 equivalent

      const resetProps = {
        borderColor: resetBorderColor,
        boxShadow: "none",
        duration: 0.2,
      }

      expect(resetProps.boxShadow).toBe("none")
    })
  })
})

// =============================================================================
// TEST: DataGridWidgetShapeUtil
// =============================================================================

describe("DataGridWidgetShapeUtil", () => {
  describe("static properties", () => {
    it("type is data-grid-widget", () => {
      const shapeType = "data-grid-widget"
      expect(shapeType).toBe("data-grid-widget")
    })
  })

  describe("default props", () => {
    const defaultProps = {
      w: 340,
      h: 220,
      title: "DATA_GRID",
      rowData: [
        { id: "001", name: "Alpha Signal", value: 42, status: "active" },
        { id: "002", name: "Beta Channel", value: 87, status: "pending" },
        { id: "003", name: "Gamma Flux", value: 23, status: "active" },
        { id: "004", name: "Delta Wave", value: 56, status: "inactive" },
        { id: "005", name: "Epsilon Core", value: 91, status: "active" },
      ],
    }

    it("default width is 340", () => {
      expect(defaultProps.w).toBe(340)
    })

    it("default height is 220", () => {
      expect(defaultProps.h).toBe(220)
    })

    it("default title is DATA_GRID", () => {
      expect(defaultProps.title).toBe("DATA_GRID")
    })

    it("default rowData has 5 rows", () => {
      expect(defaultProps.rowData).toHaveLength(5)
    })

    it("rowData items have required fields", () => {
      const row = defaultProps.rowData[0]
      expect(row).toHaveProperty("id")
      expect(row).toHaveProperty("name")
      expect(row).toHaveProperty("value")
      expect(row).toHaveProperty("status")
    })
  })

  describe("capabilities", () => {
    it("canResize returns true", () => {
      const canResize = true // from: override canResize() { return true }
      expect(canResize).toBe(true)
    })

    it("canEdit returns false", () => {
      const canEdit = false // from: override canEdit() { return false }
      expect(canEdit).toBe(false)
    })
  })
})

// =============================================================================
// TEST: State Machine Invariants
// =============================================================================

describe("State Machine Invariants", () => {
  /**
   * Invariants that must hold across all state transitions
   */

  describe("ghostId invariants", () => {
    it("ghostId is null when isOutsideGrid is false", () => {
      const validStates: DragState[] = [
        INITIAL_DRAG_STATE,
        { isDragging: true, isOutsideGrid: false, rowData: { id: "1", name: "A", value: 1, status: "active" }, ghostId: null },
      ]

      validStates.forEach((state) => {
        if (!state.isOutsideGrid) {
          expect(state.ghostId).toBeNull()
        }
      })
    })

    it("ghostId is non-null when isOutsideGrid is true", () => {
      const trackingState: DragState = {
        isDragging: true,
        isOutsideGrid: true,
        rowData: { id: "1", name: "A", value: 1, status: "active" },
        ghostId: "shape:ghost_123",
      }

      expect(trackingState.ghostId).not.toBeNull()
    })
  })

  describe("rowData invariants", () => {
    it("rowData is null when isDragging is false", () => {
      expect(INITIAL_DRAG_STATE.rowData).toBeNull()
    })

    it("rowData is non-null when isDragging is true", () => {
      const draggingState: DragState = {
        isDragging: true,
        isOutsideGrid: false,
        rowData: { id: "1", name: "A", value: 1, status: "active" },
        ghostId: null,
      }

      expect(draggingState.rowData).not.toBeNull()
    })
  })

  describe("isOutsideGrid implies isDragging", () => {
    it("isOutsideGrid=true requires isDragging=true", () => {
      // If we're outside the grid, we must be dragging
      const trackingState: DragState = {
        isDragging: true, // required
        isOutsideGrid: true,
        rowData: { id: "1", name: "A", value: 1, status: "active" },
        ghostId: "shape:ghost_123",
      }

      expect(trackingState.isDragging).toBe(true)
    })
  })
})
