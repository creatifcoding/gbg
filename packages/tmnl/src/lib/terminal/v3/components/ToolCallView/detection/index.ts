/**
 * Tool Call Detection
 *
 * Detection logic for specialized tool result handling.
 *
 * @module terminal/v3/components/ToolCallView/detection
 */

export {
  // Main detection
  detectMapData,
  type DetectionContext,
  // Tool registry
  MAP_PRODUCING_TOOLS,
  isMapProducingTool,
  registerMapProducingTool,
} from './map-detector'
