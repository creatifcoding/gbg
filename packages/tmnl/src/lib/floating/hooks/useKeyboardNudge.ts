/**
 * useKeyboardNudge — DEPRECATED: Migrated to centralized keyboard dispatch
 *
 * Arrow key panel nudging is now handled by `useKeyboardDispatch.ts`.
 * This file is kept as a no-op for backward compatibility.
 *
 * @deprecated Use `useKeyboardDispatch` from the provider level instead.
 * @module
 */

interface UseKeyboardNudgeOptions {
  getLocalViewport: () => { width: number; height: number; top: number; left: number }
}

/**
 * No-op — arrow key nudge is now handled by the centralized
 * keyboard dispatch system in `useKeyboardDispatch.ts`.
 */
export function useKeyboardNudge(_opts: UseKeyboardNudgeOptions): void {
  // Intentionally empty — dispatch is installed at provider level
}
