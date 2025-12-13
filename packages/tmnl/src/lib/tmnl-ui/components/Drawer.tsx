/**
 * TMNL Drawer Component
 *
 * Standalone drawer with Framer Motion spring animation.
 * For integration with the existing drawer system, see src/lib/drawer/
 */

import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../utils/cn'
import { TMNL_TOKENS } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

interface DrawerRootProps {
  children: ReactNode
  open: boolean
  onClose: () => void
  side?: 'left' | 'right'
  width?: string
}

interface DrawerHeaderProps {
  children: ReactNode
  className?: string
}

interface DrawerBodyProps {
  children: ReactNode
  className?: string
}

interface DrawerFooterProps {
  children: ReactNode
  className?: string
}

// =============================================================================
// DRAWER ROOT
// =============================================================================

export function DrawerRoot({
  children,
  open,
  onClose,
  side = 'right',
  width = 'w-80'
}: DrawerRootProps) {
  const slideFrom = side === 'left' ? { x: '-100%' } : { x: '100%' }
  const slideTo = { x: 0 }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            className={cn(
              'fixed top-0 bottom-0 z-50 flex flex-col',
              TMNL_TOKENS.bg.primary,
              side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
              TMNL_TOKENS.border.default,
              width
            )}
            initial={slideFrom}
            animate={slideTo}
            exit={slideFrom}
            transition={TMNL_TOKENS.animation.spring}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// =============================================================================
// DRAWER HEADER
// =============================================================================

export function DrawerHeader({ children, className }: DrawerHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 border-b',
        TMNL_TOKENS.border.default,
        className
      )}
    >
      {children}
    </div>
  )
}

// =============================================================================
// DRAWER BODY
// =============================================================================

export function DrawerBody({ children, className }: DrawerBodyProps) {
  return (
    <div className={cn('flex-1 overflow-y-auto p-4', className)}>
      {children}
    </div>
  )
}

// =============================================================================
// DRAWER FOOTER
// =============================================================================

export function DrawerFooter({ children, className }: DrawerFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-3 border-t',
        TMNL_TOKENS.border.default,
        className
      )}
    >
      {children}
    </div>
  )
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const Drawer = {
  Root: DrawerRoot,
  Header: DrawerHeader,
  Body: DrawerBody,
  Footer: DrawerFooter,
}
