/**
 * TableOfContents
 *
 * Sidebar component that extracts headings from TipTap editor content
 * and provides navigation. Uses effect-atom for state management.
 *
 * ATOM-AS-STATE PATTERN:
 * - Subscribes to editorInstanceAtom (always fresh, no stale closures)
 * - Uses isViewMountedAtom to guard DOM operations
 * - Syncs with activeHeadingIdAtom from viewport atoms
 *
 * CRITICAL: Parent component MUST wrap with RegistryContext.Provider
 * using the same registry that EffectBridge is configured with.
 *
 * @module editor/v3/components/TableOfContents
 */

import React, { useEffect, useState, useCallback, useContext } from 'react';
import type { Editor } from '@tiptap/core';
import { Option, pipe } from 'effect';
import { useAtomValue, useAtomSet, RegistryContext } from '@effect-atom/atom-react';
import { tableOfContentsStyles } from './styles';
import {
  editorInstanceAtom,
  isViewMountedAtom,
  activeHeadingIdAtom,
} from '../atoms';

// =============================================================================
// Types
// =============================================================================

export interface HeadingItem {
  /** Unique ID for the heading (generated from text) */
  id: string;
  /** Heading text content */
  text: string;
  /** Heading level (1-6) */
  level: number;
  /** Position in document (for scrolling) */
  pos: number;
}

export interface TableOfContentsProps {
  /** Callback when heading is clicked */
  onHeadingClick?: (heading: HeadingItem) => void;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Minimum heading level to show (default: 1) */
  minLevel?: number;
  /** Maximum heading level to show (default: 3) */
  maxLevel?: number;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a slug ID from heading text.
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract headings directly from ProseMirror document.
 */
function extractHeadingsFromEditor(
  editor: Editor,
  minLevel: number,
  maxLevel: number
): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const doc = editor.state.doc;

  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const level = node.attrs['level'] as number;
      if (level >= minLevel && level <= maxLevel) {
        const text = node.textContent;
        if (text) {
          headings.push({
            id: generateSlug(text) || `heading-${headings.length}`,
            text,
            level,
            pos,
          });
        }
      }
    }
    return true; // Continue descending
  });

  return headings;
}

/**
 * Scroll to heading using the editor view directly.
 * Uses Effect Option.flatMapNullable for safe null chaining.
 *
 * @param editor - The editor instance (from atom)
 * @param heading - The heading to scroll to
 * @returns true if scroll was attempted, false if not ready
 */
function scrollToHeadingDirect(editor: Editor | null, heading: HeadingItem): boolean {
  // Use Option.flatMapNullable for safe chaining
  const scrollResult = pipe(
    Option.fromNullable(editor),
    Option.flatMapNullable((e) => e.view),
    Option.flatMapNullable((view) => (view.state?.doc && view.dom ? view : null)),
    Option.flatMapNullable((view) => {
      // nodeDOM can throw or return null if position is invalid
      try {
        const node = view.nodeDOM(heading.pos);
        if (node instanceof HTMLElement) {
          return { view, domNode: node };
        }
        return null;
      } catch {
        return null;
      }
    })
  );

  if (Option.isNone(scrollResult)) {
    // Editor not ready or DOM node not found
    if (editor?.view?.dom) {
      // View exists but node not found — fallback to focus only
      console.debug('[TOC] Node not found, focusing position:', heading.pos);
      editor.commands.focus(heading.pos);
      return true;
    }
    console.warn('[TOC] Editor view not mounted, cannot scroll');
    return false;
  }

  const { view, domNode } = scrollResult.value;

  // Scroll into view (works with CSS transforms!)
  domNode.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Apply offset after scroll animation settles
  const scrollContainer =
    view.dom.closest('.tmnl-editor-content') ?? view.dom.parentElement;

  if (scrollContainer) {
    setTimeout(() => {
      scrollContainer.scrollBy({ top: -80, behavior: 'smooth' });
    }, 300);
  }

  // Focus editor at position
  editor?.commands.focus(heading.pos);

  console.debug('[TOC] Scrolled to heading:', heading.text);
  return true;
}

// =============================================================================
// Component
// =============================================================================

/**
 * TableOfContents
 *
 * Renders a navigation sidebar with document headings.
 * Subscribes to editor atoms for fresh state.
 *
 * CRITICAL: Must be rendered within a RegistryContext.Provider
 * that provides the same registry used by EffectBridge.
 *
 * @example
 * ```tsx
 * <PanelRegistryProvider>
 *   <CollaborativeTiptapEditor registry={panelRegistry} />
 *   <TableOfContents maxLevel={3} />
 * </PanelRegistryProvider>
 * ```
 */
