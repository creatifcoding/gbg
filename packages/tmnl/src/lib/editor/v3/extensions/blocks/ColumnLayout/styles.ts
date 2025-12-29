/**
 * ColumnLayout Styles
 *
 * CSS-in-JS styles for the column layout extension.
 * Grid layout, column styling, resize handles, responsive stacking.
 *
 * @module editor/v3/extensions/blocks/ColumnLayout/styles
 */

import {
  editorTheme,
  typography,
  spacing,
  borderRadius,
} from '../../../theme';

// =============================================================================
// Column Layout Styles
// =============================================================================

export const columnLayoutStyles = `
  /* =========================================================================
   * Column Layout Container
   * ========================================================================= */

  .column-layout {
    position: relative;
    margin: ${spacing[4]} 0;
    /* Badge now controlled via toggle button, not hover */
  }

  /* Toggle button always visible when editable */
  .column-layout-toggle {
    opacity: 0.6;
    transition: all 150ms ease;
  }

  .column-layout:hover .column-layout-toggle,
  .column-layout-toggle[data-active="true"] {
    opacity: 1;
  }

  /* =========================================================================
   * Column Layout Grid
   * ========================================================================= */

  .column-layout-grid {
    position: relative;
    display: grid;
    min-height: 60px;
  }

  /* CRITICAL: TipTap creates multiple wrapper layers that break CSS Grid.
   *
   * Actual DOM structure (discovered via Playwright inspection):
   * .column-layout-grid (display: grid)
   *   └── [data-node-view-content]     ← wrapper 1
   *       └── [data-node-view-wrapper] ← wrapper 2 (wraps ALL columns!)
   *           └── .column
   *           └── .column
   *
   * Both wrappers need display:contents to make .column direct grid children.
   */
  .column-layout-grid > [data-node-view-content] {
    display: contents;
  }

  .column-layout-grid > [data-node-view-content] > [data-node-view-wrapper] {
    display: contents;
  }

  /* =========================================================================
   * Individual Columns
   * ========================================================================= */

  .column {
    min-width: 0; /* Prevent grid blowout from long content */
    padding: ${spacing[3]};
    border: 1px dashed ${editorTheme.surface.border};
    border-radius: ${borderRadius.md};
    background: ${editorTheme.surface.secondary}40;
    transition: border-color 150ms, background 150ms;
  }

  .column:hover {
    border-color: ${editorTheme.surface.border};
    background: ${editorTheme.surface.secondary}60;
  }

  .column:focus-within {
    border-color: ${editorTheme.text.accent}40;
    border-style: solid;
  }

  /* Empty column placeholder */
  .column .column-content:empty::before {
    content: 'Type something...';
    color: ${editorTheme.text.muted};
    font-size: ${typography.fontSize.sm};
    font-style: italic;
  }

  /* Ensure column content wrapper is full height */
  .column-content {
    min-height: 100%;
  }

  /* =========================================================================
   * Resize Handles
   * ========================================================================= */

  .column-resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: col-resize;
    z-index: 10;
    background: transparent;
    transition: background 150ms;
    touch-action: none;
  }

  .column-resize-handle:hover {
    background: ${editorTheme.text.accent}20;
  }

  .column-resize-handle.dragging {
    background: ${editorTheme.text.accent}40;
  }

  /* Handle indicator (visible on hover) */
  .column-resize-handle .handle-indicator {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 24px;
    background: ${editorTheme.text.muted};
    border-radius: 2px;
    opacity: 0;
    transition: opacity 150ms, background 150ms;
  }

  .column-resize-handle:hover .handle-indicator {
    opacity: 1;
  }

  .column-resize-handle.dragging .handle-indicator {
    opacity: 1;
    background: ${editorTheme.text.accent};
  }

  /* =========================================================================
   * Badge / Controls
   * ========================================================================= */

  /* Badge is now controlled via React showControls state, not CSS hover.
   * These styles only provide base appearance when badge is rendered. */
  .column-layout-badge {
    position: absolute;
    top: 0;
    left: ${spacing[2]};
    display: flex;
    align-items: center;
    gap: ${spacing[1]};
    padding: ${spacing[0.5]} ${spacing[2]};
    font-size: ${typography.fontSize.xs};
    font-family: ${typography.fontFamily.mono};
    font-weight: ${typography.fontWeight.medium};
    color: ${editorTheme.text.muted};
    background: ${editorTheme.surface.background};
    border: 1px solid ${editorTheme.surface.border};
    border-radius: ${borderRadius.sm};
    /* Visibility controlled by React, not CSS */
    pointer-events: auto;
    user-select: none;
  }

  .column-layout-badge button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 2px;
    color: ${editorTheme.text.muted};
    cursor: pointer;
    pointer-events: auto;
    transition: color 150ms, background 150ms;
  }

  .column-layout-badge button:hover:not(:disabled) {
    color: ${editorTheme.text.secondary};
    background: ${editorTheme.surface.secondary};
  }

  .column-layout-badge button:disabled {
    color: ${editorTheme.surface.border};
    cursor: not-allowed;
  }

  /* =========================================================================
   * Responsive Stacking
   * ========================================================================= */

  .column-layout[data-stacked="true"] .column-layout-grid {
    grid-template-columns: 1fr !important;
  }

  .column-layout[data-stacked="true"] .column-resize-handle {
    display: none;
  }

  /* Container query fallback (when ResizeObserver isn't available) */
  @container (max-width: 768px) {
    .column-layout-grid {
      grid-template-columns: 1fr !important;
    }

    .column-resize-handle {
      display: none;
    }
  }

  /* =========================================================================
   * Nested Column Layouts
   * ========================================================================= */

  .column .column-layout {
    margin: ${spacing[2]} 0;
    padding-top: ${spacing[4]}; /* Smaller badge space for nested */
  }

  .column .column-layout .column {
    padding: ${spacing[2]};
    background: ${editorTheme.surface.secondary}40;
  }

  /* =========================================================================
   * Print Styles
   * ========================================================================= */

  @media print {
    .column-layout-badge {
      display: none;
    }

    .column-resize-handle {
      display: none;
    }

    .column {
      border: 1px solid #ddd;
      background: none;
    }
  }
`;
