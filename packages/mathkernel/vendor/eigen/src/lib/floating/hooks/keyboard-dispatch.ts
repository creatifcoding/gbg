/**
 * keyboard-dispatch — Centralized keyboard event dispatch for the floating panel system
 *
 * Architecture:
 *   1. Single `window.addEventListener('keydown', handler, { capture: true })` listener
 *   2. Guard chain: isInputFocused → isModalOpen → action match → e.repeat → debounce
 *   3. Priority-ordered action registry — first claim wins, event is consumed
 *   4. All floating panel keyboard behavior flows through this single point
 *
 * Guard chain rationale:
 *   - INPUT GUARD: typing in `<input>`, `<textarea>`, `[contenteditable]` must never
 *     trigger panel actions (prevents close-on-q, focus-jump-on-h, etc.)
 *   - MODAL GUARD: context menus, palettes, and rename inputs set `[data-kb-modal]`
 *     on the document body to signal "modal is open — suppress global shortcuts"
 *   - REPEAT GUARD: `e.repeat === true` is blocked for one-shot actions (close, spawn,
 *     float/dock, maximize). Repeatable actions (focus, swap, nudge) are allowed.
 *   - DEBOUNCE GUARD: per-action cooldown prevents runaway repeats. Configurable per
 *     action (default 80ms for repeatable, 0 for one-shot since repeat is blocked)
 *
 * Priority levels (lower number = higher priority):
 *   0 — CAPTURE: modal escape, overlay toggle (always fires)
 *   1 — MODAL: context menu actions, palette dismiss
 *   2 — NAV: panel focus, swap, split, close, float/dock, tabs
 *   3 — NUDGE: arrow key nudging (lowest — yields to nav arrows)
 *
 * @module floating/hooks/keyboard-dispatch
 */

// =============================================================================
// Types
// =============================================================================

/** Priority levels for keyboard actions */
export const KBPriority = {
  /** Always fires — escape from maximize, overlay toggle */
  CAPTURE: 0,
  /** Modal-level — context menu, palette */
  MODAL: 1,
  /** Navigation — focus, swap, tabs, close */
  NAV: 2,
  /** Nudge — arrow key panel movement (yields to nav) */
  NUDGE: 3,
} as const

export type KBPriorityLevel = (typeof KBPriority)[keyof typeof KBPriority]

export interface KeyboardAction {
  /** Unique action identifier (for debounce map key) */
  id: string
  /** Priority level — lower fires first */
  priority: KBPriorityLevel
  /**
   * Key matcher — return true if this action claims the event.
   * Receives the raw KeyboardEvent. Check e.key, e.altKey, e.shiftKey, etc.
   */
  match: (e: KeyboardEvent) => boolean
  /**
   * Execute the action. Return void.
   * The event is already `preventDefault()`'d and `stopPropagation()`'d by the time
   * this fires — no need to call them again (but it's safe if you do).
   */
  execute: (e: KeyboardEvent) => void
  /** Whether the action can repeat when key is held (default: false = one-shot) */
  repeatable?: boolean
  /** Debounce cooldown in ms (default: 80ms for repeatable, 0 for one-shot) */
  debounceMs?: number
  /**
   * Whether this action should fire even when an input is focused.
   * Default: false. Use sparingly (e.g., Escape to dismiss).
   */
  bypassInputGuard?: boolean
  /**
   * Whether this action should fire even when a modal is open.
   * Default: false. Use for the escape key and overlay toggle.
   */
  bypassModalGuard?: boolean
  /**
   * Optional: only match when the panel system is in a specific state.
   * Return false to skip this action without consuming the event.
   */
  when?: () => boolean
}

// =============================================================================
// Guards
// =============================================================================

/**
 * Is the currently focused element an input that should swallow keyboard events?
 * Checks: input, textarea, select, contenteditable, elements with role=textbox
 */
export function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false

  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if ((el as HTMLElement).isContentEditable) return true
  if (el.getAttribute('role') === 'textbox') return true

  return false
}

/**
 * Is a modal/overlay currently open that should suppress global shortcuts?
 * Checks for `[data-kb-modal]` attribute on any element in the DOM.
 *
 * Components that want to suppress shortcuts should add:
 *   `data-kb-modal="true"` to their root element.
 *
 * This includes: context menus, command palettes, rename inputs, dialogs.
 */
