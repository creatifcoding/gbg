/**
 * IntentMarkView
 *
 * React component rendered via TipTap's MarkView system.
 * Handles hover/click events to trigger the AnnotationPopover.
 *
 * @module editor/v3/extensions/annotations/components/IntentMarkView
 */

import { useCallback, useRef, useMemo } from 'react';
import { posToDOMRect, type Editor } from '@tiptap/core';
import { MarkViewContent, type MarkViewRendererProps } from '@tiptap/react';

import {
  annotationRegistry,
  activePopoverAtom,
  hoveredAnnotationIdAtom,
  popoverHoverStateAtom,
} from '../atoms';
import { popoverControllerOps } from '../popover-stx';
import type { AnnotationId, IntentPayload } from '../schemas';
import {
  generateVisualStyleCSSProperties,
  parseVisualStyle,
  DEFAULT_VISUAL_STYLE,
} from '../visual-style-generator';

// =============================================================================
// Intent Parser
// =============================================================================

/**
 * Safely parse intent JSON from data attribute
 */
function parseIntent(json: string | undefined | null): IntentPayload | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed._tag === 'string') {
      return parsed as IntentPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely parse tags JSON from data attribute
 */
function parseTags(json: string | undefined | null): readonly string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface AnchorRange {
  from: number;
  to: number;
}

function findAnnotationRange(editor: Editor, annotationId: AnnotationId): AnchorRange | null {
  let minFrom: number | null = null;
  let maxTo: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;

    const hasAnnotation = node.marks.some(
      (mark) => mark.type.name === 'intentMark' && mark.attrs.id === annotationId
    );

    if (!hasAnnotation) return;

    const from = pos;
    const to = pos + node.nodeSize;

    minFrom = minFrom === null ? from : Math.min(minFrom, from);
    maxTo = maxTo === null ? to : Math.max(maxTo, to);
  });

  if (minFrom === null || maxTo === null) {
    return null;
  }

  return { from: minFrom, to: maxTo };
}

function toUnionRect(rects: readonly DOMRect[]): DOMRect | null {
  if (rects.length === 0) return null;

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const rect of rects) {
    if (rect.width <= 0 && rect.height <= 0) {
      continue;
    }

    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }

  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return null;
  }

  return new DOMRect(left, top, Math.max(right - left, 1), Math.max(bottom - top, 1));
}

