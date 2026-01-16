/**
 * @module layout/services/LayoutService
 * @description Orchestrator service for layout system
 */

import { Context, Effect, Layer } from "effect"
import { Registry } from "@effect-atom/atom"
import {
  createLayoutAtoms,
  disposeLayoutAtoms,
  startDrag,
  updateDrag,
  endDrag,
  setRatios,
  resetRatios,
  getRatios,
  type LayoutAtoms,
} from "../atoms"
import { evaluateBreakpoints, type BreakpointResult } from "./BreakpointService"
import type { LayoutBreakpoints } from "../schemas"

// =============================================================================
// Types
// =============================================================================

/**
 * Layout instance initialization options
 */
export interface LayoutInitOptions {
  /** Unique instance ID */
  instanceId: string
  /** Number of cells */
  cellCount: number
  /** Optional initial ratios */
  initialRatios?: number[]
}

/**
 * Resize operation options
 */
export interface ResizeOptions {
  /** Instance ID */
  instanceId: string
  /** Registry for state mutations */
  registry: Registry.Registry
  /** Container size in pixels */
  containerSize: number
  /** Resize direction */
  direction: "horizontal" | "vertical"
  /** Minimum ratio */
  minRatio?: number
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * LayoutService interface - orchestrates layout operations
 */
export class LayoutService extends Context.Tag("LayoutService")<
  LayoutService,
  {
    /**
     * Initialize atoms for a layout instance
     */
    readonly initialize: (
      options: LayoutInitOptions
    ) => Effect.Effect<LayoutAtoms>

    /**
     * Dispose atoms for a layout instance
     */
    readonly dispose: (instanceId: string) => Effect.Effect<boolean>

    /**
     * Start a resize operation
     */
    readonly startResize: (
      registry: Registry.Registry,
      instanceId: string,
      handleIndex: number,
      startPosition: { x: number; y: number }
    ) => Effect.Effect<boolean>

    /**
     * Update during resize operation
     */
    readonly updateResize: (
      registry: Registry.Registry,
      instanceId: string,
      currentPosition: { x: number; y: number },
      containerSize: number,
      direction: "horizontal" | "vertical",
      minRatio?: number
    ) => Effect.Effect<boolean>

    /**
     * End a resize operation
     */
    readonly endResize: (
      registry: Registry.Registry,
      instanceId: string
    ) => Effect.Effect<readonly number[] | undefined>

    /**
     * Evaluate breakpoints
     */
    readonly evaluateBreakpoints: (
      containerWidth: number,
      breakpoints: LayoutBreakpoints,
      defaultTemplate: string,
      defaultGap?: number
    ) => Effect.Effect<BreakpointResult>

    /**
     * Get current ratios for an instance
     */
    readonly getRatios: (
      registry: Registry.Registry,
      instanceId: string
    ) => Effect.Effect<readonly number[] | undefined>

    /**
     * Set ratios for an instance
     */
    readonly setRatios: (
      registry: Registry.Registry,
      instanceId: string,
      ratios: number[]
    ) => Effect.Effect<boolean>

    /**
     * Reset ratios to equal distribution
     */
    readonly resetRatios: (
      registry: Registry.Registry,
      instanceId: string
    ) => Effect.Effect<boolean>
  }
>() {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Live implementation of LayoutService
 */
export const LayoutServiceLive = Layer.succeed(LayoutService, {
  initialize: (options) =>
    Effect.sync(() =>
      createLayoutAtoms(
        options.instanceId,
        options.cellCount,
        options.initialRatios
      )
    ),

  dispose: (instanceId) => Effect.sync(() => disposeLayoutAtoms(instanceId)),

  startResize: (registry, instanceId, handleIndex, startPosition) =>
    Effect.sync(() => startDrag(registry, instanceId, handleIndex, startPosition)),

  updateResize: (registry, instanceId, currentPosition, containerSize, direction, minRatio) =>
    Effect.sync(() =>
      updateDrag(registry, instanceId, currentPosition, containerSize, direction, minRatio)
    ),

  endResize: (registry, instanceId) =>
    Effect.sync(() => endDrag(registry, instanceId)),

  evaluateBreakpoints: (containerWidth, breakpoints, defaultTemplate, defaultGap) =>
    Effect.sync(() =>
      evaluateBreakpoints(containerWidth, breakpoints, defaultTemplate, defaultGap)
    ),

  getRatios: (registry, instanceId) =>
    Effect.sync(() => getRatios(registry, instanceId)),

  setRatios: (registry, instanceId, ratios) =>
    Effect.sync(() => setRatios(registry, instanceId, ratios)),

  resetRatios: (registry, instanceId) =>
    Effect.sync(() => resetRatios(registry, instanceId)),
})

// =============================================================================
// Standalone Functions (for non-Effect usage)
// =============================================================================

/**
 * Create a layout controller bound to a specific registry
 * Provides imperative API for React components
 */
export function createLayoutController(registry: Registry.Registry) {
  return {
    /**
     * Initialize a layout instance
     */
    initialize(
      instanceId: string,
      cellCount: number,
      initialRatios?: number[]
    ): LayoutAtoms {
      return createLayoutAtoms(instanceId, cellCount, initialRatios)
    },

    /**
     * Dispose a layout instance
     */
    dispose(instanceId: string): boolean {
      return disposeLayoutAtoms(instanceId)
    },

    /**
     * Start resize
     */
    startResize(
      instanceId: string,
      handleIndex: number,
      startPosition: { x: number; y: number }
    ): boolean {
      return startDrag(registry, instanceId, handleIndex, startPosition)
    },

    /**
     * Update resize
     */
    updateResize(
      instanceId: string,
      currentPosition: { x: number; y: number },
      containerSize: number,
      direction: "horizontal" | "vertical",
      minRatio?: number
    ): boolean {
      return updateDrag(
        registry,
        instanceId,
        currentPosition,
        containerSize,
        direction,
        minRatio
      )
    },

    /**
     * End resize
     */
    endResize(instanceId: string): number[] | undefined {
      return endDrag(registry, instanceId)
    },

    /**
     * Get current ratios
     */
    getRatios(instanceId: string): readonly number[] | undefined {
      return getRatios(registry, instanceId)
    },

    /**
     * Set ratios
     */
    setRatios(instanceId: string, ratios: number[]): boolean {
      return setRatios(registry, instanceId, ratios)
    },

    /**
     * Reset ratios
     */
    resetRatios(instanceId: string): boolean {
      return resetRatios(registry, instanceId)
    },

    /**
     * Evaluate breakpoints
     */
    evaluateBreakpoints(
      containerWidth: number,
      breakpoints: LayoutBreakpoints,
      defaultTemplate: string,
      defaultGap?: number
    ): BreakpointResult {
      return evaluateBreakpoints(
        containerWidth,
        breakpoints,
        defaultTemplate,
        defaultGap
      )
    },
  }
}

/**
 * Type for the layout controller
 */
export type LayoutController = ReturnType<typeof createLayoutController>
