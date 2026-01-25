/**
 * IntentMarkView
 *
 * React component rendered via TipTap's MarkView system.
 * Handles hover/click events to trigger the AnnotationPopover.
 *
 * @module editor/v3/extensions/annotations/components/IntentMarkView
 */

import { useCallback, useRef, useMemo } from 'react';
import { MarkViewContent, type MarkViewRendererProps } from '@tiptap/react';

import {
  annotationRegistry,
  activePopoverAtom,
  popoverContentAtom,
  hoveredAnnotationIdAtom,
} from '../atoms';
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

/**
 * Build popover content directly from intent data.
 * Used when marks aren't registered with AnnotationService.
 */
function buildPopoverContent(intentData: {
  intentType: string;
  intent: IntentPayload;
  visualType?: string;
  tags?: readonly string[];
}) {
  const { intentType, intent, tags } = intentData;

  const content: {
    title: string;
    description?: string;
    href?: string;
    actionLabel?: string;
    meta?: string;
  } = {
    title: intentType,
    meta: tags?.length ? tags.join(', ') : undefined,
  };

  switch (intent._tag) {
    case 'Hyperlink':
      content.title = intent.label ?? 'Link';
      content.href = intent.href;
      content.actionLabel = 'Open Link';
      break;
    case 'Ultralink':
      content.title = intent.metadata?.title ?? 'Ultralink';
      content.description = intent.metadata?.description ?? `→ ${intent.target}`;
      break;
    case 'Popover':
      content.title = 'Popover';
      content.description =
        typeof intent.content === 'string' ? intent.content : JSON.stringify(intent.content);
      break;
    case 'Action':
      content.title = intent.actionName ?? 'Action';
      content.actionLabel = 'Execute';
      break;
    case 'Citation':
      content.title = 'Citation';
      content.description = intent.source ?? undefined;
      break;
    case 'Note':
      content.title = intent.noteType === 'comment' ? 'Comment' : 'Note';
      content.description = `Note: ${intent.targetNodeId}`;
      break;
  }

  return content;
}

export function IntentMarkView(props: MarkViewRendererProps) {
  const { HTMLAttributes } = props;
  const attrs = HTMLAttributes as unknown as IntentMarkHTMLAttributes;

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  // Parse the annotation ID - use HTML attribute name (data-annotation-id)
  const annotationId = attrs['data-annotation-id'] as AnnotationId | null;

  // Parse intent and tags from data attributes - memoized for stability
  const intentData = useMemo(() => {
    const intent = parseIntent(attrs['data-intent']);
    if (!intent) return undefined;

    const visualStyle = parseVisualStyle(attrs['data-visual-style']);
    const tags = parseTags(attrs['data-tags']);

    return {
      intentType: intent._tag,
      intent,
      visualType: visualStyle?.type,
      tags,
    };
  }, [attrs['data-intent'], attrs['data-visual-style'], attrs['data-tags']]);

  // Handle mouse enter - show popover after delay
  const handleMouseEnter = useCallback(() => {
    if (!annotationId) return;

    // Set hover state immediately for CSS effects
    annotationRegistry.set(hoveredAnnotationIdAtom, annotationId);

    // Delay popover show for better UX
    hoverTimeoutRef.current = setTimeout(() => {
      if (!spanRef.current) return;

      const rect = spanRef.current.getBoundingClientRect();

      // Set atoms directly via registry - no Effect needed!
      annotationRegistry.set(activePopoverAtom, {
        annotationId,
        markId: annotationId,
        placement: 'top',
        trigger: 'hover',
        isPinned: false,
        anchorRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      });

      // Build and set content directly
      if (intentData) {
        annotationRegistry.set(popoverContentAtom, buildPopoverContent(intentData));
      }
    }, HOVER_DELAY_MS);
  }, [annotationId, intentData]);

  // Handle mouse leave - just cancel pending open, safePolygon handles closing
  const handleMouseLeave = useCallback(() => {
    // Clear any pending hover timeout (if we leave before popover opens)
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Clear CSS hover state
    annotationRegistry.set(hoveredAnnotationIdAtom, null);

    // Note: We do NOT close the popover here!
    // safePolygon in AnnotationPopover handles closing via document mousemove
    // This allows user to move cursor from trigger to popover without closing
  }, []);

  // Handle click - toggle popover (pinned mode)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!annotationId || !spanRef.current) return;

      // Prevent editor from handling click
      e.stopPropagation();

      const rect = spanRef.current.getBoundingClientRect();

      // Check if this popover is already open - toggle it
      const current = annotationRegistry.get(activePopoverAtom);
      if (current?.annotationId === annotationId) {
        // Close it
        annotationRegistry.set(activePopoverAtom, null);
        annotationRegistry.set(popoverContentAtom, null);
      } else {
        // Open it (pinned)
        annotationRegistry.set(activePopoverAtom, {
          annotationId,
          markId: annotationId,
          placement: 'top',
          trigger: 'click',
          isPinned: true,
          anchorRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });

        if (intentData) {
          annotationRegistry.set(popoverContentAtom, buildPopoverContent(intentData));
        }
      }
    },
    [annotationId, intentData]
  );

  // Parse visual style for rendering - use centralized parser
  const visualStyle = parseVisualStyle(attrs['data-visual-style']) ?? DEFAULT_VISUAL_STYLE;

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
      data-visual-style={attrs['data-visual-style']}
      data-intent={attrs['data-intent']}
      data-tags={attrs['data-tags']}
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
