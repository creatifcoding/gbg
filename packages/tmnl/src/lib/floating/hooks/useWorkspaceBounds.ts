/**
 * useWorkspaceBounds
 *
 * Caches workspace bounding rect via ResizeObserver.
 * Avoids querySelector/getBoundingClientRect on every drag frame.
 *
 * @module
 */

import { useEffect, useRef, useCallback } from 'react'
import type { ClientRect } from '@dnd-kit/core'
import type { Viewport } from '../utils/position'

export function useWorkspaceBounds() {
  const workspaceRectRef = useRef<ClientRect | null>(null)

  useEffect(() => {
    const workspace = document.querySelector('[data-shell-workspace]')
    if (!workspace) {
      workspaceRectRef.current = null
      return
    }

    const updateRect = () => {
      const r = workspace.getBoundingClientRect()
      workspaceRectRef.current = {
        top: r.top,
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      }
    }

    updateRect()

    const observer = new ResizeObserver(updateRect)
    observer.observe(workspace)
    window.addEventListener('resize', updateRect)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateRect)
    }
  }, [])

  const getLocalViewport = useCallback((): Viewport => {
    const boundsRect = workspaceRectRef.current
    if (boundsRect) {
      return { x: 0, y: 0, width: boundsRect.width, height: boundsRect.height }
    }
    return {
      x: 0,
      y: 0,
      width: typeof window !== 'undefined' ? window.innerWidth : 1920,
      height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    }
  }, [])

  return { workspaceRectRef, getLocalViewport }
}
