/**
 * Drawer Renderer
 *
 * Renders drawer overlay content with spring slide animations.
 * Uses framer-motion for buttery-smooth animations matching the
 * old static-ui Drawer component.
 *
 * @module
 */

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlaySafe } from "../providers"
import {
  overlayAtom,
  getContent,
  isSuppressedAtom,
} from "../../atoms"
import { BACKDROP_COLOR } from "../constants"
import type { VisualOverlayId, DrawerConfig } from "../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DrawerRendererProps {
  /** Overlay ID */
  id: VisualOverlayId
  /** Callback when close requested (backdrop click, escape) */
  onCloseRequest?: () => void
}

// ─────────────────────────────────────────────────────────────
// Animation Config (matches old Drawer)
// ─────────────────────────────────────────────────────────────

const SPRING_CONFIG = { type: "spring", stiffness: 400, damping: 40 } as const

// Named variants for proper animation callbacks
const drawerVariants = {
  hidden: (side: "left" | "right") => ({
    x: side === "left" ? "-100%" : "100%",
  }),
  visible: {
    x: 0,
  },
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const drawerContainerStyles = (
  side: "left" | "right",
  width: number
): React.CSSProperties => ({
  position: "absolute",
  top: "var(--tmnl-size-header, 48px)",
  bottom: 0,
  [side]: 0,
  width: `${width}px`,
  backgroundColor: "#000",
  borderLeft: side === "right" ? "1px solid rgb(38, 38, 38)" : undefined,
  borderRight: side === "left" ? "1px solid rgb(38, 38, 38)" : undefined,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
})

const contentStyles: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function DrawerRenderer({ id, onCloseRequest }: DrawerRendererProps) {
  const ctx = useVisualOverlaySafe()

  const overlay = useAtomValue(overlayAtom(id))

  const isSuppressed = useAtomValue(
    isSuppressedAtom({ type: "drawer", id })
  )

  // Handle escape key
  useEffect(() => {
    if (!overlay || !overlay.isVisible) return

    const config = overlay.config as DrawerConfig
    if (!config.closeOnEscape) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onCloseRequest?.()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [overlay, onCloseRequest])

  // Animation complete callback - update state when framer-motion finishes
  const handleAnimationComplete = (definition: string) => {
    if (!ctx || !overlay) return

    if (definition === "visible" && overlay.animationState === "entering") {
      ctx.setAnimationState(id, "visible")
    }
    if (definition === "hidden" && overlay.animationState === "exiting") {
      ctx.setAnimationState(id, "exited")
    }
  }

  if (!overlay || isSuppressed) return null

  const config = overlay.config as DrawerConfig
  const content = getContent(overlay.contentKey)
  const isVisible = overlay.animationState === "visible" || overlay.animationState === "entering"
  const side = config.side ?? "right"
  const width = config.width ?? 400

  const handleBackdropClick = () => {
    if (config.closeOnOverlayClick) {
      onCloseRequest?.()
    }
  }

  return (
    <div data-drawer-id={id}>
      <AnimatePresence mode="wait">
        {isVisible && (
          <>
            {/* Backdrop (optional) */}
            {config.showBackdrop && (
              <motion.div
                key={`${id}-backdrop`}
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: BACKDROP_COLOR,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                aria-hidden="true"
              />
            )}

            {/* Drawer panel */}
            <motion.div
              key={`${id}-panel`}
              style={drawerContainerStyles(side, width)}
              variants={drawerVariants}
              custom={side}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={SPRING_CONFIG}
              onAnimationComplete={handleAnimationComplete}
              role="dialog"
              aria-modal="true"
            >
              <div style={contentStyles}>{content}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DrawerRenderer
