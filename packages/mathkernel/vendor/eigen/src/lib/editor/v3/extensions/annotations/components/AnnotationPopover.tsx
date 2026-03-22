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

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { useSelector as useActorSelector } from '@xstate/react';
import type { Editor } from '@tiptap/core';
import {
  Root as PopoverRoot,
  Content as PopoverContent,
  Portal as PopoverPortal,
  Arrow as PopoverArrow,
  Anchor as PopoverAnchor,
} from '@radix-ui/react-popover';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ExternalLink, Link2, MessageSquare, Quote, FileText, Zap } from 'lucide-react';

import {
  annotationRegistry,
  activePopoverAtom,
  popoverContentAtom,
  isPopoverOpenAtom,
  popoverHoverStateAtom,
  type AnchorRect,
} from '../atoms';
import { AnnotationPopoverContent } from './AnnotationPopoverContent';
import {
  getAnnotationPopoverControllerStx,
  popoverControllerOps,
} from '../popover-stx';
import type { AnnotationId } from '../schemas';
import type {
  PopoverContent as PopoverContentType,
  PopoverPlacement,
} from '../services';

// =============================================================================
// Types
// =============================================================================

export interface AnnotationPopoverProps {
  /** TipTap editor instance for note content read/write */
  editor?: Editor | null;

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
  const polygon = getSafePolygon(
    cursorX,
    cursorY,
    anchorRect,
    popoverRect,
    side,
    buffer
  );
  return isPointInPolygon([cursorX, cursorY], polygon);
}

// =============================================================================
// Note Helpers
// =============================================================================

const NOTE_TEXT_FIELDS = [
  'content',
  'noteText',
  'text',
  'body',
  'description',
] as const;

function parseIntentValue(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return null;
}

function readFirstTextField(intent: Record<string, unknown>): string | null {
  for (const field of NOTE_TEXT_FIELDS) {
    const value = intent[field];
    if (typeof value === 'string') {
      return value;
    }
  }

  return null;
}

function writeKnownTextFields(
  intent: Record<string, unknown>,
  value: string
): boolean {
  let wrote = false;

  for (const field of NOTE_TEXT_FIELDS) {
    if (typeof intent[field] === 'string') {
      intent[field] = value;
      wrote = true;
    }
  }

  return wrote;
}

function getIntentNodeId(intent: Record<string, unknown>): AnnotationId | null {
  const direct = intent.annotationId;
  if (typeof direct === 'string' && direct.length > 0) {
    return direct as AnnotationId;
  }

  const legacy = intent.targetNodeId;
  if (typeof legacy === 'string' && legacy.length > 0) {
    return legacy as AnnotationId;
  }

  return null;
}

function readNodeText(editor: Editor, nodeId: AnnotationId): string | null {
  let result: string | null = null;

  editor.state.doc.descendants((node) => {
    if (node.type.name === 'annotationNode' && node.attrs.id === nodeId) {
      result = node.textContent ?? '';
      return false;
    }

    return true;
  });

  return result;
}

function findNoteIntentForMark(
  editor: Editor,
  markId: AnnotationId
): { intent: Record<string, unknown>; nodeId: AnnotationId | null } | null {
  let found: {
    intent: Record<string, unknown>;
    nodeId: AnnotationId | null;
  } | null = null;

  editor.state.doc.descendants((node) => {
    if (found || !node.isText) {
      return !found;
    }

    for (const mark of node.marks) {
      if (mark.type.name !== 'intentMark' || mark.attrs.id !== markId) {
        continue;
      }

      const intent = parseIntentValue(mark.attrs.intent);
      if (!intent || intent._tag !== 'Note') {
        continue;
      }

      found = {
        intent,
        nodeId: getIntentNodeId(intent),
      };

      return false;
    }

    return true;
  });

  return found;
}

function resolveNoteText(editor: Editor, markId: AnnotationId): string {
  const note = findNoteIntentForMark(editor, markId);
  if (!note) return '';

  const inlineText = readFirstTextField(note.intent);
  if (inlineText !== null) {
    return inlineText;
  }

  if (note.nodeId) {
    const nodeText = readNodeText(editor, note.nodeId);
    if (nodeText !== null) {
      return nodeText;
    }
  }

  return '';
}