export function isModalOpen(): boolean {
  return document.querySelector('[data-kb-modal]') !== null
}

// =============================================================================
// Debounce state
// =============================================================================

/** Per-action last-fire timestamp */
const lastFiredMap = new Map<string, number>()

/**
 * Check if an action should fire based on its debounce window.
 * Returns true and updates the timestamp if the cooldown has elapsed.
 */
function passesDebounceCooldown(actionId: string, debounceMs: number): boolean {
  if (debounceMs <= 0) return true

  const now = performance.now()
  const last = lastFiredMap.get(actionId) ?? 0
  if (now - last < debounceMs) return false

  lastFiredMap.set(actionId, now)
  return true
}

// =============================================================================
// Registry
// =============================================================================

/** The global action registry. Mutable — actions register/unregister at mount/unmount. */
const registry: KeyboardAction[] = []

/** Sorted cache — invalidated on register/unregister */
let sortedCache: KeyboardAction[] | null = null

function getSorted(): KeyboardAction[] {
  if (!sortedCache) {
    sortedCache = [...registry].sort((a, b) => a.priority - b.priority)
  }
  return sortedCache
}

/**
 * Register a keyboard action. Returns an unregister function.
 *
 * @example
 * ```ts
 * const unregister = registerKeyboardAction({
 *   id: 'nav-focus-left',
 *   priority: KBPriority.NAV,
 *   match: (e) => e.altKey && !e.shiftKey && (e.key === 'h' || e.key === 'ArrowLeft'),
 *   execute: () => moveFocusInDirection('left'),
 *   repeatable: true,
 *   debounceMs: 80,
 * })
 *
 * // On cleanup:
 * unregister()
 * ```
 */
export function registerKeyboardAction(action: KeyboardAction): () => void {
  registry.push(action)
  sortedCache = null // Invalidate sort

  return () => {
    const idx = registry.indexOf(action)
    if (idx >= 0) {
      registry.splice(idx, 1)
      sortedCache = null
    }
  }
}

/**
 * Register multiple actions at once. Returns a single unregister function.
 */
export function registerKeyboardActions(actions: KeyboardAction[]): () => void {
  const unregisters = actions.map(a => registerKeyboardAction(a))
  return () => unregisters.forEach(fn => fn())
}

// =============================================================================
// Dispatch — the single handler
// =============================================================================

/**
 * The master keydown handler. Runs through the guard chain and dispatches
 * to the first matching action.
 */
function dispatchKeyboard(e: KeyboardEvent): void {
  const sorted = getSorted()
  const inputFocused = isInputFocused()
  const modalOpen = isModalOpen()

  for (const action of sorted) {
    // ── Guard: input focus ──────────────────────────────────
    if (inputFocused && !action.bypassInputGuard) continue

    // ── Guard: modal open ───────────────────────────────────
    if (modalOpen && !action.bypassModalGuard) continue

    // ── Guard: conditional activation ───────────────────────
    if (action.when && !action.when()) continue

    // ── Match ───────────────────────────────────────────────
    if (!action.match(e)) continue

    // ── Guard: repeat key ───────────────────────────────────
    if (e.repeat && !action.repeatable) return // Consume but don't fire

    // ── Guard: debounce ─────────────────────────────────────
    const debounce = action.debounceMs ?? (action.repeatable ? 80 : 0)
    if (!passesDebounceCooldown(action.id, debounce)) return // Consume but throttle

    // ── Fire! ───────────────────────────────────────────────
    e.preventDefault()
    e.stopPropagation()
    action.execute(e)
    return // First claim wins
  }
}

// =============================================================================
// Lifecycle — install/uninstall the single global listener
// =============================================================================

let listenerInstalled = false
let refCount = 0

/**
 * Install the global keydown listener. Call from a useEffect.
 * Uses reference counting — safe to call from multiple components.
 * Returns an uninstall function.
 */
export function installKeyboardDispatch(): () => void {
  refCount++
  if (!listenerInstalled) {
    window.addEventListener('keydown', dispatchKeyboard, { capture: true })
    listenerInstalled = true
  }

  return () => {
    refCount--
    if (refCount <= 0) {
      window.removeEventListener('keydown', dispatchKeyboard, { capture: true })
      listenerInstalled = false
      refCount = 0
    }
  }
}