export function TableOfContents({
  onHeadingClick,
  className,
  style,
  minLevel = 1,
  maxLevel = 3,
}: TableOfContentsProps) {
  // Get registry from context for debugging
  const registry = useContext(RegistryContext);

  // Subscribe to atoms — MUST be within RegistryContext.Provider
  const editor = useAtomValue(editorInstanceAtom);
  const isViewMounted = useAtomValue(isViewMountedAtom);
  const activeId = useAtomValue(activeHeadingIdAtom);
  const setActiveHeading = useAtomSet(activeHeadingIdAtom);

  // Local state for extracted headings
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  // Debug logging - check registry identity
  console.debug('[TOC] State:', {
    hasEditor: !!editor,
    editorFromRegistry: registry.get(editorInstanceAtom),
    isViewMounted,
    activeId,
    headingCount: headings.length,
    registryId: (registry as any)._id ?? 'unknown',
  });

  // Extract headings when editor content changes
  useEffect(() => {
    if (!editor) {
      setHeadings([]);
      return;
    }

    const updateHeadings = () => {
      const extracted = extractHeadingsFromEditor(editor, minLevel, maxLevel);
      setHeadings(extracted);

      // Set initial active heading if none set
      if (extracted.length > 0 && !activeId) {
        setActiveHeading(extracted[0].id);
      }
    };

    // Initial extraction
    updateHeadings();

    // Listen for content updates
    editor.on('update', updateHeadings);

    return () => {
      editor.off('update', updateHeadings);
    };
  }, [editor, minLevel, maxLevel, activeId]);

  // Handle heading click
  const handleClick = useCallback(
    (heading: HeadingItem) => {
      console.debug('[TOC] Click:', heading.text);

      // Update active heading via context-aware atom setter
      setActiveHeading(heading.id);

      // Scroll using the fresh editor from atom
      const scrolled = scrollToHeadingDirect(editor, heading);

      // Notify parent if provided
      if (scrolled) {
        onHeadingClick?.(heading);
      }
    },
    [editor, onHeadingClick, setActiveHeading]
  );

  // Empty state
  if (headings.length === 0) {
    return (
      <aside className={`tmnl-editor-toc ${className ?? ''}`} style={style}>
        <nav className="tmnl-editor-toc-nav">
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--editor-text-subtle, #737373)',
              fontStyle: 'italic',
            }}
          >
            No headings
          </span>
        </nav>
        <style>{tableOfContentsStyles}</style>
      </aside>
    );
  }

  return (
    <aside className={`tmnl-editor-toc ${className ?? ''}`} style={style}>
      <nav className="tmnl-editor-toc-nav">
        {headings.map((heading) => (
          <button
            key={`${heading.id}-${heading.pos}`}
            className={`tmnl-editor-toc-item ${
              activeId === heading.id ? 'active' : ''
            }`}
            data-level={heading.level}
            onClick={() => handleClick(heading)}
            title={heading.text}
            disabled={!isViewMounted}
          >
            {heading.text}
          </button>
        ))}
      </nav>
      <style>{tableOfContentsStyles}</style>
    </aside>
  );
}

// =============================================================================
// Hook: useTableOfContents
// =============================================================================

export interface UseTableOfContentsOptions {
  minLevel?: number;
  maxLevel?: number;
}

export interface UseTableOfContentsResult {
  headings: HeadingItem[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  scrollToHeading: (heading: HeadingItem) => void;
  isReady: boolean;
}

/**
 * Hook to manage table of contents state.
 * Uses effect-atom for fresh editor reference.
 *
 * CRITICAL: Must be used within a RegistryContext.Provider.
 *
 * @example
 * ```tsx
 * const { headings, activeId, scrollToHeading, isReady } = useTableOfContents();
 *
 * return (
 *   <ul>
 *     {headings.map(h => (
 *       <li
 *         key={h.id}
 *         onClick={() => scrollToHeading(h)}
 *         style={{ opacity: isReady ? 1 : 0.5 }}
 *       >
 *         {h.text}
 *       </li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useTableOfContents({
  minLevel = 1,
  maxLevel = 3,
}: UseTableOfContentsOptions = {}): UseTableOfContentsResult {
  // Subscribe to atoms — context-aware via RegistryContext
  const editor = useAtomValue(editorInstanceAtom);
  const isViewMounted = useAtomValue(isViewMountedAtom);
  const activeId = useAtomValue(activeHeadingIdAtom);
  const setActiveHeadingAtom = useAtomSet(activeHeadingIdAtom);

  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  // Extract headings when editor content changes
  useEffect(() => {
    if (!editor) {
      setHeadings([]);
      return;
    }

    const updateHeadings = () => {
      const extracted = extractHeadingsFromEditor(editor, minLevel, maxLevel);
      setHeadings(extracted);

      // Set initial active heading
      if (extracted.length > 0 && !activeId) {
        setActiveHeadingAtom(extracted[0].id);
      }
    };

    // Initial extraction
    updateHeadings();

    // Listen for content updates
    editor.on('update', updateHeadings);

    return () => {
      editor.off('update', updateHeadings);
    };
  }, [editor, minLevel, maxLevel, activeId, setActiveHeadingAtom]);

  // Scroll to heading
  const scrollToHeading = useCallback(
    (heading: HeadingItem) => {
      setActiveHeadingAtom(heading.id);
      scrollToHeadingDirect(editor, heading);
    },
    [editor, setActiveHeadingAtom]
  );

  // Set active ID via atom setter
  const setActiveId = useCallback(
    (id: string | null) => {
      setActiveHeadingAtom(id);
    },
    [setActiveHeadingAtom]
  );

  return {
    headings,
    activeId,
    setActiveId,
    scrollToHeading,
    isReady: isViewMounted,
  };
}

export default TableOfContents;
