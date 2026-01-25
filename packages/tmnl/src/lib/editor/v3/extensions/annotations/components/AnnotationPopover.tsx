/**
 * AnnotationPopover Component
 *
 * Rich popover for displaying annotation content.
 * Uses safePolygon pattern for hover interactions - creates a triangular
 * safe zone from cursor to popover, allowing mouse traversal without closing.
 *
 * Features:
 * - safePolygon for reliable hover-to-popover navigation
 * - Adapts to intent type (hyperlink, citation, note, etc.)
 * - Supports pinning (click to keep open) via hover state atom sidecar
 * - Themed for TMNL design system
 *
 * @module editor/v3/extensions/annotations/components/AnnotationPopover
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import {
  Root as PopoverRoot,
  Content as PopoverContent,
  Portal as PopoverPortal,
  Arrow as PopoverArrow,
  Anchor as PopoverAnchor,
} from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'motion/react';
import {
  ExternalLink,
  Link2,
  MessageSquare,
  Quote,
  FileText,
  Zap,
  Pin,
  PinOff,
  X,
} from 'lucide-react';

import {
  annotationRegistry,
  activePopoverAtom,
  popoverContentAtom,
  isPopoverOpenAtom,
  popoverOps,
  popoverHoverStateAtom,
  type AnchorRect,
} from '../atoms';
import type { PopoverContent as PopoverContentType } from '../services';

// =============================================================================
// Types
// =============================================================================

export interface AnnotationPopoverProps {
  /** Container element for portal (defaults to document.body) */
  container?: HTMLElement;

  /** Additional class names */
  className?: string;

  /** Whether to show pin button */
  showPin?: boolean;

  /** Whether to show close button */
  showClose?: boolean;

  /** Custom content renderer */
  renderContent?: (content: PopoverContentType) => React.ReactNode;

  /** Callback when popover opens */
  onOpen?: () => void;

  /** Callback when popover closes */
  onClose?: () => void;
}

// =============================================================================
// Intent Icons
// =============================================================================

const IntentIcons: Record<string, React.ReactNode> = {
  Hyperlink: <ExternalLink className="h-4 w-4" />,
  Ultralink: <Link2 className="h-4 w-4" />,
  Popover: <MessageSquare className="h-4 w-4" />,
  Action: <Zap className="h-4 w-4" />,
  Citation: <Quote className="h-4 w-4" />,
  Note: <FileText className="h-4 w-4" />,
};

// =============================================================================
// Safe Polygon Utilities
// =============================================================================

type Point = [number, number];
type Polygon = Point[];

/**
 * Ray casting algorithm to determine if a point is inside a polygon.
 * Casts a horizontal ray from the point and counts edge intersections.
 */
function isPointInPolygon(point: Point, polygon: Polygon): boolean {
  const [x, y] = point;
  let isInside = false;
  const length = polygon.length;

  for (let i = 0, j = length - 1; i < length; j = i++) {
    const [xi, yi] = polygon[i] || [0, 0];
    const [xj, yj] = polygon[j] || [0, 0];
    const intersect =
      yi >= y !== yj >= y && x <= ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      isInside = !isInside;
    }
  }

  return isInside;
}

/**
 * Creates a safe polygon zone between the anchor (trigger) and popover.
 * The polygon is a triangle from current cursor position to the popover corners,
 * plus a rectangular buffer zone between anchor and popover.
 */
