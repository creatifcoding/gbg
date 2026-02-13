/**
 * useKeyboardBindings — Keyboard shortcuts scoped to shell DOM.
 *
 * Ctrl+C → copy selection
 * Ctrl+A → select all
 *
 * Scoped to shellRef, not document. Two shells on same page don't fight.
 *
 * @since v2
 */
import { useEffect, type RefObject } from 'react'

interface KeyboardBindingsInput {
  readonly shellRef: RefObject<HTMLElement | null>
  readonly selection: ReadonlySet<string>
  readonly allTaskIds: ReadonlyArray<string>
  readonly copySelection: () => void
  readonly setSelection: (ids: ReadonlySet<string>) => void
}

export function useKeyboardBindings({
  shellRef,
  selection,
  allTaskIds,
  copySelection,
  setSelection,
}: KeyboardBindingsInput) {
  useEffect(() => {
    const el = shellRef.current
    if (!el) return

    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return

      switch (e.key) {
        case 'c':
          if (selection.size > 0) {
            e.preventDefault()
            e.stopPropagation()
            copySelection()
          }
          break
        case 'a':
          e.preventDefault()
          e.stopPropagation()
          setSelection(new Set(allTaskIds))
          break
      }
    }

    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
  }, [shellRef, selection, allTaskIds, copySelection, setSelection])
}
