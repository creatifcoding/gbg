/**
 * usePanelState — encapsulates all stx selectors for a single panel
 *
 * Returns a PanelContextState object. Isolates stx coupling
 * so FloatingPanel.tsx never touches stx directly.
 *
 * @module
 */

import { useSelector } from '@/lib/stx'
import { getFloatingStx } from '../floating-stx'
import type { PanelContextState } from '../context/PanelContext'

export function usePanelState(id: string): PanelContextState | null {
  const stxPanel = getFloatingStx().data.panels.get(id)

  const position = useSelector(() => stxPanel?.position.get())
  const dimensions = useSelector(() => stxPanel?.dimensions.get())
  const constraints = useSelector(() => stxPanel?.constraints.get())
  const zIndex = useSelector(() => stxPanel?.zIndex.get())
  const visibility = useSelector(() => stxPanel?.visibility.get())
  const isDragging = useSelector(() => stxPanel?.isDragging.get() ?? false)
  const isResizing = useSelector(() => stxPanel?.isResizing.get() ?? false)
  const isMaximized = useSelector(() => stxPanel?.isMaximized.get() ?? false)
  const mode = useSelector(() => stxPanel?.mode.get())
  const autoSize = useSelector(() => stxPanel?.autoSize.get() ?? false)
  const closable = useSelector(() => stxPanel?.closable.get() ?? true)
  const minimizable = useSelector(() => stxPanel?.minimizable.get() ?? true)
  const resizable = useSelector(() => stxPanel?.resizable.get() ?? true)
  const accent = useSelector(() => stxPanel?.accent.get())

  if (!position || !dimensions) return null

  return {
    position,
    dimensions,
    constraints,
    zIndex,
    visibility,
    isDragging,
    isResizing,
    isMaximized,
    mode,
    autoSize,
    closable,
    minimizable,
    resizable,
    accent,
  }
}
