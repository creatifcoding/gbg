/**
 * Faceplate Overlay
 *
 * Interactive overlay for equipment detail popovers.
 * Faceplates are modal-like panels that provide detailed control
 * and status information for a specific tag/equipment.
 *
 * Port convention: faceplate:{tagId}:open, faceplate:{tagId}:data
 *
 * @example
 * ```tsx
 * const { isOpen, open, close, toggle, tagId, position } = useFaceplate({
 *   containerId,
 *   tagId: "FIC-101" as TagId,
 * })
 *
 * return (
 *   <>
 *     <TagSymbol onClick={toggle} />
 *     {isOpen && (
 *       <FaceplatePanel
 *         tagId={tagId}
 *         position={position}
 *         onClose={close}
 *       />
 *     )}
 *   </>
 * )
 * ```
 */

import * as Effect from "effect/Effect"
import { Overlay, createOverlay } from "../Overlay"
import type { OverlayId, ContainerId } from "../schemas"
import { type TagId, type FaceplateState, faceplatePort } from "./types"

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

/** Faceplate overlay configuration */
export interface FaceplateOverlayConfig {
  /** Tag identifier */
  readonly tagId: TagId
  /** Optional display name */
  readonly name?: string
  /** Faceplate type (determines available controls) */
  readonly faceplateType?: FaceplateType
  /** Allow multiple faceplates open (default: false) */
  readonly allowMultiple?: boolean
}

/** Faceplate type determines available controls */
export type FaceplateType =
  | "analog" // PV, SP, mode, tuning
  | "discrete" // State, command buttons
  | "motor" // Start/stop, speed, status
  | "valve" // Open/close, position, status
  | "custom" // User-defined

// ─────────────────────────────────────────────────────────────
// Position Types
// ─────────────────────────────────────────────────────────────

/** Screen position for faceplate placement */
export interface Position {
  readonly x: number
  readonly y: number
}

/** Anchor point for positioning */
export type Anchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"

/** Extended faceplate state with position */
export interface FaceplateStateExtended extends FaceplateState {
  /** Position where faceplate should appear */
  readonly position?: Position
  /** Anchor point */
  readonly anchor?: Anchor
  /** Z-index for stacking */
  readonly zIndex?: number
  /** Open timestamp */
  readonly openedAt?: number
}

// ─────────────────────────────────────────────────────────────
// Position Utilities
// ─────────────────────────────────────────────────────────────

/** Calculate optimal position for faceplate to stay within viewport */
export const calculateFaceplatePosition = (
  clickPosition: Position,
  faceplateSize: { width: number; height: number },
  viewport: { width: number; height: number },
  padding: number = 16
): { position: Position; anchor: Anchor } => {
  const { x, y } = clickPosition
  const { width, height } = faceplateSize
  const { width: vw, height: vh } = viewport

  let anchor: Anchor = "top-left"
  let position: Position = { x, y }

  // Horizontal positioning
  if (x + width + padding > vw) {
    // Would overflow right, anchor to right side
    position = { ...position, x: x - width }
    anchor = "top-right"
  }

  // Vertical positioning
  if (y + height + padding > vh) {
    // Would overflow bottom, anchor above
    position = { ...position, y: y - height }
    anchor = anchor === "top-right" ? "bottom-right" : "bottom-left"
  }

  // Clamp to viewport
  position = {
    x: Math.max(padding, Math.min(position.x, vw - width - padding)),
    y: Math.max(padding, Math.min(position.y, vh - height - padding)),
  }

  return { position, anchor }
}

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────

/**
 * Create a Faceplate overlay for equipment detail panels.
 *
 * @param config - Faceplate configuration
 * @returns Overlay instance
 */
export const createFaceplateOverlay = (config: FaceplateOverlayConfig): Overlay => {
  const { tagId, name, faceplateType = "analog" } = config
  const overlayId = `faceplate:${tagId}` as OverlayId
  const openPort = faceplatePort.open(tagId)
  const statePort = faceplatePort.state(tagId)

  return createOverlay({
    id: overlayId,
    name: name ?? `Faceplate: ${tagId}`,
    visualPriority: 50, // High priority — faceplates overlay content

    // Faceplate is INTERACTIVE — responds to user events
    handlers: {
      // Could add escape key handler to close
    },

    ports: {
      subscriptions: [openPort, statePort],
      publications: [openPort],
    },

    onEnable: (containerId: ContainerId) =>
      Effect.gen(function* () {
        yield* Effect.log(`[Faceplate] Enabled for ${tagId} (${faceplateType}) in ${containerId}`)
      }),

    onDisable: (containerId: ContainerId) =>
      Effect.gen(function* () {
        yield* Effect.log(`[Faceplate] Disabled for ${tagId} in ${containerId}`)
      }),
  })
}

// ─────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────

import { useCallback, useMemo, useEffect } from "react"
import { useOverlay, usePort, usePublish } from "../hooks"
import type { UseOverlayResult } from "../hooks/useOverlay"

/** Result of useFaceplate hook */
export interface UseFaceplateResult {
  /** Tag ID this faceplate is for */
  readonly tagId: TagId
  /** Whether faceplate is open */
  readonly isOpen: boolean
  /** Position for rendering */
  readonly position: Position | undefined
  /** Anchor point */
  readonly anchor: Anchor | undefined
  /** Z-index for stacking */
  readonly zIndex: number
  /** When faceplate was opened */
  readonly openedAt: number | undefined
  /** Open the faceplate */
  readonly open: (position?: Position) => void
  /** Close the faceplate */
  readonly close: () => void
  /** Toggle open/closed */
  readonly toggle: (position?: Position) => void
  /** Update position */
  readonly setPosition: (position: Position, anchor?: Anchor) => void
  /** Bring to front (update z-index) */
  readonly bringToFront: () => void
  /** Overlay control */
  readonly overlay: UseOverlayResult
}

