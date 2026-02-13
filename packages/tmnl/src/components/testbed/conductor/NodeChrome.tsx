import { useEffect, useMemo, useRef, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { animate as animeAnimate } from 'animejs'

/**
 * Node interaction contract (Phase 1 + sub-features)
 * - Click: activates node
 * - Drag: owned by dnd-kit listeners on root shell
 * - Visual overlays are pointer-transparent and never block drag/click routing
 * - Chrome accent is injectable (groupAccent), defaulting to black for brutalist baseline
 */
export interface NodeChromeProps {
  readonly nodeId: string
  readonly isActive: boolean
  readonly isSelected: boolean
  readonly style: CSSProperties
  readonly setNodeRef: (el: HTMLDivElement | null) => void
  readonly listeners?: Record<string, unknown>
  readonly attributes?: Record<string, unknown>
  readonly onClick: (event: MouseEvent<HTMLDivElement>) => void
  readonly onPointerDownCapture?: (event: PointerEvent<HTMLDivElement>) => void
  readonly onPointerUpCapture?: (event: PointerEvent<HTMLDivElement>) => void
  readonly groupAccent?: string
  readonly showShiftDragOverlay?: boolean
  readonly children: ReactNode
}

const cornerStyle = (
  corner: 'tl' | 'tr' | 'bl' | 'br',
  accent: string,
  active: boolean
): CSSProperties => {
  const size = active ? 16 : 14
  const base: CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    borderColor: accent,
    borderStyle: 'solid',
    pointerEvents: 'none',
  }

  if (corner === 'tl') {
    return { ...base, left: -5, top: -5, borderWidth: '2px 0 0 2px' }
  }
  if (corner === 'tr') {
    return { ...base, right: -5, top: -5, borderWidth: '2px 2px 0 0' }
  }
  if (corner === 'bl') {
    return { ...base, left: -5, bottom: -5, borderWidth: '0 0 2px 2px' }
  }
  return { ...base, right: -5, bottom: -5, borderWidth: '0 2px 2px 0' }
}

export function NodeChrome({
  nodeId,
  isActive,
  isSelected,
  style,
  setNodeRef,
  listeners,
  attributes,
  onClick,
  onPointerDownCapture,
  onPointerUpCapture,
  groupAccent,
  showShiftDragOverlay = false,
  children,
}: NodeChromeProps) {
  const accent = groupAccent ?? '#000'
  const pulseLayerRef = useRef<HTMLDivElement>(null)
  // Lexicon reference: CROWN (#1), SHELL (#2), SHIFT-VEIL (#10)
  // See ./NODE_STATE_LEXICON.md
  const showChrome = isActive || isSelected || showShiftDragOverlay

  const depthShadow = useMemo(() => {
    if (!showChrome) return undefined

    if (isActive) {
      return [
        `0 0 0 1px ${accent}`,
        `2px 2px 0 ${accent}`,
        '5px 5px 0 rgba(0, 0, 0, 0.62)',
        '9px 9px 0 rgba(0, 0, 0, 0.24)',
      ].join(', ')
    }

    return [
      `0 0 0 1px ${accent}`,
      `1px 1px 0 ${accent}`,
      '4px 4px 0 rgba(0, 0, 0, 0.35)',
    ].join(', ')
  }, [accent, isActive, showChrome])

  useEffect(() => {
    const layer = pulseLayerRef.current
    if (!layer) return

    if (!showChrome) {
      layer.style.opacity = '0'
      layer.style.transform = 'scale(1)'
      return
    }

    const corners = layer.querySelectorAll('[data-corner]')

    const breathe = animeAnimate(layer, {
      opacity: isActive ? [0.7, 1] : [0.45, 0.8],
      scale: isActive ? [1, 1.02] : [1, 1.01],
      duration: isActive ? 920 : 1200,
      easing: 'easeInOutSine',
      direction: 'alternate',
      loop: true,
    })

    const arcadeCorners = animeAnimate(corners, {
      translateY: [0, -1.5],
      scale: [1, 1.12],
      opacity: isActive ? [0.7, 1] : [0.45, 0.82],
      duration: 760,
      easing: 'easeInOutSine',
      delay: (_, i) => i * 55,
      direction: 'alternate',
      loop: true,
    })

    return () => {
      breathe.pause()
      arcadeCorners.pause()
      layer.style.opacity = showChrome ? (isActive ? '0.9' : '0.65') : '0'
      layer.style.transform = 'scale(1)'
    }
  }, [isActive, showChrome])

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: 'absolute',
        boxShadow: depthShadow,
        transition: 'box-shadow 160ms ease-out',
        willChange: 'transform',
      }}
      onClick={onClick}
      onPointerDownCapture={onPointerDownCapture}
      onPointerUpCapture={onPointerUpCapture}
      {...listeners}
      {...attributes}
      data-node-id={nodeId}
    >
      {showChrome && (
        <div
          ref={pulseLayerRef}
          aria-hidden
          style={{
            position: 'absolute',
            inset: -4,
            pointerEvents: 'none',
            zIndex: 4,
            opacity: isActive ? 0.9 : 0.65,
            transformOrigin: 'center',
          }}
        >
          <div data-corner style={cornerStyle('tl', accent, isActive)} />
          <div data-corner style={cornerStyle('tr', accent, isActive)} />
          <div data-corner style={cornerStyle('bl', accent, isActive)} />
          <div data-corner style={cornerStyle('br', accent, isActive)} />
        </div>
      )}

      {showShiftDragOverlay && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: -10,
            border: `2px dashed ${accent}`,
            background: 'rgba(0, 0, 0, 0.06)',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}
