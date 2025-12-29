/**
 * ColumnLayoutView Component
 *
 * React node view for ColumnLayout container.
 * Renders a CSS grid with responsive stacking.
 *
 * @module editor/v3/extensions/blocks/ColumnLayout/ColumnLayoutView
 */

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  NodeViewWrapper,
  NodeViewContent,
  type NodeViewProps,
} from '@tiptap/react';
import { LayoutGrid, Plus, Minus } from 'lucide-react';

import { VANTA_COLORS, VANTA_BORDERS, VANTA_SPACING } from '@/components/portal/tokens';

import type { ColumnLayoutAttrs, ColumnLayoutState } from './types';
import {
  getColumnLayoutAtoms,
  disposeColumnLayoutAtoms,
  createColumnLayoutAtoms,
} from './atoms';
import { ColumnResizeHandle } from './ColumnResizeHandle';

// =============================================================================
// Constants
// =============================================================================

const GRID_BADGE_STYLES = {
  position: 'absolute' as const,
  top: '-24px',
  left: '8px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  fontSize: '10px',
  fontFamily: 'var(--tmnl-font-mono)',
  fontWeight: 500,
  color: VANTA_COLORS.text.muted,
  backgroundColor: VANTA_COLORS.surface.elevated,
  border: `1px solid ${VANTA_COLORS.surface.border}`,
  borderRadius: '4px',
  opacity: 0,
  transition: 'opacity 150ms',
  pointerEvents: 'none' as const,
};

// =============================================================================
// Component
// =============================================================================

/**
 * Multi-column layout container.
 * Renders children in a CSS grid with configurable column widths.
 */
export function ColumnLayoutView({
  node,
  updateAttributes,
  editor,
  deleteNode,
}: NodeViewProps) {
  const attrs = node.attrs as ColumnLayoutAttrs;
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [isStacked, setIsStacked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [liveWidths, setLiveWidths] = useState<number[] | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Track container width for resize calculations
  useEffect(() => {
    if (!gridRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, []);

  // Initialize atoms for this block
  useEffect(() => {
    createColumnLayoutAtoms(attrs.id, {
      widths: [...attrs.widths],
      isDragging: false,
      activeHandle: null,
      isStacked: false,
    });

    return () => {
      disposeColumnLayoutAtoms(attrs.id);
    };
  }, [attrs.id]);

  // Responsive stacking via ResizeObserver
  useEffect(() => {
    if (!containerRef.current || attrs.responsive !== 'stack') return;

    const observer = new ResizeObserver(([entry]) => {
      const shouldStack = entry.contentRect.width < attrs.stackBreakpoint;
      setIsStacked(shouldStack);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [attrs.responsive, attrs.stackBreakpoint]);

  // Use live widths during drag, otherwise use persisted widths
  const displayWidths = liveWidths ?? attrs.widths;

  // Generate grid-template-columns CSS using fr units
  // fr units automatically account for gaps, unlike percentages
  const gridTemplateColumns = useMemo(() => {
    if (isStacked) return '1fr';
    // Convert ratios to fr units (e.g., [0.5, 0.5] → "1fr 1fr", [0.33, 0.67] → "1fr 2fr")
    // Multiply by 100 for better precision with small differences
    return displayWidths.map((w) => `${(w * 100).toFixed(2)}fr`).join(' ');
  }, [displayWidths, isStacked]);

  // Handle width changes during drag
  const handleWidthsChange = useCallback((newWidths: number[]) => {
    setLiveWidths(newWidths);
  }, []);

  // Handle drag end - persist to document
  const handleDragEnd = useCallback(
    (newWidths: number[]) => {
      setLiveWidths(null);
      updateAttributes({ widths: newWidths });
    },
    [updateAttributes]
  );

  // Column count controls
  const canAddColumn = attrs.columns < 6;
  const canRemoveColumn = attrs.columns > 1;

  const handleAddColumn = useCallback(() => {
    if (!canAddColumn) return;
    editor.chain().focus().addColumn().run();
  }, [editor, canAddColumn]);

  const handleRemoveColumn = useCallback(() => {
    if (!canRemoveColumn) return;
    // Remove last column
    editor.chain().focus().removeColumn(attrs.columns - 1).run();
  }, [editor, canRemoveColumn, attrs.columns]);

  return (
    <NodeViewWrapper
      ref={containerRef}
      className="column-layout"
      data-id={attrs.id}
      data-columns={attrs.columns}
      data-stacked={isStacked}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        margin: `${VANTA_SPACING[4]} 0`,
      }}
    >
      {/* Badge */}
      <div
        className="column-layout-badge"
        style={{
          ...GRID_BADGE_STYLES,
          opacity: isHovered ? 1 : 0,
        }}
      >
        <LayoutGrid size={12} />
        <span>{attrs.columns} Columns</span>
        {!editor.isEditable ? null : (
          <>
            <button
              onClick={handleRemoveColumn}
              disabled={!canRemoveColumn}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                padding: 0,
                marginLeft: 4,
                background: 'transparent',
                border: 'none',
                borderRadius: 2,
                color: canRemoveColumn ? VANTA_COLORS.text.muted : VANTA_COLORS.surface.border,
                cursor: canRemoveColumn ? 'pointer' : 'not-allowed',
                pointerEvents: 'auto',
              }}
              title="Remove column"
            >
              <Minus size={10} />
            </button>
            <button
              onClick={handleAddColumn}
              disabled={!canAddColumn}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                padding: 0,
                background: 'transparent',
                border: 'none',
                borderRadius: 2,
                color: canAddColumn ? VANTA_COLORS.text.muted : VANTA_COLORS.surface.border,
                cursor: canAddColumn ? 'pointer' : 'not-allowed',
                pointerEvents: 'auto',
              }}
              title="Add column"
            >
              <Plus size={10} />
            </button>
          </>
        )}
      </div>

      {/* Grid Container */}
      <div
        ref={gridRef}
        className="column-layout-grid"
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns,
          gap: `${attrs.gap}px`,
          minHeight: '60px',
        }}
      >
        <NodeViewContent />

        {/* Resize handles between columns */}
        {!isStacked &&
          editor.isEditable &&
          displayWidths.slice(0, -1).map((_, index) => (
            <ColumnResizeHandle
              key={index}
              index={index}
              widths={displayWidths}
              onWidthsChange={handleWidthsChange}
              onDragEnd={handleDragEnd}
              containerWidth={containerWidth}
              minWidth={0.1}
              disabled={!editor.isEditable}
            />
          ))}
      </div>
    </NodeViewWrapper>
  );
}
