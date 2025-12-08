/**
 * AcquireGhostShape
 *
 * Minimal targeting reticle shown during canvas-space drag.
 * Inspired by CEW ACQUIRE disposition - soft lock with pulsing center.
 */

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type TLBaseShape,
} from 'tldraw'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// =============================================================================
// SHAPE TYPE
// =============================================================================

export type AcquireGhostShape = TLBaseShape<
  'acquire-ghost',
  {
    w: number
    h: number
    rowName: string
    status: 'active' | 'pending' | 'inactive'
  }
>

// =============================================================================
// VISUAL COMPONENT
// =============================================================================

function AcquireGhostVisual({
  rowName,
  status,
  size,
}: {
  rowName: string
  status: string
  size: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const outerRingRef = useRef<HTMLDivElement>(null)
  const innerRingRef = useRef<HTMLDivElement>(null)
  const centerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const tl = gsap.timeline({ repeat: -1 })

    // Outer ring rotation (slow)
    if (outerRingRef.current) {
      gsap.to(outerRingRef.current, {
        rotation: 360,
        duration: 8,
        repeat: -1,
        ease: 'none',
      })
    }

    // Inner ring counter-rotation
    if (innerRingRef.current) {
      gsap.to(innerRingRef.current, {
        rotation: -360,
        duration: 12,
        repeat: -1,
        ease: 'none',
      })
    }

    // Center pulse
    if (centerRef.current) {
      gsap.to(centerRef.current, {
        scale: 1.2,
        opacity: 0.8,
        duration: 0.75,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
    }

    return () => {
      gsap.killTweensOf([outerRingRef.current, innerRingRef.current, centerRef.current])
    }
  }, [])

  const ringSize = size * 0.9
  const innerSize = size * 0.7
  const centerSize = size * 0.15

  return (
    <div
      ref={containerRef}
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Crosshairs */}
      <div
        style={{
          position: 'absolute',
          width: size * 1.4,
          height: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1,
          height: size * 1.4,
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Outer ring - brackets */}
      <div
        ref={outerRingRef}
        style={{
          position: 'absolute',
          width: ringSize,
          height: ringSize,
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRadius: '50%',
        }}
      />

      {/* Inner ring - counter-rotating */}
      <div
        ref={innerRingRef}
        style={{
          position: 'absolute',
          width: innerSize,
          height: innerSize,
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderRadius: '50%',
        }}
      />

      {/* Center dot */}
      <div
        ref={centerRef}
        style={{
          width: centerSize,
          height: centerSize,
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
          borderRadius: '50%',
          boxShadow: '0 0 10px rgba(255, 255, 255, 0.4)',
        }}
      />

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          bottom: -20,
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255, 255, 255, 0.6)',
          padding: '2px 6px',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        {rowName}
      </div>
    </div>
  )
}

// =============================================================================
// SHAPE UTIL
// =============================================================================

export class AcquireGhostShapeUtil extends BaseBoxShapeUtil<AcquireGhostShape> {
  static override type = 'acquire-ghost' as const
  static override props = {
    w: T.number,
    h: T.number,
    rowName: T.string,
    status: T.string,
  }

  override canResize() {
    return false
  }

  override canEdit() {
    return false
  }

  override canBind() {
    return false
  }

  override hideSelectionBoundsBg() {
    return true
  }

  override hideSelectionBoundsFg() {
    return true
  }

  getDefaultProps(): AcquireGhostShape['props'] {
    return {
      w: 60,
      h: 60,
      rowName: 'TARGET',
      status: 'active',
    }
  }

  override component(shape: AcquireGhostShape) {
    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AcquireGhostVisual
          rowName={shape.props.rowName}
          status={shape.props.status}
          size={Math.min(shape.props.w, shape.props.h)}
        />
      </HTMLContainer>
    )
  }

  override indicator(shape: AcquireGhostShape) {
    // No indicator for ghost shape
    return null
  }
}
