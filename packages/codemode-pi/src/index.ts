/**
 * @tmnl/codemode-pi — Pi host adapter for @tmnl/codemode
 *
 * TUI primitives, rendering, layout, steer formatting, tool guide.
 * Everything that touches @mariozechner/pi-* lives here.
 */

// Rendering
export { renderCall, renderResult, gridLines, steer, renderAnnotations } from './render.js'
export { decideLayout, type LayoutMode, type LayoutDecision } from './layout.js'

// Primitives
export { isPrimitive, extractLlmContent, type Primitive } from './primitives/types.js'
export { tryRenderPrimitive } from './primitives/index.js'

// Tool guide
export { createToolGuide } from './tool-guide.js'

// Grid
export { gridLines as gridLinesFn } from './grid.js'

// Steer (pi-specific formatting)
export { steer as steerFn, type Annotation } from './steer.js'