function resolveAnnotationAnchorRect(
  editor: Editor | null,
  annotationId: AnnotationId,
  fallbackElement: HTMLElement | null
): DOMRect {
  if (editor) {
    const range = findAnnotationRange(editor, annotationId);
    if (range) {
      return posToDOMRect(editor.view, range.from, Math.max(range.from + 1, range.to));
    }
  }

  if (typeof document !== 'undefined') {
    const escapedId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(annotationId)
      : annotationId;

    const markEls = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-annotation-id="${escapedId}"]`)
    );

    const rects = markEls.flatMap((el) => Array.from(el.getClientRects()));
    const unionRect = toUnionRect(rects);
    if (unionRect) {
      return unionRect;
    }
  }

  return fallbackElement?.getBoundingClientRect() ?? new DOMRect(0, 0, 1, 1);
}

// =============================================================================
// Types
// =============================================================================

/**
 * HTML attributes as they appear on the DOM element.
 * The extension maps `id` → `data-annotation-id`, etc.
 * HTMLAttributes uses the HTML names, not extension names.
 */
interface IntentMarkHTMLAttributes {
  'data-annotation-id'?: string | null;
  'data-visual-style'?: string;
  'data-intent'?: string | null;
  'data-tags'?: string;
  'data-created-at'?: string | null;
  'data-created-by'?: string;
  'data-references'?: string | null;
  class?: string;
  style?: string;
}

// =============================================================================
// Hover Debounce Config
// =============================================================================

const HOVER_DELAY_MS = 150; // Delay before showing popover on hover
// Note: We don't close on mouse leave - safePolygon in AnnotationPopover handles that

// =============================================================================
// Component
// =============================================================================

export function IntentMarkView(props: MarkViewRendererProps) {
  const { HTMLAttributes } = props;
  const attrs = HTMLAttributes as unknown as IntentMarkHTMLAttributes;
  const markAttrs = (props.mark?.attrs ?? {}) as Record<string, unknown>;

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  const rawAnnotationId =
    (typeof markAttrs.id === 'string' ? markAttrs.id : null) ??
    attrs['data-annotation-id'] ??
    null;

  const rawIntent =
    typeof markAttrs.intent === 'string' ? markAttrs.intent : attrs['data-intent'];

  const rawVisualStyle =
    typeof markAttrs.visualStyle === 'string' ||
    (markAttrs.visualStyle !== null && typeof markAttrs.visualStyle === 'object')
      ? markAttrs.visualStyle
      : attrs['data-visual-style'];

  const rawTags =
    typeof markAttrs.tags === 'string' ? markAttrs.tags : attrs['data-tags'];

  const annotationId = rawAnnotationId as AnnotationId | null;

  // Parse intent and tags from mark attrs (fallback to HTML attributes) - memoized for stability
  const intentData = useMemo(() => {
    const intent = parseIntent(rawIntent);
    if (!intent) return undefined;

    const visualStyle = parseVisualStyle(rawVisualStyle);
    const tags = parseTags(rawTags);

    return {
      intentType: intent._tag,
      intent,
      visualType: visualStyle?.type,
      tags,
    };
  }, [rawIntent, rawVisualStyle, rawTags]);

  // Handle mouse enter - show popover after delay
  const handleMouseEnter = useCallback(() => {
    if (!annotationId) {
      if (import.meta.env.DEV) {
        console.warn('[IntentMarkView] Missing annotationId on mouse enter', {
          rawAnnotationId,
          rawIntent,
        });
      }
      return;
    }

    // Set hover state immediately for CSS effects
    annotationRegistry.set(hoveredAnnotationIdAtom, annotationId);
    const hoverState = annotationRegistry.get(popoverHoverStateAtom);
    annotationRegistry.set(popoverHoverStateAtom, {
      trigger: true,
      popover: hoverState.popover,
    });

    // Delay popover show for better UX
    hoverTimeoutRef.current = setTimeout(() => {
      const element = spanRef.current;
      if (!element) return;

      if (import.meta.env.DEV) {
        console.debug('[PopoverDebug][mark] hover dispatch', {
          annotationId,
          intentType: intentData?.intentType,
        });
      }

      popoverControllerOps.openHover({
        annotationId,
        markId: annotationId,
        anchor: {
          _tag: 'virtual',
          getBoundingClientRect: () =>
            resolveAnnotationAnchorRect(props.editor ?? null, annotationId, element),
        },
        placement: 'top',
        trigger: 'hover',
        intentType: intentData?.intentType,
        intentData,
      });
    }, HOVER_DELAY_MS);
  }, [annotationId, intentData, props.editor, rawAnnotationId, rawIntent]);

  // Handle mouse leave - just cancel pending open, safePolygon handles closing
  const handleMouseLeave = useCallback(() => {
    // Clear any pending hover timeout (if we leave before popover opens)
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Clear CSS hover state
    annotationRegistry.set(hoveredAnnotationIdAtom, null);
    const hoverState = annotationRegistry.get(popoverHoverStateAtom);
    annotationRegistry.set(popoverHoverStateAtom, {
      trigger: false,
      popover: hoverState.popover,
    });

    // Note: We do NOT close the popover here directly.
    // safePolygon in AnnotationPopover handles closing via document mousemove
    // This allows user to move cursor from trigger to popover without closing
  }, []);

  // Handle click - toggle popover (pinned mode)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!annotationId || !spanRef.current) {
        if (import.meta.env.DEV) {
          console.warn('[IntentMarkView] Click ignored: missing annotationId or spanRef', {
            annotationId,
            hasSpan: !!spanRef.current,
          });
        }
        return;
      }

      // Prevent editor from handling click
      e.stopPropagation();

      // Check if this popover is already open - toggle it
      const current = annotationRegistry.get(activePopoverAtom);
      if (current?.annotationId === annotationId) {
        popoverControllerOps.close('manual');
        return;
      }

      const element = spanRef.current;

      if (import.meta.env.DEV) {
        console.debug('[PopoverDebug][mark] click dispatch', {
          annotationId,
          intentType: intentData?.intentType,
        });
      }

      popoverControllerOps.openClick({
        annotationId,
        markId: annotationId,
        anchor: {
          _tag: 'virtual',
          getBoundingClientRect: () =>
            resolveAnnotationAnchorRect(props.editor ?? null, annotationId, element),
        },
        placement: 'top',
        trigger: 'click',
        intentType: intentData?.intentType,
        intentData,
      });
    },
    [annotationId, intentData, props.editor]
  );

  // Parse visual style for rendering - use centralized parser
  const visualStyle = parseVisualStyle(rawVisualStyle) ?? DEFAULT_VISUAL_STYLE;

  // Build class names
  const classNames = ['intent-mark', `intent-mark--${visualStyle.type}`];
  if (visualStyle.effect && visualStyle.effect !== 'none') {
    classNames.push(`intent-mark--effect-${visualStyle.effect}`);
  }
  if (visualStyle.animated) {
    classNames.push('intent-mark--animated');
  }

  // Get visual styles from centralized generator
  const visualStyles = generateVisualStyleCSSProperties(visualStyle);

  return (
    <span
      ref={spanRef}
      className={classNames.join(' ')}
      data-annotation-id={annotationId}
      data-visual-style={
        typeof rawVisualStyle === 'string' ? rawVisualStyle : JSON.stringify(visualStyle)
      }
      data-intent={rawIntent}
      data-tags={rawTags}
      data-created-at={attrs['data-created-at']}
      data-created-by={attrs['data-created-by']}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        ...visualStyles,
      }}
    >
      <MarkViewContent />
    </span>
  );
}

export default IntentMarkView;
