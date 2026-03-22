/**
 * @module layout/services
 * @description Service barrel export for layout system
 */

// BreakpointService
export {
  BreakpointService,
  BreakpointServiceLive,
  createDesktopFirstEvaluator,
  createMobileFirstEvaluator,
  evaluateBreakpoints,
  type BreakpointResult,
} from "./BreakpointService"

// ResizeService
export {
  calculateResizeSync,
  distributeSpace,
  getHandlePositions,
  pixelToRatioDelta,
  ratioToPixel,
  ResizeService,
  ResizeServiceLive,
  snapToGrid,
  type ResizeInput,
} from "./ResizeService"

// LayoutService
export {
  createLayoutController,
  LayoutService,
  LayoutServiceLive,
  type LayoutController,
  type LayoutInitOptions,
  type ResizeOptions,
} from "./LayoutService"
