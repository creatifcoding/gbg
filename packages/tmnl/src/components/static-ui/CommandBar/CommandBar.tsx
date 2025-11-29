/**
 * TMNL Command Bar
 *
 * Emacs-style command palette.
 * Extracted from tmnl-ui.tsx for modular encapsulation.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Kbd } from '@/components/primitives';

// =============================================================================
// COMMAND BAR
// =============================================================================

export interface CommandBarProps {
  open: boolean;
  onClose: () => void;
  onExecute?: (command: string) => void;
}

export const CommandBar = ({ open, onClose, onExecute }: CommandBarProps) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    if (!open) setInput('');
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-50"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        >
          <div className="bg-black border-t border-neutral-800">
            <div className="flex items-center px-4 py-3 gap-3">
              <span
                className="text-red-500 font-mono tracking-wider"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                M-x
              </span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter command..."
                className="flex-1 bg-transparent font-mono text-white placeholder:text-neutral-600 outline-none"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onClose();
                  if (e.key === 'Enter') {
                    onExecute?.(input);
                    onClose();
                  }
                }}
              />
              <Kbd>ESC</Kbd>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
