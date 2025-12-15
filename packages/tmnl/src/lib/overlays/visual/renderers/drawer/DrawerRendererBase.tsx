/**
 * DrawerRendererBase
 *
 * Base renderer component that composes:
 * - useDrawerRenderer hook (state, events)
 * - Directional config (animations, positioning)
 *
 * This is the unified drawer renderer that handles all four directions.
 * Left/right/top/bottom are not separate components — they're configurations.
 *
 * @module
 */

import { motion, AnimatePresence } from "framer-motion"
import { useDrawerRenderer } from "./useDrawerRenderer"
import { getDirectionalConfig, SPRING_CONFIG } from "./directional"
import { BACKDROP_COLOR } from "../../constants"
import type { DrawerRendererProps } from "./types"

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const contentStyles: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function DrawerRendererBase({ id, onCloseRequest }: DrawerRendererProps) {
  const {
    shouldRender,
    config,
    content,
    isVisible,
    handleAnimationComplete,
    handleBackdropClick,
  } = useDrawerRenderer(id, onCloseRequest)

  if (!shouldRender || !config) return null

  // Get directional config based on drawer side
  const directional = getDirectionalConfig(config.side)
  const containerStyles = directional.containerStyles(config)
  const springConfig = directional.springConfig ?? SPRING_CONFIG

  return (
    <div data-drawer-id={id} data-drawer-side={config.side ?? "right"}>
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
              style={containerStyles}
              variants={directional.variants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={springConfig}
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

export default DrawerRendererBase
