/**
 * ColumnLayoutView Component
 *
 * React node view for ColumnLayout container.
 * Renders a CSS grid with responsive stacking.
 * Layout controls hidden by default, revealed via top-right toggle button.
 *
 * @module editor/v3/extensions/blocks/ColumnLayout/ColumnLayoutView
 */

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  NodeViewWrapper,
  NodeViewContent,
  type NodeViewProps,
} from '@tiptap/react';
import { LayoutGrid, Plus, Minus, Settings2 } from 'lucide-react';

import { VANTA_COLORS, VANTA_SPACING } from '@/components/portal/tokens';

import type { ColumnLayoutAttrs, ColumnLayoutState } from './types';
import {
  getColumnLayoutAtoms,
  disposeColumnLayoutAtoms,
  createColumnLayoutAtoms,
} from './atoms';
import { ColumnResizeHandle } from './ColumnResizeHandle';

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
  const [showControls, setShowControls] = useState(false);
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
  // CRITICAL: Use gridRef (the actual grid container) not containerRef (NodeViewWrapper)
  // NodeViewWrapper may have constrained width due to TipTap positioning
  useEffect(() => {
    if (!gridRef.current || attrs.responsive !== 'stack') return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      // Don't stack if width is 0 or unreasonably small (initial render / layout thrash)
      // Only trigger stacking when we have a real measurement below breakpoint
      const shouldStack = width > 0 && width < attrs.stackBreakpoint;
      setIsStacked(shouldStack);
    });

    observer.observe(gridRef.current);
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

  const toggleControls = useCallback(() => {
    setShowControls((prev) => !prev);
  }, []);

  return (
    <NodeViewWrapper
      ref={containerRef}
      className="column-layout"
      data-id={attrs.id}
      data-columns={attrs.columns}
      data-stacked={isStacked}
      data-controls-visible={showControls}
      style={{
        position: 'relative',
        margin: `${VANTA_SPACING[4]} 0`,
      }}
    >
      {/* Layout Toggle Button - Top Right */}
      {editor.isEditable && (
        <button
          onClick={toggleControls}
          className="column-layout-toggle"
          data-active={showControls}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '8px',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            padding: 0,
            background: showControls ? VANTA_COLORS.accent.cyan : VANTA_COLORS.surface.elevated,
            border: `1px solid ${showControls ? VANTA_COLORS.accent.cyan : VANTA_COLORS.surface.border}`,
            borderRadius: '4px',
            color: showControls ? VANTA_COLORS.surface.void : VANTA_COLORS.text.muted,
            cursor: 'pointer',
          }}
          title={showControls ? 'Hide layout controls' : 'Show layout controls'}
        >
          <Settings2 size={14} />
        </button>
      )}

      {/* Control Badge - Only visible when showControls is true */}
      {showControls && editor.isEditable && (
        <div
          className="column-layout-badge"
          style={{
            position: 'absolute',
            top: '-28px',
            left: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            fontFamily: 'var(--tmnl-font-mono)',
            fontWeight: 500,
            color: VANTA_COLORS.text.secondary,
            backgroundColor: VANTA_COLORS.surface.elevated,
            border: `1px solid ${VANTA_COLORS.surface.border}`,
            borderRadius: '4px',
            zIndex: 15,
          }}
        >
          <LayoutGrid size={14} />
          <span>{attrs.columns} Columns</span>
          <div style={{ width: 1, height: 14, background: VANTA_COLORS.surface.border, margin: '0 4px' }} />
          <button
            onClick={handleRemoveColumn}
            disabled={!canRemoveColumn}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              padding: 0,
              background: canRemoveColumn ? VANTA_COLORS.surface.hover : 'transparent',
              border: 'none',
              borderRadius: 3,
              color: canRemoveColumn ? VANTA_COLORS.text.secondary : VANTA_COLORS.surface.border,
              cursor: canRemoveColumn ? 'pointer' : 'not-allowed',
            }}
            title="Remove column"
          >
            <Minus size={12} />
          </button>
          <button
            onClick={handleAddColumn}
            disabled={!canAddColumn}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              padding: 0,
              background: canAddColumn ? VANTA_COLORS.surface.hover : 'transparent',
              border: 'none',
              borderRadius: 3,
              color: canAddColumn ? VANTA_COLORS.text.secondary : VANTA_COLORS.surface.border,
              cursor: canAddColumn ? 'pointer' : 'not-allowed',
            }}
            title="Add column"
          >
            <Plus size={12} />
          </button>
        </div>
      )}

      {/* Grid Container */}
      <div
        ref={gridRef}
        className="column-layout-grid"
        data-show-guides={showControls}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns,
          gap: `${attrs.gap}px`,
          minHeight: '60px',
        }}
      >
        {/* CRITICAL: display:contents makes this wrapper invisible to CSS box model.
         * Without it, NodeViewContent creates a single grid child that contains
         * all columns, breaking the grid layout. */}
        <NodeViewContent style={{ display: 'contents' }} />

        {/* Resize handles - Only visible when showControls is true */}
        {showControls &&
          !isStacked &&
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
