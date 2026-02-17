/**
 * Command Palette Renderer
 *
 * Renders command palette overlay as a top-anchored workspace modal.
 *
 * @module
 */

import { useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useAtomValue } from '@effect-atom/atom-react'
import { useVisualOverlaySafe } from '../providers'
import { overlayAtom, getContent, isSuppressedAtom } from '../../atoms'
import type { VisualOverlayId, CommandPaletteConfig } from '../../schemas/visual'

export interface CommandPaletteRendererProps {
  /** Overlay ID */
  id: VisualOverlayId
  /** Callback when close requested */
  onCloseRequest?: () => void
}

const toCssDimension = (value: number | string | undefined, fallback: string): string => {
  if (typeof value === 'number') return `${value}px`
  if (typeof value === 'string' && value.length > 0) return value
  return fallback
}

const EASE_ENTER: [number, number, number, number] = [0.32, 0.72, 0, 1]
const EASE_EXIT: [number, number, number, number] = [0.4, 0, 1, 1]
const ENTER_DURATION_SECONDS = 0.2
const EXIT_DURATION_SECONDS = 0.12

const backdropStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'var(--tmnl-size-header, 48px)',
  left: 'var(--tmnl-size-sidebar, 48px)',
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '10px 14px 0',
  pointerEvents: 'auto',
  backgroundColor: 'transparent',
}

const paletteContainerStyle = (
  width: string,
  maxWidth: string,
  verticalOffset: string,
): React.CSSProperties => ({
  position: 'relative',
  width,
  maxWidth,
  marginTop: verticalOffset,
  maxHeight: 'min(80vh, 680px)',
  backgroundColor: 'transparent',
  borderRadius: '10px',
  overflow: 'hidden',
  pointerEvents: 'auto',
  transformOrigin: '50% 0%',
  willChange: 'transform, opacity',
})

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
} as const

const panelVariants = (reduceMotion: boolean) =>
  reduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }
    : {
        hidden: { opacity: 0, y: 14, scale: 0.985 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }

export function CommandPaletteRenderer({ id, onCloseRequest }: CommandPaletteRendererProps) {
  const ctx = useVisualOverlaySafe()
  const reduceMotion = useReducedMotion()

  const overlay = useAtomValue(overlayAtom(id))
  const isSuppressed = useAtomValue(isSuppressedAtom({ type: 'command-palette', id }))

  useEffect(() => {
    if (!overlay || !overlay.isVisible) return

    const config = overlay.config as CommandPaletteConfig
    if (!config.closeOnEscape) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRequest?.()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [overlay, onCloseRequest])

  if (!overlay || isSuppressed) return null

  const config = overlay.config as CommandPaletteConfig
  const content = getContent(overlay.contentKey)

  const targetState =
    overlay.animationState === 'exiting' || overlay.animationState === 'exited'
      ? 'hidden'
      : 'visible'

  const width = toCssDimension(config.width, 'min(78vw, 680px)')
  const maxWidth = toCssDimension(config.maxWidth, '680px')
  const verticalOffset = toCssDimension(config.paddingTop, '0px')

  const backdropTransition = reduceMotion
    ? { duration: 0.08, ease: 'linear' as const }
    : {
        duration: targetState === 'visible' ? 0.1 : 0.08,
        ease: targetState === 'visible' ? EASE_ENTER : EASE_EXIT,
      }

  const panelTransition = reduceMotion
    ? { duration: 0.1, ease: 'linear' as const }
    : targetState === 'visible'
      ? {
          duration: ENTER_DURATION_SECONDS,
          ease: EASE_ENTER,
        }
      : {
          duration: EXIT_DURATION_SECONDS,
          ease: EASE_EXIT,
        }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCloseRequest?.()
    }
  }

  const handlePanelAnimationComplete = () => {
    if (!ctx) return

    if (overlay.animationState === 'entering') {
      ctx.setAnimationState(id, 'visible')
      return
    }

    if (overlay.animationState === 'exiting') {
      ctx.setAnimationState(id, 'exited')
    }
  }

  return (
    <motion.div
      initial='hidden'
      animate={targetState}
      variants={backdropVariants}
      transition={backdropTransition}
      style={backdropStyle}
      onClick={handleBackdropClick}
      data-command-palette-id={id}
      data-animation-state={overlay.animationState}
      role='presentation'
      aria-hidden='true'
    >
      <motion.div
        key={`${id}-${overlay.openedAt}`}
        initial='hidden'
        animate={targetState}
        variants={panelVariants(reduceMotion)}
        transition={panelTransition}
        style={paletteContainerStyle(width, maxWidth, verticalOffset)}
        role='dialog'
        aria-modal='true'
        aria-label='Command palette'
        onClick={(e) => e.stopPropagation()}
        onAnimationComplete={handlePanelAnimationComplete}
      >
        {content}
      </motion.div>
    </motion.div>
  )
}

export default CommandPaletteRenderer
