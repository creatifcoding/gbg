/**
 * AnnotationPopover Component
 *
 * Rich popover for displaying annotation content.
 * Wraps smooth-ui RichTooltip with annotation-specific styling and behavior.
 *
 * Features:
 * - Adapts to intent type (hyperlink, citation, note, etc.)
 * - Subscribes to popover atoms for reactive state
 * - Supports pinning (click to keep open)
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
  activePopoverAtom,
  popoverContentAtom,
  isPopoverOpenAtom,
  popoverOps,
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

  // Handle open/close callbacks
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      onOpen?.();
    } else if (!isOpen && prevOpenRef.current) {
      onClose?.();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, onOpen, onClose]);

  const handleClose = useCallback(() => {
    popoverOps.hide();
  }, []);

  const handlePin = useCallback(() => {
    if (activePopover?.isPinned) {
      popoverOps.unpin();
    } else {
      popoverOps.pin();
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
                className="p-1 rounded hover:bg-tmnl-surface-2 transition-colors"
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
                className="p-1 rounded hover:bg-tmnl-surface-2 transition-colors"
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
      {/* Virtual anchor - positioned via CSS or anchor element */}
      <PopoverAnchor asChild>
        <div
          className="annotation-popover-anchor"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
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
                // Don't close if pinned or clicking on mark
                if (activePopover?.isPinned) {
                  e.preventDefault();
                  return;
                }
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
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  filter: 'blur(0px)',
                }}
                className="relative rounded-lg border border-tmnl-border bg-tmnl-surface-1 px-4 py-3 shadow-xl backdrop-blur-sm"
                exit={{
                  opacity: 0,
                  scale: 0.95,
                  y: 5,
                  filter: 'blur(4px)',
                }}
                initial={{
                  opacity: 0,
                  scale: 0.95,
                  y: 5,
                  filter: 'blur(4px)',
                }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                  duration: 0.15,
                }}
              >
                {renderPopoverContent()}
                <PopoverArrow className="fill-tmnl-surface-1" />
              </motion.div>
            </PopoverContent>
          </PopoverPortal>
        )}
      </AnimatePresence>
    </PopoverRoot>
  );
}

export default AnnotationPopover;
