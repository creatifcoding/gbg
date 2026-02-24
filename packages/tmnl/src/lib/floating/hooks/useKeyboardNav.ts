/**
 * useKeyboardNav — DEPRECATED: Migrated to centralized keyboard dispatch
 *
 * All keyboard actions now live in `useKeyboardDispatch.ts`.
 * This file is kept as a no-op for backward compatibility —
 * any component calling `useKeyboardNav()` gets a harmless empty hook.
 *
 * @deprecated Use `useKeyboardDispatch` from the provider level instead.
 * @module
 */

/**
 * No-op — all keyboard navigation is now handled by the centralized
 * keyboard dispatch system in `useKeyboardDispatch.ts`.
 */
export function useKeyboardNav(): void {
  // Intentionally empty — dispatch is installed at provider level
}
