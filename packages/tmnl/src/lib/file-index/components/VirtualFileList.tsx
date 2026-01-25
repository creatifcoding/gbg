/**
 * VirtualFileList
 *
 * Virtualized file list using TanStack Virtual.
 * Efficiently renders 10k+ files with smooth scrolling.
 *
 * Features:
 * - Fixed-height rows (32px) for optimal performance
 * - Progressive rendering as files stream in
 * - Keyboard navigation support
 * - Selection state
 *
 * @module file-index/components/VirtualFileList
 */

import { useRef, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { IndexedFile } from '../services/FileIndexService';

// =============================================================================
// Types
// =============================================================================

export interface VirtualFileListProps {
  /**
   * Files to render.
   * Can update progressively as scan discovers files.
   */
  files: readonly IndexedFile[];

  /**
   * Height of the list container in pixels.
   * Required for virtualization.
   */
  height: number;

  /**
   * Row height in pixels.
   * Default: 32
   */
  rowHeight?: number;

  /**
   * Overscan count - how many extra rows to render outside viewport.
   * Higher = smoother scrolling, more DOM nodes.
   * Default: 10
   */
  overscan?: number;

  /**
   * Called when a file is clicked.
   */
  onFileClick?: (file: IndexedFile, index: number) => void;

  /**
   * Called when a file is double-clicked.
   */
  onFileDoubleClick?: (file: IndexedFile, index: number) => void;

  /**
   * Selected file path (for highlighting).
   */
  selectedPath?: string | null;

  /**
   * Custom class for the container.
   */
  className?: string;

  /**
   * Custom class for each row.
   */
  rowClassName?: string;

  /**
   * Render function for file icon.
   * Default: renders based on extension.
   */
  renderIcon?: (file: IndexedFile) => React.ReactNode;

  /**
   * Whether to show file size.
   * Default: true
   */
  showSize?: boolean;

  /**
   * Whether to show relative path.
   * Default: true
   */
  showPath?: boolean;

  /**
   * Empty state content.
   */
  emptyContent?: React.ReactNode;

  /**
   * Loading state content.
   */
  loadingContent?: React.ReactNode;

  /**
   * Whether currently loading.
   */
  isLoading?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format file size for display.
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get icon for file extension.
 */
function getFileIcon(extension: 'md' | 'mdx'): string {
  return extension === 'mdx' ? '📦' : '📄';
}

// =============================================================================
// Component
// =============================================================================

export function VirtualFileList({
  files,
  height,
  rowHeight = 32,
  overscan = 10,
  onFileClick,
  onFileDoubleClick,
  selectedPath,
  className = '',
  rowClassName = '',
  renderIcon,
  showSize = true,
  showPath = true,
  emptyContent,
  loadingContent,
  isLoading = false,
}: VirtualFileListProps) {
  // Parent container ref for virtualizer
  const parentRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Virtualizer instance
  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  // Virtual items to render
  const virtualItems = virtualizer.getVirtualItems();

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (files.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next =
              prev === null ? 0 : Math.min(prev + 1, files.length - 1);
            virtualizer.scrollToIndex(next, { align: 'auto' });
            return next;
          });
          break;

        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next =
              prev === null ? files.length - 1 : Math.max(prev - 1, 0);
            virtualizer.scrollToIndex(next, { align: 'auto' });
            return next;
          });
          break;

        case 'Enter':
          if (focusedIndex !== null && onFileClick) {
            onFileClick(files[focusedIndex], focusedIndex);
          }
          break;

        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          virtualizer.scrollToIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setFocusedIndex(files.length - 1);
          virtualizer.scrollToIndex(files.length - 1);
          break;

        case 'PageDown':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const pageSize = Math.floor(height / rowHeight);
            const next =
              prev === null
                ? pageSize
                : Math.min(prev + pageSize, files.length - 1);
            virtualizer.scrollToIndex(next, { align: 'start' });
            return next;
          });
          break;

        case 'PageUp':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const pageSize = Math.floor(height / rowHeight);
            const next = prev === null ? 0 : Math.max(prev - pageSize, 0);
            virtualizer.scrollToIndex(next, { align: 'start' });
            return next;
          });
          break;
      }
    },
    [files, focusedIndex, height, rowHeight, onFileClick, virtualizer]
  );

  // Handle row click
  const handleRowClick = useCallback(
    (file: IndexedFile, index: number) => {
      setFocusedIndex(index);
      onFileClick?.(file, index);
    },
    [onFileClick]
  );

  // Handle row double click
  const handleRowDoubleClick = useCallback(
    (file: IndexedFile, index: number) => {
      onFileDoubleClick?.(file, index);
    },
    [onFileDoubleClick]
  );

  // Memoize total size for scroll container
  const totalSize = virtualizer.getTotalSize();

  // Loading state
  if (isLoading && files.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height }}
      >
        {loadingContent ?? (
          <div className="text-gray-500 animate-pulse">Scanning files...</div>
        )}
      </div>
    );
  }

  // Empty state
  if (files.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height }}
      >
        {emptyContent ?? <div className="text-gray-500">No files found</div>}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${className}`}
      style={{ height }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label="File list"
    >
      {/* Scroll container with total height */}
      <div
        style={{
          height: totalSize,
          width: '100%',
          position: 'relative',
        }}
      >
        {/* Only render visible items */}
        {virtualItems.map((virtualItem) => {
          const file = files[virtualItem.index];
          const isSelected = selectedPath === file.path;
          const isFocused = focusedIndex === virtualItem.index;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              role="option"
              aria-selected={isSelected}
              className={`
                absolute left-0 top-0 w-full
                flex items-center gap-2 px-3
                cursor-pointer select-none
                transition-colors duration-75
                ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-100'
                    : isFocused
                    ? 'bg-gray-700/50'
                    : 'hover:bg-gray-800/50'
                }
                ${rowClassName}
              `}
              style={{
                height: rowHeight,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              onClick={() => handleRowClick(file, virtualItem.index)}
              onDoubleClick={() =>
                handleRowDoubleClick(file, virtualItem.index)
              }
            >
              {/* Icon */}
              <span className="flex-shrink-0 w-5 text-center">
                {renderIcon ? renderIcon(file) : getFileIcon(file.extension)}
              </span>

              {/* File name */}
              <span className="flex-1 truncate font-mono text-sm">
                {file.name}
              </span>

              {/* Relative path */}
              {showPath && file.relativePath !== file.name && (
                <span className="flex-shrink-0 text-xs text-gray-500 truncate max-w-[200px]">
                  {file.relativePath
                    .replace(`/${file.name}`, '')
                    .replace(file.name, '') || '/'}
                </span>
              )}

              {/* File size */}
              {showSize && (
                <span className="flex-shrink-0 text-xs text-gray-500 tabular-nums w-16 text-right">
                  {formatSize(file.size)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Exports
// =============================================================================

export default VirtualFileList;