/** Options for useFaceplate hook */
export interface UseFaceplateOptions {
  /** Container ID */
  readonly containerId: ContainerId
  /** Tag ID */
  readonly tagId: TagId
  /** Optional display name */
  readonly name?: string
  /** Faceplate type */
  readonly faceplateType?: FaceplateType
  /** Base z-index (default: 1000) */
  readonly baseZIndex?: number
  /** Auto-enable on mount (default: true) */
  readonly autoEnable?: boolean
  /** Close on escape key (default: true) */
  readonly closeOnEscape?: boolean
  /** Callback when opened */
  readonly onOpen?: (tagId: TagId) => void
  /** Callback when closed */
  readonly onClose?: (tagId: TagId) => void
}

// Global z-index counter for faceplate stacking
let faceplateZIndexCounter = 1000

/**
 * Hook for faceplate (detail panel) management.
 *
 * @param options - Faceplate options
 * @returns Faceplate state and control functions
 */
export function useFaceplate(options: UseFaceplateOptions): UseFaceplateResult {
  const {
    containerId,
    tagId,
    name,
    faceplateType = "analog",
    baseZIndex = 1000,
    autoEnable = true,
    closeOnEscape = true,
    onOpen,
    onClose,
  } = options

  // Create overlay instance
  const overlayInstance = useMemo(
    () =>
      createFaceplateOverlay({
        tagId,
        name,
        faceplateType,
      }),
    [tagId, name, faceplateType]
  )

  // Register overlay
  const overlay = useOverlay({
    containerId,
    overlay: overlayInstance,
    autoRegister: true,
    autoEnable,
  })

  // Subscribe to faceplate state
  const faceplateState = usePort<FaceplateStateExtended>({
    containerId,
    portId: faceplatePort.open(tagId),
    initialValue: {
      tagId,
      open: false,
    },
  })

  // Publisher
  const publish = usePublish<FaceplateStateExtended>(containerId, faceplatePort.open(tagId))

  // Actions
  const open = useCallback(
    (position?: Position) => {
      faceplateZIndexCounter += 1
      const newState: FaceplateStateExtended = {
        tagId,
        open: true,
        position,
        zIndex: faceplateZIndexCounter,
        openedAt: Date.now(),
      }
      publish(newState)
      onOpen?.(tagId)
    },
    [tagId, publish, onOpen]
  )

  const close = useCallback(() => {
    const current = faceplateState.value
    publish({
      ...current,
      tagId,
      open: false,
      openedAt: undefined,
    })
    onClose?.(tagId)
  }, [tagId, faceplateState.value, publish, onClose])

  const toggle = useCallback(
    (position?: Position) => {
      const current = faceplateState.value
      if (current?.open) {
        close()
      } else {
        open(position)
      }
    },
    [faceplateState.value, open, close]
  )

  const setPosition = useCallback(
    (position: Position, anchor?: Anchor) => {
      const current = faceplateState.value
      if (!current) return

      publish({
        ...current,
        position,
        anchor,
      })
    },
    [faceplateState.value, publish]
  )

  const bringToFront = useCallback(() => {
    const current = faceplateState.value
    if (!current?.open) return

    faceplateZIndexCounter += 1
    publish({
      ...current,
      zIndex: faceplateZIndexCounter,
    })
  }, [faceplateState.value, publish])

  // Escape key handler
  useEffect(() => {
    if (!closeOnEscape) return
    if (!faceplateState.value?.open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [closeOnEscape, faceplateState.value?.open, close])

  // Extract values
  const state = faceplateState.value ?? {
    tagId,
    open: false,
  }

  return {
    tagId,
    isOpen: state.open,
    position: state.position,
    anchor: state.anchor,
    zIndex: state.zIndex ?? baseZIndex,
    openedAt: state.openedAt,
    open,
    close,
    toggle,
    setPosition,
    bringToFront,
    overlay,
  }
}

// ─────────────────────────────────────────────────────────────
// Multi-Faceplate Manager Hook
// ─────────────────────────────────────────────────────────────

/** Track multiple open faceplates */
export interface FaceplateManagerState {
  readonly openFaceplates: readonly TagId[]
  readonly focusedFaceplate: TagId | undefined
}

/** Result of useFaceplateManager hook */
export interface UseFaceplateManagerResult {
  /** List of open faceplate tag IDs */
  readonly openFaceplates: readonly TagId[]
  /** Currently focused faceplate */
  readonly focusedFaceplate: TagId | undefined
  /** Check if a faceplate is open */
  readonly isOpen: (tagId: TagId) => boolean
  /** Close all faceplates */
  readonly closeAll: () => void
  /** Focus a specific faceplate */
  readonly focus: (tagId: TagId) => void
}

/** Options for useFaceplateManager */
export interface UseFaceplateManagerOptions {
  /** Container ID */
  readonly containerId: ContainerId
  /** Maximum open faceplates (default: unlimited) */
  readonly maxOpen?: number
  /** Auto-close oldest when max reached (default: false) */
  readonly autoCloseOldest?: boolean
}

// Note: Full implementation would require tracking all faceplate ports
// This is a simplified interface for future extension

// ─────────────────────────────────────────────────────────────
// Factory Helpers (for testing)
// ─────────────────────────────────────────────────────────────

/**
 * Create faceplate state for testing.
 */
export const createFaceplateState = (
  tagId: TagId,
  open: boolean,
  position?: Position
): FaceplateStateExtended => ({
  tagId,
  open,
  position,
  zIndex: 1000,
  openedAt: open ? Date.now() : undefined,
})