function persistNoteText(
  editor: Editor,
  markId: AnnotationId,
  value: string
): boolean {
  const note = findNoteIntentForMark(editor, markId);
  if (!note) return false;

  const nextIntent = { ...note.intent };
  const hasInlineField = writeKnownTextFields(nextIntent, value);

  let markUpdated = false;
  if (hasInlineField) {
    markUpdated = editor.commands.updateIntentMark(markId, {
      intent: nextIntent as never,
    });
  }

  let nodeUpdated = false;
  if (note.nodeId) {
    nodeUpdated = editor.commands.updateAnnotationNode(note.nodeId, {
      content: value,
    });
  }

  if (!hasInlineField && !note.nodeId) {
    markUpdated = editor.commands.updateIntentMark(markId, {
      intent: {
        ...nextIntent,
        content: value,
      } as never,
    });
  }

  return markUpdated || nodeUpdated;
}

// =============================================================================
// Constants
// =============================================================================

const SAFE_ZONE_BUFFER = 12; // Extra padding around elements for safe zone
const CLOSE_DELAY_MS = 100; // Delay before closing after leaving safe zone
const VIEWPORT_PADDING = 16;
const POPOVER_MIN_WIDTH = 280;
const POPOVER_MIN_HEIGHT = 180;

function getAdaptivePlacement(
  preferred: PopoverPlacement,
  anchorRect: AnchorRect | null
): PopoverPlacement {
  if (!anchorRect || typeof window === 'undefined') {
    return preferred;
  }

  const [baseSide, baseAlignRaw] = preferred.split('-') as [
    'top' | 'bottom' | 'left' | 'right',
    'start' | 'center' | 'end' | undefined
  ];

  const baseAlign = baseAlignRaw ?? 'center';

  const spaceTop = anchorRect.y - VIEWPORT_PADDING;
  const spaceBottom =
    window.innerHeight - (anchorRect.y + anchorRect.height) - VIEWPORT_PADDING;
  const spaceLeft = anchorRect.x - VIEWPORT_PADDING;
  const spaceRight =
    window.innerWidth - (anchorRect.x + anchorRect.width) - VIEWPORT_PADDING;

  let side = baseSide;

  if (
    baseSide === 'top' &&
    spaceTop < POPOVER_MIN_HEIGHT &&
    spaceBottom > spaceTop
  ) {
    side = 'bottom';
  } else if (
    baseSide === 'bottom' &&
    spaceBottom < POPOVER_MIN_HEIGHT &&
    spaceTop > spaceBottom
  ) {
    side = 'top';
  } else if (
    baseSide === 'left' &&
    spaceLeft < POPOVER_MIN_WIDTH &&
    spaceRight > spaceLeft
  ) {
    side = 'right';
  } else if (
    baseSide === 'right' &&
    spaceRight < POPOVER_MIN_WIDTH &&
    spaceLeft > spaceRight
  ) {
    side = 'left';
  }

  if (
    (side === 'left' || side === 'right') &&
    Math.max(spaceLeft, spaceRight) < POPOVER_MIN_WIDTH
  ) {
    side = spaceBottom >= spaceTop ? 'bottom' : 'top';
  }

  if (
    (side === 'top' || side === 'bottom') &&
    Math.max(spaceTop, spaceBottom) < POPOVER_MIN_HEIGHT
  ) {
    side = spaceRight >= spaceLeft ? 'right' : 'left';
  }

  return baseAlign === 'center'
    ? side
    : (`${side}-${baseAlign}` as PopoverPlacement);
}

// =============================================================================
// Component
// =============================================================================

