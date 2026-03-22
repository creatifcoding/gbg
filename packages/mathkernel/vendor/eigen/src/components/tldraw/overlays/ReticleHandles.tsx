/**
 * ReticleHandles
 *
 * Custom tldraw Handles component that adds reticle effects on handle interaction.
 * Wraps the default TldrawHandles with crosshair and pulsing ring overlays.
 */

import { TldrawHandles, useEditor, useValue } from 'tldraw'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createCrosshair,
  createReticleRings,
  createCornerEmanation,
  COLORS,
} from '@/lib/animation'

// =============================================================================
// TYPES
// =============================================================================

interface HandleReticle {
  id: string
  position: { x: number; y: number }
  crosshair: ReturnType<typeof createCrosshair> | null
  rings: ReturnType<typeof createReticleRings> | null
  isActive: boolean
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ReticleHandles(props: React.ComponentProps<typeof TldrawHandles>) {
  const editor = useEditor()
  const containerRef = useRef<HTMLDivElement>(null)
  const reticlesRef = useRef<Map<string, HandleReticle>>(new Map())
  const [activeHandleId, setActiveHandleId] = useState<string | null>(null)

  // Track pointer state
  const isPointerDown = useValue(
    'pointer down',
    () => editor.inputs.isPointing,
    [editor]
  )

  // Track hovered handle
  const hoveredHandle = useValue(
    'hovered handle',
    () => {
      // Check if we're hovering over a handle
      const target = editor.inputs.pointerState
      // This is a simplified check - in practice you'd inspect the event target
      return null // Placeholder - would need to track handle hover state
    },
    [editor]
  )

  // Clean up reticles on unmount
  useEffect(() => {
    return () => {
      reticlesRef.current.forEach((reticle) => {
        reticle.crosshair?.destroy()
        reticle.rings?.destroy()
      })
      reticlesRef.current.clear()
    }
  }, [])

  // Handle pointer down on resize handle
  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    const target = event.target as HTMLElement
    const container = containerRef.current

    // Check if we clicked on a handle
    const handleElement = target.closest('[data-handle-id]') as HTMLElement
    if (!handleElement || !container) return

    const handleId = handleElement.dataset.handleId
    if (!handleId) return

    // Get handle position
    const rect = handleElement.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const position = {
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top + rect.height / 2 - containerRect.top,
    }

    // Create corner emanation effect
    const emanation = createCornerEmanation(container, position, {
      colors: {
        primary: COLORS.reticle.primary,
        secondary: COLORS.reticle.secondary,
        tertiary: COLORS.reticle.tertiary,
      },
    })
    emanation.play()

    // Create and activate reticle for this handle
    let reticle = reticlesRef.current.get(handleId)

    if (!reticle) {
      reticle = {
        id: handleId,
        position,
        crosshair: createCrosshair(container, position, {
          color: COLORS.reticle.primary,
        }),
        rings: createReticleRings(container, position, {
          color: COLORS.reticle.primary,
        }),
        isActive: false,
      }
      reticlesRef.current.set(handleId, reticle)
    }

    // Activate the reticle
    reticle.isActive = true
    reticle.crosshair?.expand()
    reticle.rings?.start()
    setActiveHandleId(handleId)
  }, [])

  // Handle pointer up - deactivate reticle
  const handlePointerUp = useCallback(() => {
    if (activeHandleId) {
      const reticle = reticlesRef.current.get(activeHandleId)
      if (reticle) {
        reticle.isActive = false
        reticle.crosshair?.collapse()
        reticle.rings?.stop()
      }
      setActiveHandleId(null)
    }
  }, [activeHandleId])

  // Listen for global pointer up
  useEffect(() => {
    if (activeHandleId) {
      window.addEventListener('pointerup', handlePointerUp)
      return () => window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [activeHandleId, handlePointerUp])

  return (
    <div
      ref={containerRef}
      className="reticle-handles-container"
      style={{ position: 'relative' }}
      onPointerDown={handlePointerDown}
    >
      {/* Render the default tldraw handles */}
      <TldrawHandles {...props} />

      {/* Reticle overlay layer */}
      <div
        className="reticle-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />
    </div>
  )
}

export default ReticleHandles
