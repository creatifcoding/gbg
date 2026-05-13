/**
 * View state for ms tool — 3-state expand FSM.
 *
 * States:
 *   collapsed — default, result capped at 15 lines
 *   output    — full result, no eval code box
 *   eval      — eval code box + full result
 *
 * Transitions:
 *   Ctrl+O (pi's expandTools):
 *     collapsed → output
 *     output → collapsed
 *     eval → collapsed (pi collapses, we reset)
 *
 *   Ctrl+Shift+O (our custom shortcut):
 *     collapsed → eval (showEval on)
 *     output → eval (showEval on)
 *     eval → output (showEval off)
 *
 * The trick: pi controls `expanded` (boolean). We control `showEval` (boolean).
 * Combined, they give us the 3 states:
 *   expanded=false               → collapsed
 *   expanded=true, showEval=false → output
 *   expanded=true, showEval=true  → eval
 *
 * When Ctrl+Shift+O fires, we set showEval and trigger a re-render.
 * If pi's expanded is false, the eval box won't show (pi hasn't expanded).
 * So Ctrl+Shift+O from collapsed = nothing visible until user also hits Ctrl+O.
 *
 * To avoid this UX gap, we track the "desired" mode and render accordingly.
 *
 * @module
 */

export type ViewMode = 'collapsed' | 'output' | 'eval'

let _showEval = false
let _onInvalidate: (() => void) | null = null

/**
 * Register a callback to fire when view state changes (triggers TUI re-render).
 */
export function onViewStateChange(cb: () => void): void {
  _onInvalidate = cb
}

/**
 * Get whether the eval panel should be shown.
 */
export function getShowEval(): boolean {
  return _showEval
}

/**
 * Toggle the eval panel. Returns new showEval state.
 */
export function toggleShowEval(): boolean {
  _showEval = !_showEval
  _onInvalidate?.()
  return _showEval
}

/**
 * Reset view state (e.g., when pi collapses everything).
 */
export function resetViewState(): void {
  _showEval = false
}

/**
 * Resolve the effective view mode from pi's expanded + our showEval.
 *
 * @param piExpanded - pi's native expanded state (Ctrl+O)
 * @returns The effective view mode
 */
export function resolveViewMode(piExpanded: boolean): ViewMode {
  if (!piExpanded && !_showEval) return 'collapsed'
  if (!piExpanded && _showEval) return 'eval'  // user wants eval, show it even if pi not expanded
  if (piExpanded && !_showEval) return 'output'
  return 'eval' // piExpanded && _showEval
}