export function AnnotationPopover({
  editor = null,
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
  const hoverState = useAtomValue(popoverHoverStateAtom);

  const prevOpenRef = useRef(isOpen);
  const popoverContentRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const popoverControllerState = useMemo(
    () => getAnnotationPopoverControllerStx(),
    []
  );
  const popoverSnapshot = useActorSelector(
    popoverControllerState.actor,
    (snapshot) => snapshot
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug('[PopoverDebug][react] render state', {
      isOpen,
      activePopover,
      machineValue: popoverSnapshot.value,
      machineContext: popoverSnapshot.context,
    });
  }, [isOpen, activePopover, popoverSnapshot]);

  const isEditingNote = popoverSnapshot.matches({ open: 'editing' });
  const isNoteIntent = popoverSnapshot.context.intentType === 'Note';
  const noteDraft = popoverSnapshot.context.noteDraft ?? '';
  const noteOriginal = popoverSnapshot.context.noteOriginal ?? '';
  const resolvedNoteText =
    noteDraft || noteOriginal || content?.description || '';

  const lastStableGeometryRef = useRef<{
    anchorRect: AnchorRect | null;
    placement: PopoverPlacement;
  } | null>(null);

  if (activePopover?.anchorRect) {
    lastStableGeometryRef.current = {
      anchorRect: activePopover.anchorRect,
      placement: activePopover.placement,
    };
  }

  const anchorRectForRender =
    activePopover?.anchorRect ??
    lastStableGeometryRef.current?.anchorRect ??
    null;

  const basePlacementForRender =
    activePopover?.placement ??
    lastStableGeometryRef.current?.placement ??
    'top';

  const adaptivePlacement = useMemo(
    () => getAdaptivePlacement(basePlacementForRender, anchorRectForRender),
    [basePlacementForRender, anchorRectForRender]
  );

  useEffect(() => {
    if (!import.meta.env.DEV || !isOpen) {
      return;
    }

    const popoverEl = popoverContentRef.current;
    const popoverRect = popoverEl?.getBoundingClientRect() ?? null;

    console.debug('[PopoverDebug][position]', {
      anchorRect: anchorRectForRender,
      basePlacement: basePlacementForRender,
      adaptivePlacement,
      popoverRect,
    });
  }, [
    isOpen,
    adaptivePlacement,
    anchorRectForRender?.x,
    anchorRectForRender?.y,
    anchorRectForRender?.width,
    anchorRectForRender?.height,
    basePlacementForRender,
  ]);

  // Deterministic hover close contract:
  // close when both trigger and popover hover are false (except while editing/pinned).
  useEffect(() => {
    if (
      !isOpen ||
      isEditingNote ||
      !activePopover ||
      activePopover.isPinned ||
      activePopover.trigger !== 'hover'
    ) {
      return;
    }

    if (hoverState.trigger || hoverState.popover) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      return;
    }

    if (!closeTimeoutRef.current) {
      closeTimeoutRef.current = setTimeout(() => {
        popoverControllerOps.close('manual');
        closeTimeoutRef.current = null;
      }, CLOSE_DELAY_MS);
    }

    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [
    isOpen,
    isEditingNote,
    activePopover?.trigger,
    activePopover?.isPinned,
    hoverState.trigger,
    hoverState.popover,
  ]);

  // Safe polygon mouse tracking (supplementary, improves traversal tolerance)
  useEffect(() => {
    // Skip if not hover-triggered, pinned, or currently editing.
    if (
      isEditingNote ||
      !activePopover ||
      activePopover.isPinned ||
      activePopover.trigger !== 'hover'
    ) {
      return;
    }

    if (!isOpen || !activePopover.anchorRect) {
      return;
    }

    const onMouseMove = (e: MouseEvent) => {
      const popoverEl = popoverContentRef.current;
      if (!popoverEl || !activePopover.anchorRect) return;

      const popoverRect = popoverEl.getBoundingClientRect();
      const side = adaptivePlacement.split('-')[0] as
        | 'top'
        | 'bottom'
        | 'left'
        | 'right';

      const inSafeZone = isInSafeZone(
        e.clientX,
        e.clientY,
        activePopover.anchorRect,
        popoverRect,
        side,
        SAFE_ZONE_BUFFER
      );

      if (inSafeZone) {
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = null;
        }
      } else if (!closeTimeoutRef.current) {
        closeTimeoutRef.current = setTimeout(() => {
          popoverControllerOps.close('manual');
          closeTimeoutRef.current = null;
        }, CLOSE_DELAY_MS);
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [isOpen, activePopover, isEditingNote, adaptivePlacement]);

  // Handle open/close callbacks
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      onOpen?.();
    } else if (!isOpen && prevOpenRef.current) {
      onClose?.();
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, onOpen, onClose]);

  // Sync note content into machine draft/original when opening a note popover.
  useEffect(() => {
    if (!editor || !isOpen || !isNoteIntent || !activePopover?.markId) {
      return;
    }

    const noteText = resolveNoteText(editor, activePopover.markId);
    popoverControllerOps.contentSynced(noteText);
  }, [editor, isOpen, isNoteIntent, activePopover?.markId]);

  // Keep anchor adaptive to scrolling/resizing/layout drift while open.
  // IMPORTANT: Reuse machine anchor to preserve element identity (no querySelector drift).
  useEffect(() => {
    if (!isOpen || !popoverSnapshot.context.anchor) {
      return;
    }

    const anchor = popoverSnapshot.context.anchor;
    let rafId: number | null = null;

    const scheduleAnchorSync = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        rafId = null;
        popoverControllerOps.updateAnchor(anchor);
      });
    };

    scheduleAnchorSync();

    window.addEventListener('scroll', scheduleAnchorSync, true);
    window.addEventListener('resize', scheduleAnchorSync);

    return () => {
      window.removeEventListener('scroll', scheduleAnchorSync, true);
      window.removeEventListener('resize', scheduleAnchorSync);

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isOpen, popoverSnapshot.context.anchor]);

  // Reset hover state atom when popover closes (sidecar cleanup)
  useEffect(() => {
    if (!isOpen) {
      annotationRegistry.set(popoverHoverStateAtom, {
        trigger: false,
        popover: false,
      });
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
    if (isEditingNote) {
      return;
    }

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    annotationRegistry.set(popoverHoverStateAtom, {
      trigger: false,
      popover: false,
    });
    popoverControllerOps.close('manual');
  }, [isEditingNote]);

  const handlePin = useCallback(() => {
    // Update hover state atom sidecar for programmatic control
    if (activePopover?.isPinned) {
      popoverControllerOps.unpin();
    } else {
      popoverControllerOps.pin();
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

  const handleStartEdit = useCallback(() => {
    popoverControllerOps.startEdit();
  }, []);

  const handleDraftChange = useCallback((value: string) => {
    popoverControllerOps.updateDraft(value);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editor || !activePopover?.markId) {
      popoverControllerOps.saveEdit();
      return;
    }

    persistNoteText(editor, activePopover.markId, noteDraft);
    popoverControllerOps.saveEdit();
  }, [editor, activePopover?.markId, noteDraft]);

  const handleCancelEdit = useCallback(() => {
    popoverControllerOps.cancelEdit();
  }, []);

  // Get icon based on intent type
  const getIcon = () => {
    if (content?.icon) return content.icon;
    if (content?.mark?.intentType) {
      return (
        IntentIcons[content.mark.intentType] ?? (
          <MessageSquare className="h-4 w-4" />
        )
      );
    }
    return <MessageSquare className="h-4 w-4" />;
  };

  // Map placement to Radix side/align
  const getSideAlign = () => {
    const [side, align] = adaptivePlacement.split('-') as [
      'top' | 'bottom' | 'left' | 'right',
      'start' | 'center' | 'end' | undefined
    ];
    return { side, align: align ?? 'center' };
  };

  const { side, align } = getSideAlign();

  // Custom content renderer or default compound composition
  const renderPopoverContent = () => {
    if (!content) return null;

    if (renderContent) {
      return renderContent(content);
    }

    return (
      <AnnotationPopoverContent.Root
        actions={{
          close: handleClose,
          pin: handlePin,
          action: handleAction,
          startEdit: handleStartEdit,
          saveEdit: handleSaveEdit,
          cancelEdit: handleCancelEdit,
          draftChange: handleDraftChange,
        }}
        meta={{
          icon: getIcon(),
          showPin,
          showClose,
        }}
        state={{
          content,
          isEditingNote,
          isNoteIntent,
          noteDraft,
          resolvedNoteText,
          isPinned: activePopover?.isPinned ?? false,
        }}
      >
        <AnnotationPopoverContent.Header />
        <AnnotationPopoverContent.Body />
      </AnnotationPopoverContent.Root>
    );
  };

  return (
    <PopoverRoot open={isOpen}>
      <AnimatePresence
        onExitComplete={() => {
          if (!isOpen) {
            lastStableGeometryRef.current = null;
          }
        }}
      >
        {isOpen && (
          <PopoverPortal container={container} forceMount>
            <>
              {/*
                Keep the virtual anchor in the same portal layer as content.
                This avoids transformed editor ancestors skewing fixed-coordinate anchors.
              */}
              <PopoverAnchor asChild>
                <div
                  className="annotation-popover-anchor"
                  style={{
                    position: 'fixed',
                    top: anchorRectForRender ? anchorRectForRender.y : -99999,
                    left: anchorRectForRender ? anchorRectForRender.x : -99999,
                    width: anchorRectForRender
                      ? Math.max(anchorRectForRender.width, 1)
                      : 1,
                    height: anchorRectForRender
                      ? Math.max(anchorRectForRender.height, 1)
                      : 1,
                    pointerEvents: 'none',
                    visibility: anchorRectForRender ? 'visible' : 'hidden',
                  }}
                />
              </PopoverAnchor>

              <PopoverContent
                align={align as 'start' | 'center' | 'end'}
                asChild
                avoidCollisions
                className={`z-[9999] ${className}`}
                collisionPadding={VIEWPORT_PADDING}
                onEscapeKeyDown={(e) => {
                  e.preventDefault();
                  popoverControllerOps.escape();
                }}
                onInteractOutside={(e) => {
                  // Never close while editing note content
                  if (isEditingNote) {
                    e.preventDefault();
                    return;
                  }

                  // Don't close if pinned
                  if (activePopover?.isPinned) {
                    e.preventDefault();
                    return;
                  }

                  // Don't close if clicking on another annotation (handoff to mark handlers)
                  const target = e.target as HTMLElement;
                  if (target.closest('[data-annotation-id]')) {
                    e.preventDefault();
                    return;
                  }

                  popoverControllerOps.outsideClick();
                }}
                onPointerDownOutside={(e) => {
                  if (isEditingNote || activePopover?.isPinned) {
                    e.preventDefault();
                  }
                }}
                side={side}
                sideOffset={8}
                sticky="always"
              >
                <motion.div
                  key="annotation-popover"
                  ref={popoverContentRef}
                  onPointerEnter={() => {
                    const nextTrigger = annotationRegistry.get(
                      popoverHoverStateAtom
                    ).trigger;
                    annotationRegistry.set(popoverHoverStateAtom, {
                      trigger: nextTrigger,
                      popover: true,
                    });
                  }}
                  onPointerLeave={() => {
                    const nextTrigger = annotationRegistry.get(
                      popoverHoverStateAtom
                    ).trigger;
                    annotationRegistry.set(popoverHoverStateAtom, {
                      trigger: nextTrigger,
                      popover: false,
                    });
                  }}
                  animate={
                    shouldReduceMotion
                      ? {
                          opacity: 1,
                        }
                      : {
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          filter: 'blur(0px)',
                        }
                  }
                  className="annotation-popover-content relative rounded-xl border border-tmnl-border bg-tmnl-surface-1 px-6 py-5 shadow-xl backdrop-blur-sm"
                  exit={
                    shouldReduceMotion
                      ? {
                          opacity: 0,
                        }
                      : {
                          opacity: 0,
                          y: -2,
                          scale: 0.98,
                          filter: 'blur(1px)',
                        }
                  }
                  initial={
                    shouldReduceMotion
                      ? {
                          opacity: 0,
                        }
                      : {
                          opacity: 0,
                          y: 4,
                          scale: 0.98,
                          filter: 'blur(2px)',
                        }
                  }
                  transition={
                    shouldReduceMotion
                      ? {
                          type: 'tween',
                          ease: 'easeOut',
                          duration: 0.1,
                        }
                      : {
                          type: 'tween',
                          ease: [0.22, 1, 0.36, 1],
                          duration: 0.18,
                        }
                  }
                  style={{
                    // width: 'clamp(420px, 42vw, 640px)',
                    // maxWidth: 'calc(100vw - 32px)',
                    willChange: 'transform, opacity, filter',
                  }}
                >
                  {renderPopoverContent()}
                  <PopoverArrow
                    className="fill-tmnl-surface-1"
                    style={{
                      filter:
                        'drop-shadow(0 -1px 0 var(--tmnl-border, #2a2a3e))',
                    }}
                  />
                </motion.div>
              </PopoverContent>
            </>
          </PopoverPortal>
        )}
      </AnimatePresence>
    </PopoverRoot>
  );
}

export default AnnotationPopover;
