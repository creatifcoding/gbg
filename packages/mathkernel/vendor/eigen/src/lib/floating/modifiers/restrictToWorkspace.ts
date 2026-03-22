/**
 * restrictToWorkspace modifier
 *
 * Constrains drag to the AppShell workspace rect.
 * With `contain: paint` on the workspace, position:fixed panels are
 * workspace-relative. restrictToWindowEdges would use the wrong rect.
 *
 * @module
 */

import { useCallback, type RefObject } from 'react'
import type { ClientRect, Modifier } from '@dnd-kit/core'

export function useRestrictToWorkspace(workspaceRectRef: RefObject<ClientRect | null>) {
  return useCallback<Modifier>(({ transform, draggingNodeRect, windowRect }) => {
    if (!draggingNodeRect) return transform

    const boundingRect = workspaceRectRef.current ?? windowRect
    if (!boundingRect) return transform

    const value = { ...transform }

    if (draggingNodeRect.top + value.y <= boundingRect.top) {
      value.y = boundingRect.top - draggingNodeRect.top
    } else if (draggingNodeRect.bottom + value.y >= boundingRect.top + boundingRect.height) {
      value.y = boundingRect.top + boundingRect.height - draggingNodeRect.bottom
    }

    if (draggingNodeRect.left + value.x <= boundingRect.left) {
      value.x = boundingRect.left - draggingNodeRect.left
    } else if (draggingNodeRect.right + value.x >= boundingRect.left + boundingRect.width) {
      value.x = boundingRect.left + boundingRect.width - draggingNodeRect.right
    }

    return value
  }, [workspaceRectRef])
}
