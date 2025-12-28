/**
 * FocusOverlay Component
 *
 * Full-viewport overlay for focused embedded blocks.
 * Portals to document.body with high z-index.
 * Backdrop click or Escape to exit focus mode.
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper
 */

import {
  useEffect,
  useCallback,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue } from '@effect-atom/atom-react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

import {
  VANTA_COLORS,
  VANTA_BORDERS,
  VANTA_SPACING,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';

import { focusedBlockIdAtom, isFocusModeAtom, focusActions } from './atoms';

// =============================================================================
// Styles
// =============================================================================

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: VANTA_SPACING['8'],
};

const backdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundColor: VANTA_COLORS.surface.void,
  opacity: 0.95,
};

const contentContainerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  maxWidth: '1400px',
  maxHeight: '900px',
  backgroundColor: VANTA_COLORS.surface.default,
  borderRadius: VANTA_BORDERS.radius.lg,
  border: `1px solid ${VANTA_COLORS.surface.border}`,
  overflow: 'hidden',
  boxShadow: `0 0 80px ${VANTA_COLORS.accent.cyanGlow}`,
  animation: 'focusOverlayEnter 200ms ease-out',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['4']}`,
  backgroundColor: VANTA_COLORS.surface.elevated,
  borderBottom: `1px solid ${VANTA_COLORS.surface.border}`,
};

const titleStyle: CSSProperties = {
  color: VANTA_COLORS.text.secondary,
  fontSize: '12px',
  fontFamily: 'var(--tmnl-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'flex',
  alignItems: 'center',
  gap: VANTA_SPACING['2'],
};

const closeButtonStyle: CSSProperties = {
  padding: VANTA_SPACING['1'],
  background: 'transparent',
  border: 'none',
  color: VANTA_COLORS.text.muted,
  cursor: 'pointer',
  borderRadius: VANTA_BORDERS.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: VANTA_ANIMATION.transition.colors,
};

const bodyStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  height: 'calc(100% - 40px)', // Account for header
};

// =============================================================================
// CSS Keyframes (injected once)
// =============================================================================

const KEYFRAMES_ID = 'focus-overlay-keyframes';

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;

  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes focusOverlayEnter {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes focusBackdropEnter {
      from { opacity: 0; }
      to { opacity: 0.95; }
    }
  `;
  document.head.appendChild(style);
}

// =============================================================================
// Component Props
// =============================================================================

export interface FocusOverlayProps {
  /**
   * The focused block's content.
   * Rendered inside the overlay container.
   */
  children: ReactNode;

  /**
   * Title to display in the overlay header.
   */
  title?: string;

  /**
   * Icon to display next to the title.
   */
  icon?: React.ComponentType<{ size?: number; className?: string }>;

  /**
   * Callback when exiting focus mode.
   * Called before focusActions.exitFocus().
   */
  onExit?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function FocusOverlay({
  children,
  title = 'Focus Mode',
  icon: Icon,
  onExit,
}: FocusOverlayProps) {
  const isFocusMode = useAtomValue(isFocusModeAtom);
  const focusedBlockId = useAtomValue(focusedBlockIdAtom);

  // Inject keyframes on mount
  useEffect(() => {
    injectKeyframes();
  }, []);

  // Handle exit
  const handleExit = useCallback(() => {
    onExit?.();
    focusActions.exitFocus();
  }, [onExit]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleExit();
      }
    },
    [handleExit]
  );

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        e.preventDefault();
        e.stopPropagation();
        handleExit();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isFocusMode, handleExit]);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (isFocusMode) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFocusMode]);

  // Don't render if not in focus mode
  if (!isFocusMode) {
    return null;
  }

  const overlay = (
    <div
      style={overlayStyle}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-overlay-title"
    >
      {/* Backdrop */}
      <div
        style={{
          ...backdropStyle,
          animation: 'focusBackdropEnter 200ms ease-out',
        }}
      />

      {/* Content container */}
      <div style={contentContainerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <span id="focus-overlay-title" style={titleStyle}>
            <Maximize2 size={14} />
            {Icon && <Icon size={14} />}
            {title}
            {focusedBlockId && (
              <span style={{ color: VANTA_COLORS.text.muted }}>
                — {focusedBlockId}
              </span>
            )}
          </span>

          <button
            onClick={handleExit}
            style={closeButtonStyle}
            title="Exit focus mode (Esc)"
            onMouseOver={(e) => {
              e.currentTarget.style.color = VANTA_COLORS.accent.rose;
              e.currentTarget.style.backgroundColor = VANTA_COLORS.accent.roseGlow;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = VANTA_COLORS.text.muted;
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={bodyStyle}>{children}</div>
      </div>
    </div>
  );

  // Portal to document.body
  return createPortal(overlay, document.body);
}

// =============================================================================
// Hook: useFocusOverlay
// =============================================================================

export interface UseFocusOverlayReturn {
  /**
   * Whether focus mode is active.
   */
  isFocusMode: boolean;

  /**
   * Currently focused block ID.
   */
  focusedBlockId: string | null;

  /**
   * Enter focus mode for a block.
   */
  enterFocus: (blockId: string) => void;

  /**
   * Exit focus mode.
   */
  exitFocus: () => void;

  /**
   * Toggle focus mode for a block.
   */
  toggleFocus: (blockId: string) => void;

  /**
   * Check if a specific block is focused.
   */
  isFocused: (blockId: string) => boolean;
}

export function useFocusOverlay(): UseFocusOverlayReturn {
  const isFocusMode = useAtomValue(isFocusModeAtom);
  const focusedBlockId = useAtomValue(focusedBlockIdAtom);

  return {
    isFocusMode,
    focusedBlockId,
    enterFocus: focusActions.enterFocus,
    exitFocus: focusActions.exitFocus,
    toggleFocus: focusActions.toggleFocus,
    isFocused: focusActions.isFocused,
  };
}

export default FocusOverlay;
