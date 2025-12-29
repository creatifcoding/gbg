/**
 * ColumnResizeHandle Component
 *
 * Drag handle for resizing columns within a ColumnLayout.
 * Positioned between adjacent columns.
 *
 * @module editor/v3/extensions/blocks/ColumnLayout/ColumnResizeHandle
 */

import { useRef, useState, useCallback, useEffect } from 'react';

import { VANTA_COLORS } from '@/components/portal/tokens';

// =============================================================================
// Types
// =============================================================================

export interface ColumnResizeHandleProps {
  /** Index of this handle (between column index and index+1) */
  index: number;
  /** Current column widths */
  widths: readonly number[];
  /** Callback when widths change during drag */
  onWidthsChange: (widths: number[]) => void;
  /** Callback when drag completes (for persisting) */
  onDragEnd: (widths: number[]) => void;
  /** Container width for delta calculation */
  containerWidth: number;
  /** Minimum column width ratio (0.1 = 10%) */
  minWidth?: number;
  /** Whether the editor is in read-only mode */
  disabled?: boolean;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Draggable handle between adjacent columns.
 * Adjusts column widths on drag.
 */
export function ColumnResizeHandle({
  index,
  widths,
  onWidthsChange,
  onDragEnd,
  containerWidth,
  minWidth = 0.1,
  disabled = false,
}: ColumnResizeHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthsRef = useRef<number[]>([]);

  // Calculate position of handle (sum of widths up to index+1)
  const position = widths.slice(0, index + 1).reduce((sum, w) => sum + w, 0) * 100;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;

      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthsRef.current = [...widths];

      // Capture pointer for tracking outside element
      handleRef.current?.setPointerCapture(e.pointerId);
    },
    [disabled, widths]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || disabled) return;

      const deltaX = e.clientX - startXRef.current;
      const deltaRatio = deltaX / containerWidth;

      const newWidths = [...startWidthsRef.current];

      // Adjust left column (index) and right column (index + 1)
      const leftIndex = index;
      const rightIndex = index + 1;

      const newLeftWidth = Math.max(minWidth, newWidths[leftIndex] + deltaRatio);
      const newRightWidth = Math.max(minWidth, newWidths[rightIndex] - deltaRatio);

      // Only apply if both columns meet minimum width
      if (newLeftWidth >= minWidth && newRightWidth >= minWidth) {
        newWidths[leftIndex] = newLeftWidth;
        newWidths[rightIndex] = newRightWidth;
        onWidthsChange(newWidths);
      }
    },
    [isDragging, disabled, index, containerWidth, minWidth, onWidthsChange]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;

      setIsDragging(false);
      handleRef.current?.releasePointerCapture(e.pointerId);

      // Calculate final widths and persist
      const deltaX = e.clientX - startXRef.current;
      const deltaRatio = deltaX / containerWidth;

      const newWidths = [...startWidthsRef.current];
      const leftIndex = index;
      const rightIndex = index + 1;

      const newLeftWidth = Math.max(minWidth, newWidths[leftIndex] + deltaRatio);
      const newRightWidth = Math.max(minWidth, newWidths[rightIndex] - deltaRatio);

      if (newLeftWidth >= minWidth && newRightWidth >= minWidth) {
        newWidths[leftIndex] = newLeftWidth;
        newWidths[rightIndex] = newRightWidth;
      }

      onDragEnd(newWidths);
    },
    [isDragging, index, containerWidth, minWidth, onDragEnd]
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
      className={`column-resize-handle ${isDragging ? 'dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `calc(${position}% - 4px)`,
        width: 8,
        cursor: 'col-resize',
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
          width: 4,
          height: 24,
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

// =============================================================================
// Hook for multiple handles
// =============================================================================

export interface UseColumnResizeResult {
  /** Current widths (may be mid-drag) */
  widths: readonly number[];
  /** Whether any handle is being dragged */
  isDragging: boolean;
  /** Render resize handles */
  renderHandles: () => React.ReactNode;
}

export interface UseColumnResizeOptions {
  /** Block ID for atom lookup */
  blockId: string;
  /** Current persisted widths */
  persistedWidths: readonly number[];
  /** Container ref for width measurement */
  containerRef: React.RefObject<HTMLElement>;
  /** Callback to persist new widths */
  onPersist: (widths: number[]) => void;
  /** Minimum column width ratio */
  minWidth?: number;
  /** Whether resize is disabled */
  disabled?: boolean;
}
