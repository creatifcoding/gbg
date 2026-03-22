/**
 * Debug Scope System
 *
 * Component-level instrumentation context with conditional activation.
 * When debug is enabled, logs lifecycle events and renders rich metadata.
 *
 * Pattern: "Component Instrumentation Scope" (DebugScope)
 *
 * Related patterns:
 * - React useDebugValue (DevTools hook integration)
 * - Jotai useAtomsDebugValue (render-nothing debug component)
 * - Effect withSpan (scoped tracing)
 *
 * @module
 */

export {
  DebugScope,
  DebugScopeProvider,
  useDebugScope,
  useDebugScopeContext,
} from "./DebugScope"
export type {
  DebugScopeProps,
  DebugScopeConfig,
  UseDebugScopeOptions,
  DebugScopeContextValue,
} from "./DebugScope"