function getSafePolygon(
  cursorX: number,
  cursorY: number,
  anchorRect: AnchorRect,
  popoverRect: DOMRect,
  side: 'top' | 'bottom' | 'left' | 'right',
  buffer: number = 2
): Polygon {
  const anchor = {
    left: anchorRect.x,
    top: anchorRect.y,
    right: anchorRect.x + anchorRect.width,
    bottom: anchorRect.y + anchorRect.height,
    width: anchorRect.width,
    height: anchorRect.height,
  };

  const floating = {
    left: popoverRect.left,
    top: popoverRect.top,
    right: popoverRect.right,
    bottom: popoverRect.bottom,
    width: popoverRect.width,
    height: popoverRect.height,
  };

  // Create rectangular "trough" between anchor and floating
  // If cursor is in this zone, popover stays open
  const rectPoly: Polygon = [];

  switch (side) {
    case 'top':
      rectPoly.push(
        [anchor.left, anchor.top],
        [anchor.right, anchor.top],
        [floating.right + buffer, floating.bottom],
        [floating.left - buffer, floating.bottom]
      );
      break;
    case 'bottom':
      rectPoly.push(
        [anchor.left, anchor.bottom],
        [anchor.right, anchor.bottom],
        [floating.right + buffer, floating.top],
        [floating.left - buffer, floating.top]
      );
      break;
    case 'left':
      rectPoly.push(
        [anchor.left, anchor.top],
        [anchor.left, anchor.bottom],
        [floating.right, floating.bottom + buffer],
        [floating.right, floating.top - buffer]
      );
      break;
    case 'right':
      rectPoly.push(
        [anchor.right, anchor.top],
        [anchor.right, anchor.bottom],
        [floating.left, floating.bottom + buffer],
        [floating.left, floating.top - buffer]
      );
      break;
  }

  // Create triangle from cursor to floating element corners
  const trianglePoly: Polygon = [[cursorX, cursorY]];

  switch (side) {
    case 'top':
      trianglePoly.push(
        [floating.left - buffer, floating.bottom + buffer],
        [floating.right + buffer, floating.bottom + buffer]
      );
      break;
    case 'bottom':
      trianglePoly.push(
        [floating.left - buffer, floating.top - buffer],
        [floating.right + buffer, floating.top - buffer]
      );
      break;
    case 'left':
      trianglePoly.push(
        [floating.right + buffer, floating.top - buffer],
        [floating.right + buffer, floating.bottom + buffer]
      );
      break;
    case 'right':
      trianglePoly.push(
        [floating.left - buffer, floating.top - buffer],
        [floating.left - buffer, floating.bottom + buffer]
      );
      break;
  }

  return [...rectPoly, ...trianglePoly];
}

/**
 * Check if cursor is in the safe zone (either rect trough or triangle)
 */
function isInSafeZone(
  cursorX: number,
  cursorY: number,
  anchorRect: AnchorRect,
  popoverRect: DOMRect,
  side: 'top' | 'bottom' | 'left' | 'right',
  buffer: number = 8
): boolean {
  const anchor = {
    left: anchorRect.x - buffer,
    top: anchorRect.y - buffer,
    right: anchorRect.x + anchorRect.width + buffer,
    bottom: anchorRect.y + anchorRect.height + buffer,
  };

  const floating = {
    left: popoverRect.left - buffer,
    top: popoverRect.top - buffer,
    right: popoverRect.right + buffer,
    bottom: popoverRect.bottom + buffer,
  };

  // Check if cursor is directly over anchor or floating
  const inAnchor =
    cursorX >= anchor.left &&
    cursorX <= anchor.right &&
    cursorY >= anchor.top &&
    cursorY <= anchor.bottom;

  const inFloating =
    cursorX >= floating.left &&
    cursorX <= floating.right &&
    cursorY >= floating.top &&
    cursorY <= floating.bottom;

  if (inAnchor || inFloating) {
    return true;
  }

  // Check if in safe polygon
  const polygon = getSafePolygon(cursorX, cursorY, anchorRect, popoverRect, side, buffer);
  return isPointInPolygon([cursorX, cursorY], polygon);
}

// =============================================================================
// Constants
// =============================================================================

const SAFE_ZONE_BUFFER = 12; // Extra padding around elements for safe zone
const CLOSE_DELAY_MS = 100; // Delay before closing after leaving safe zone

// =============================================================================
// Component
// =============================================================================

