/**
 * RowResizeHandle Component
 *
 * Drag handle for resizing rows within a ColumnLayout (direction='row').
 * Positioned between adjacent rows.
 *
 * @module editor/v3/extensions/blocks/ColumnLayout/RowResizeHandle
 */

import { useRef, useState, useCallback, useEffect } from 'react';

import { VANTA_COLORS } from '@/components/portal/tokens';

// =============================================================================
// Types
// =============================================================================

export interface RowResizeHandleProps {
  /** Index of this handle (between row index and index+1) */
  index: number;
  /** Current row heights (ratios) */
  widths: readonly number[];
  /** Callback when heights change during drag */
  onWidthsChange: (widths: number[]) => void;
  /** Callback when drag completes (for persisting) */
  onDragEnd: (widths: number[]) => void;
  /** Container height for delta calculation */
  containerHeight: number;
  /** Minimum row height ratio (0.1 = 10%) */
  minHeight?: number;
  /** Whether the editor is in read-only mode */
  disabled?: boolean;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Draggable handle between adjacent rows.
 * Adjusts row heights on drag.
 */
export function RowResizeHandle({
  index,
  widths,
  onWidthsChange,
  onDragEnd,
  containerHeight,
  minHeight = 0.1,
  disabled = false,
}: RowResizeHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startWidthsRef = useRef<number[]>([]);

  // Calculate position of handle (sum of heights up to index+1)
  const position = widths.slice(0, index + 1).reduce((sum, w) => sum + w, 0) * 100;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;

      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      startYRef.current = e.clientY;
      startWidthsRef.current = [...widths];

      // Capture pointer for tracking outside element
      handleRef.current?.setPointerCapture(e.pointerId);
    },
    [disabled, widths]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || disabled) return;

      const deltaY = e.clientY - startYRef.current;
      const deltaRatio = deltaY / containerHeight;

      const newWidths = [...startWidthsRef.current];

      // Adjust top row (index) and bottom row (index + 1)
      const topIndex = index;
      const bottomIndex = index + 1;

      const newTopHeight = Math.max(minHeight, newWidths[topIndex] + deltaRatio);
      const newBottomHeight = Math.max(minHeight, newWidths[bottomIndex] - deltaRatio);

      // Only apply if both rows meet minimum height
      if (newTopHeight >= minHeight && newBottomHeight >= minHeight) {
        newWidths[topIndex] = newTopHeight;
        newWidths[bottomIndex] = newBottomHeight;
        onWidthsChange(newWidths);
      }
    },
    [isDragging, disabled, index, containerHeight, minHeight, onWidthsChange]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;

      setIsDragging(false);
      handleRef.current?.releasePointerCapture(e.pointerId);

      // Calculate final heights and persist
      const deltaY = e.clientY - startYRef.current;
      const deltaRatio = deltaY / containerHeight;

      const newWidths = [...startWidthsRef.current];
      const topIndex = index;
      const bottomIndex = index + 1;

      const newTopHeight = Math.max(minHeight, newWidths[topIndex] + deltaRatio);
      const newBottomHeight = Math.max(minHeight, newWidths[bottomIndex] - deltaRatio);

      if (newTopHeight >= minHeight && newBottomHeight >= minHeight) {
        newWidths[topIndex] = newTopHeight;
        newWidths[bottomIndex] = newBottomHeight;
      }

      onDragEnd(newWidths);
    },
    [isDragging, index, containerHeight, minHeight, onDragEnd]
  );

  // Prevent context menu during drag
  useEffect(() => {
    if (!isDragging) return;

    const preventContextMenu = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', preventContextMenu);
    return () => document.removeEventListener('contextmenu', preventContextMenu);
  }, [isDragging]);

  if (disabled) return null;

  return (
    <div
      ref={handleRef}
      className={`row-resize-handle ${isDragging ? 'dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: `calc(${position}% - 4px)`,
        height: 8,
        cursor: 'row-resize',
        zIndex: 10,
        background: isDragging ? `${VANTA_COLORS.accent.cyan}40` : 'transparent',
        transition: isDragging ? 'none' : 'background 150ms',
        touchAction: 'none',
      }}
    >
      {/* Visible handle indicator */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 24,
          height: 4,
          background: isDragging ? VANTA_COLORS.accent.cyan : VANTA_COLORS.text.tertiary,
          borderRadius: 2,
          opacity: isDragging ? 1 : 0,
          transition: 'opacity 150ms, background 150ms',
        }}
        className="handle-indicator"
      />
    </div>
  );
}
