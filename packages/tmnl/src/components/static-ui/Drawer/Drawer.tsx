/**
 * TMNL Drawer Components
 *
 * Extracted from tmnl-ui.tsx for modular encapsulation.
 * Uses CSS custom properties from ScaleProvider.
 */

import { createContext, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/primitives';

// =============================================================================
// CONTEXT
// =============================================================================

export type DrawerSide = 'left' | 'right';

const DrawerContext = createContext<{ side: DrawerSide }>({ side: 'left' });

// =============================================================================
// DRAWER ROOT
// =============================================================================

export interface DrawerRootProps {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  side?: DrawerSide;
  width?: string;
}

export const DrawerRoot = ({
  children,
  open,
  onClose,
  side = 'left',
  width = 'w-64',
}: DrawerRootProps) => {
  const slideFrom = side === 'left' ? { x: '-100%' } : { x: '100%' };
  const slideTo = { x: 0 };

  return (
    <DrawerContext.Provider value={{ side }}>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              className={cn(
                'fixed top-0 bottom-0 z-50 bg-black flex flex-col',
                side === 'left'
                  ? 'left-0 border-r border-neutral-800'
                  : 'right-0 border-l border-neutral-800',
                width
              )}
              initial={slideFrom}
              animate={slideTo}
              exit={slideFrom}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            >
              {children}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DrawerContext.Provider>
  );
};

// =============================================================================
// DRAWER HEADER
// =============================================================================

export interface DrawerHeaderProps {
  title: string;
  onClose?: () => void;
}

export const DrawerHeader = ({ title, onClose }: DrawerHeaderProps) => (
  <div
    className="border-b border-neutral-800 flex items-center justify-between px-4 shrink-0"
    style={{ height: 'var(--tmnl-size-header, 48px)' }}
  >
    <Label>{title}</Label>
    {onClose && (
      <button
        onClick={onClose}
        className="text-neutral-600 hover:text-white transition-colors"
      >
        <X size={14} />
      </button>
    )}
  </div>
);

// =============================================================================
// DRAWER CONTENT
// =============================================================================

export interface DrawerContentProps {
  children: ReactNode;
  className?: string;
}

export const DrawerContent = ({ children, className }: DrawerContentProps) => (
  <div className={cn('flex-1 overflow-y-auto p-4 no-scrollbar', className)}>
    {children}
  </div>
);

// =============================================================================
// DRAWER FOOTER
// =============================================================================

export interface DrawerFooterProps {
  children: ReactNode;
}

export const DrawerFooter = ({ children }: DrawerFooterProps) => (
  <div className="border-t border-neutral-800 p-3 shrink-0">{children}</div>
);

// =============================================================================
// DRAWER NAV
// =============================================================================

export interface DrawerNavProps {
  items: string[];
  activeIndex?: number;
  onSelect?: (index: number) => void;
}

export const DrawerNav = ({
  items,
  activeIndex = 0,
  onSelect,
}: DrawerNavProps) => (
  <nav className="space-y-1">
    {items.map((item, i) => (
      <button
        key={item}
        onClick={() => onSelect?.(i)}
        className={cn(
          'w-full text-left px-3 py-2 font-mono uppercase tracking-[0.15em] transition-colors',
          i === activeIndex
            ? 'text-white bg-neutral-900 border-l-2 border-white'
            : 'text-neutral-500 hover:text-white hover:bg-neutral-900'
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {item}
      </button>
    ))}
  </nav>
);

// =============================================================================
// DRAWER SECTION
// =============================================================================

export interface DrawerSectionProps {
  title: string;
  children: ReactNode;
}

export const DrawerSection = ({ title, children }: DrawerSectionProps) => (
  <div className="space-y-3">
    <Label>{title}</Label>
    {children}
  </div>
);

// =============================================================================
// COMPOUND DRAWER EXPORT
// =============================================================================

export const Drawer = {
  Root: DrawerRoot,
  Header: DrawerHeader,
  Content: DrawerContent,
  Footer: DrawerFooter,
  Nav: DrawerNav,
  Section: DrawerSection,
};

// =============================================================================
// CONVENIENCE VARIANTS
// =============================================================================

export interface LeftDrawerProps {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  width?: string;
}

export const LeftDrawer = ({
  children,
  open,
  onClose,
  width = 'w-72',
}: LeftDrawerProps) => (
  <DrawerRoot open={open} onClose={onClose} side="left" width={width}>
    {children}
  </DrawerRoot>
);

export interface RightDrawerProps {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  width?: string;
}

export const RightDrawer = ({
  children,
  open,
  onClose,
  width = 'w-80',
}: RightDrawerProps) => (
  <DrawerRoot open={open} onClose={onClose} side="right" width={width}>
    {children}
  </DrawerRoot>
);