export function AnnotationPopover({
  container,
  className = '',
  showPin = true,
  showClose = true,
  renderContent,
  onOpen,
  onClose,
}: AnnotationPopoverProps) {
  const isOpen = useAtomValue(isPopoverOpenAtom);
  const activePopover = useAtomValue(activePopoverAtom);
  const content = useAtomValue(popoverContentAtom);

  const prevOpenRef = useRef(isOpen);
  const popoverContentRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safe polygon mouse tracking
  useEffect(() => {
    // Skip if not hover-triggered or pinned
    if (!activePopover || activePopover.isPinned || activePopover.trigger !== 'hover') {
      return;
    }

    if (!isOpen || !activePopover.anchorRect) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const popoverEl = popoverContentRef.current;
      if (!popoverEl || !activePopover.anchorRect) return;

      const popoverRect = popoverEl.getBoundingClientRect();
      const placement = activePopover.placement ?? 'top';
      const side = placement.split('-')[0] as 'top' | 'bottom' | 'left' | 'right';

      const inSafeZone = isInSafeZone(
        e.clientX,
        e.clientY,
        activePopover.anchorRect,
        popoverRect,
        side,
        SAFE_ZONE_BUFFER
      );

      if (inSafeZone) {
        // Cancel any pending close
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = null;
        }
      } else {
        // Schedule close if not already scheduled
        if (!closeTimeoutRef.current) {
          closeTimeoutRef.current = setTimeout(() => {
            popoverOps.hide();
            closeTimeoutRef.current = null;
          }, CLOSE_DELAY_MS);
        }
      }
    };

    // Small delay before attaching listener to avoid immediate close
    const attachTimeout = setTimeout(() => {
      document.addEventListener('mousemove', handleMouseMove);
    }, 50);

    return () => {
      clearTimeout(attachTimeout);
      document.removeEventListener('mousemove', handleMouseMove);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [isOpen, activePopover]);

  // Handle open/close callbacks
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      onOpen?.();
    } else if (!isOpen && prevOpenRef.current) {
      onClose?.();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, onOpen, onClose]);

  // Reset hover state atom when popover closes (sidecar cleanup)
  useEffect(() => {
    if (!isOpen) {
      annotationRegistry.set(popoverHoverStateAtom, { trigger: false, popover: false });
    }
  }, [isOpen]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    annotationRegistry.set(popoverHoverStateAtom, { trigger: false, popover: false });
    popoverOps.hide();
  }, []);

  const handlePin = useCallback(() => {
    // Update hover state atom sidecar for programmatic control
    if (activePopover?.isPinned) {
      popoverOps.unpin();
    } else {
      popoverOps.pin();
      // Clear any pending close when pinning
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    }
  }, [activePopover?.isPinned]);

  const handleAction = useCallback(() => {
    if (content?.onAction) {
      content.onAction();
    }
    // Close popover after action unless pinned
    if (!activePopover?.isPinned) {
      handleClose();
    }
  }, [content, activePopover?.isPinned, handleClose]);

  // Get icon based on intent type
  const getIcon = () => {
    if (content?.icon) return content.icon;
    if (content?.mark?.intentType) {
      return IntentIcons[content.mark.intentType] ?? <MessageSquare className="h-4 w-4" />;
    }
    return <MessageSquare className="h-4 w-4" />;
  };

  // Map placement to Radix side/align
  const getSideAlign = () => {
    const placement = activePopover?.placement ?? 'top';
    const [side, align] = placement.split('-') as [
      'top' | 'bottom' | 'left' | 'right',
      'start' | 'center' | 'end' | undefined
    ];
    return { side, align: align ?? 'center' };
  };

  const { side, align } = getSideAlign();

  // Custom content renderer or default
  const renderPopoverContent = () => {
    if (!content) return null;

    if (renderContent) {
      return renderContent(content);
    }

    return (
      <>
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium text-sm">
            <span className="text-tmnl-accent-primary">{getIcon()}</span>
            {content.href ? (
              <a
                className="inline-flex items-center gap-1 hover:underline text-tmnl-text-primary"
                href={content.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span>{content.title}</span>
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            ) : (
              <span className="text-tmnl-text-primary">{content.title}</span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            {showPin && (
              <button
                className="p-1 rounded border border-tmnl-border bg-tmnl-surface-0 hover:bg-tmnl-surface-2 hover:border-tmnl-border-hover transition-colors"
                onClick={handlePin}
                title={activePopover?.isPinned ? 'Unpin' : 'Pin'}
                type="button"
              >
                {activePopover?.isPinned ? (
                  <PinOff className="h-3.5 w-3.5 text-tmnl-accent-primary" />
                ) : (
                  <Pin className="h-3.5 w-3.5 text-tmnl-text-muted" />
                )}
              </button>
            )}
            {showClose && (
              <button
                className="p-1 rounded border border-tmnl-border bg-tmnl-surface-0 hover:bg-tmnl-surface-2 hover:border-tmnl-border-hover transition-colors"
                onClick={handleClose}
                title="Close"
                type="button"
              >
                <X className="h-3.5 w-3.5 text-tmnl-text-muted" />
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        {content.description && (
          <p className="mt-2 text-sm text-tmnl-text-secondary leading-relaxed max-w-xs">
            {content.description}
          </p>
        )}

        {/* Footer with meta and action */}
        {(content.meta || content.actionLabel) && (
          <div className="mt-3 flex items-center justify-between gap-3">
            {content.meta ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-tmnl-surface-2 px-2 py-0.5 text-xs text-tmnl-text-muted">
                {content.meta}
              </span>
            ) : (
              <span />
            )}
            {content.actionLabel && (
              <button
                className="inline-flex items-center gap-1.5 rounded-full bg-tmnl-accent-primary px-3 py-1.5 text-xs font-medium text-tmnl-surface-0 transition-colors hover:bg-tmnl-accent-primary/90"
                onClick={handleAction}
                type="button"
              >
                {content.actionLabel}
              </button>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <PopoverRoot open={isOpen}>
      {/* Virtual anchor - positioned dynamically from anchorRect */}
      <PopoverAnchor asChild>
        <div
          className="annotation-popover-anchor"
          style={{
            position: 'fixed',
            top: activePopover?.anchorRect?.y ?? 0,
            left: activePopover?.anchorRect?.x ?? 0,
            width: activePopover?.anchorRect?.width ?? 0,
            height: activePopover?.anchorRect?.height ?? 0,
            pointerEvents: 'none',
          }}
        />
      </PopoverAnchor>

      <AnimatePresence>
        {isOpen && (
          <PopoverPortal container={container} forceMount>
            <PopoverContent
              align={align as 'start' | 'center' | 'end'}
              asChild
              className={`z-[9999] ${className}`}
              onEscapeKeyDown={handleClose}
              onInteractOutside={(e) => {
                // Don't close if pinned
                if (activePopover?.isPinned) {
                  e.preventDefault();
                  return;
                }
                // Don't close if clicking on another annotation
                const target = e.target as HTMLElement;
                if (target.closest('[data-annotation-id]')) {
                  e.preventDefault();
                  return;
                }
              }}
              onPointerDownOutside={(e) => {
                if (activePopover?.isPinned) {
                  e.preventDefault();
                }
              }}
              side={side}
              sideOffset={8}
            >
              <motion.div
                key="annotation-popover"
                ref={popoverContentRef}
                animate={{
                  opacity: 1,
                  filter: 'blur(0px)',
                }}
                className="annotation-popover-content relative rounded-lg border border-tmnl-border bg-tmnl-surface-1 px-4 py-3 shadow-xl backdrop-blur-sm"
                exit={{
                  opacity: 0,
                  filter: 'blur(4px)',
                }}
                initial={{
                  opacity: 0,
                  filter: 'blur(4px)',
                }}
                transition={{
                  type: 'tween',
                  ease: 'easeOut',
                  duration: 0.15,
                }}
              >
                {renderPopoverContent()}
                <PopoverArrow
                  className="fill-tmnl-surface-1"
                  style={{
                    filter: 'drop-shadow(0 -1px 0 var(--tmnl-border, #2a2a3e))',
                  }}
                />
              </motion.div>
            </PopoverContent>
          </PopoverPortal>
        )}
      </AnimatePresence>
    </PopoverRoot>
  );
}

export default AnnotationPopover;
