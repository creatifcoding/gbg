/**
 * @module layout/hooks
 * @description Hook barrel export for layout system
 */

// Container size hooks
export {
  useContainerHeight,
  useContainerMeasure,
  useContainerSize,
  useContainerWidth,
  type ContainerSize,
  type UseContainerSizeOptions,
} from "./useContainerSize"

// Breakpoint hooks
export {
  createBreakpointHook,
  useBreakpoint,
  useBreakpointTemplate,
  useDesktopFirst,
  useMobileFirst,
  type UseBreakpointOptions,
} from "./useBreakpoint"
