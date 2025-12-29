/**
 * Editor Styles
 *
 * IGGY-inspired CSS-in-JS styles for Tiptap editor components.
 * Matches the DocViewer styling from /docs/overhaul.
 *
 * @module editor/v3/components/styles
 */

import {
  editorTheme,
  typography,
  spacing,
  borderRadius,
  generateCSSVariables,
} from '../theme';
import { blockHandleStyles } from './BlockDragHandle';
import { columnLayoutStyles } from '../extensions/blocks/ColumnLayout/styles';

// =============================================================================
// CSS Variables (inject once at root)
// =============================================================================

export const editorCSSVariables = generateCSSVariables();

// =============================================================================
// Base Editor Content Styles
// =============================================================================

/**
 * Base editor content styles.
 * Typography, spacing, and prose formatting matching DocViewer.
 *
 * ZOOM: Uses transform: scale() on parent container (via useEditorViewport).
 * This scales ALL content uniformly including headings, images, code blocks.
 * No CSS variable font-size manipulation needed.
 */
export const editorContentStyles = `
  /* CSS Custom Properties */
  ${editorCSSVariables}

  .tmnl-editor-content {
    padding: ${spacing[6]};
    min-height: 200px;
    height: 100%;
    color: ${editorTheme.prose.body};
    font-family: ${typography.fontFamily.sans};
    font-size: ${typography.fontSize.base};
    line-height: ${typography.lineHeight.relaxed};
    outline: none;
  }

  /* Ensure ProseMirror fills container */
  .tmnl-editor-content.ProseMirror {
    height: 100%;
    min-height: 100%;
  }

  .tiptap.ProseMirror {
    height: 100%;
    min-height: 100%;
  }

  .tmnl-editor-content:focus {
    outline: none;
  }

  /* =========================================================================
   * Paragraphs
   * ========================================================================= */

  .tmnl-editor-content p {
    color: ${editorTheme.prose.body};
    line-height: ${typography.lineHeight.relaxed};
    margin-bottom: ${spacing[3]};
  }

  .tmnl-editor-content p:last-child {
    margin-bottom: 0;
  }

  /* =========================================================================
   * Headings
   *
   * Key distinctions from bold text:
   * - Larger font sizes
   * - Bolder weight (700 for h1/h2 vs 600 for bold)
   * - Letter-spacing for h1/h2
   * - Teal accent for h1
   * - More vertical spacing
   * ========================================================================= */

  .tmnl-editor-content h1,
  .tmnl-editor-content h2,
  .tmnl-editor-content h3,
  .tmnl-editor-content h4,
  .tmnl-editor-content h5,
  .tmnl-editor-content h6 {
    color: ${editorTheme.prose.heading};
    line-height: ${typography.lineHeight.tight};
    margin-top: ${spacing[8]};
    margin-bottom: ${spacing[4]};
    font-weight: ${typography.fontWeight.bold};
    position: relative;
  }

  .tmnl-editor-content h1:first-child,
  .tmnl-editor-content h2:first-child,
  .tmnl-editor-content h3:first-child {
    margin-top: 0;
  }

  /* H1: Document title - largest, teal accent, subtle underline */
  .tmnl-editor-content h1 {
    font-size: 2em; /* 2x base size (scales with transform zoom) */
    font-weight: ${typography.fontWeight.bold};
    letter-spacing: -0.02em;
    color: #f5f5f5;
    padding-bottom: ${spacing[3]};
    border-bottom: 1px solid ${editorTheme.surface.border};
    margin-bottom: ${spacing[6]};
  }

  /* Teal accent bar for h1 */
  .tmnl-editor-content h1::before {
    content: '';
    position: absolute;
    left: 0;
    bottom: -1px;
    width: 3rem;
    height: 2px;
    background: ${editorTheme.text.accent};
  }

  /* H2: Section heading - large, bold, slightly tinted */
  .tmnl-editor-content h2 {
    font-size: 1.5em; /* 1.5x base size */
    font-weight: ${typography.fontWeight.bold};
    letter-spacing: -0.01em;
    color: #e5e5e5;
    margin-top: ${spacing[10]};
    padding-top: ${spacing[4]};
    border-top: 1px solid ${editorTheme.surface.borderSubtle};
  }

  /* H3: Subsection - medium, semibold, muted color */
  .tmnl-editor-content h3 {
    font-size: 1.25em; /* 1.25x base size */
    font-weight: ${typography.fontWeight.semibold};
    color: #d4d4d4;
    margin-top: ${spacing[8]};
    margin-bottom: ${spacing[3]};
  }

  /* H4-H6: Minor headings - smaller, text color variations */
  .tmnl-editor-content h4 {
    font-size: 1.125em; /* 1.125x base size */
    font-weight: ${typography.fontWeight.semibold};
    color: #a3a3a3;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tmnl-editor-content h5 {
    font-size: 1em; /* Same as base */
    font-weight: ${typography.fontWeight.semibold};
    color: #a3a3a3;
  }

  .tmnl-editor-content h6 {
    font-size: 0.875em; /* 0.875x base size */
    font-weight: ${typography.fontWeight.medium};
    color: #737373;
  }

  /* =========================================================================
   * Inline Styles
   * ========================================================================= */

  .tmnl-editor-content strong {
    color: ${editorTheme.prose.strong};
    font-weight: ${typography.fontWeight.semibold};
    /* Slightly brighter than body text but NOT as bright as headings */
    color: #e5e5e5;
  }

  .tmnl-editor-content em {
    font-style: italic;
  }

  /* =========================================================================
   * Inline Code
   * ========================================================================= */

  .tmnl-editor-content code {
    font-family: ${typography.fontFamily.mono};
    font-size: 0.875em; /* Slightly smaller than surrounding text */
    background: ${editorTheme.prose.codeBackground};
    color: ${editorTheme.prose.code};
    padding: 0.125em 0.375em;
    border-radius: ${borderRadius.sm};
  }

  /* =========================================================================
   * Code Blocks
   * ========================================================================= */

  .tmnl-editor-content pre {
    background: ${editorTheme.codeBlock.background};
    border: 1px solid ${editorTheme.codeBlock.border};
    border-radius: ${borderRadius.lg};
    margin: ${spacing[4]} 0;
    overflow: hidden;
  }

  .tmnl-editor-content pre code {
    display: block;
    padding: ${spacing[4]};
    background: none;
    color: inherit;
    font-size: 0.85em; /* Slightly smaller for code blocks */
    line-height: ${typography.lineHeight.normal};
    overflow-x: auto;
  }

  /* Code block with header (language label) */
  .tmnl-editor-content .code-block {
    border-radius: ${borderRadius.lg};
    overflow: hidden;
    border: 1px solid ${editorTheme.codeBlock.border};
    margin: ${spacing[4]} 0;
  }

  .tmnl-editor-content .code-block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${spacing[2]} ${spacing[4]};
    background: ${editorTheme.codeBlock.headerBackground};
    border-bottom: 1px solid ${editorTheme.codeBlock.border};
  }

  .tmnl-editor-content .code-block-language {
    font-family: ${typography.fontFamily.mono};
    font-size: 0.75em; /* Small label */
    color: ${editorTheme.codeBlock.languageLabel};
  }

  .tmnl-editor-content .code-block-filename {
    font-family: ${typography.fontFamily.mono};
    font-size: 0.75em; /* Small label */
    color: ${editorTheme.codeBlock.filename};
    margin-left: ${spacing[2]};
  }

  .tmnl-editor-content .code-block-copy {
    font-size: 0.75em; /* Small button */
    color: ${editorTheme.text.muted};
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .tmnl-editor-content .code-block-copy:hover {
    color: ${editorTheme.text.secondary};
  }

  /* =========================================================================
   * Blockquotes
   * ========================================================================= */

  .tmnl-editor-content blockquote {
    border-left: 3px solid ${editorTheme.prose.blockquoteBorder};
    margin: ${spacing[4]} 0;
    padding-left: ${spacing[4]};
    color: ${editorTheme.prose.blockquoteText};
    font-style: italic;
  }

  .tmnl-editor-content blockquote p {
    color: inherit;
  }

  /* =========================================================================
   * Lists
   * ========================================================================= */

  .tmnl-editor-content ul,
  .tmnl-editor-content ol {
    padding-left: ${spacing[6]};
    margin: ${spacing[3]} 0;
    color: ${editorTheme.prose.body};
  }

  .tmnl-editor-content ul {
    list-style-type: disc;
  }

  .tmnl-editor-content ol {
    list-style-type: decimal;
  }

  .tmnl-editor-content li {
    margin: ${spacing[1]} 0;
    /* font-size inherited from parent (scales with zoom) */
    line-height: ${typography.lineHeight.relaxed};
  }

  .tmnl-editor-content li::marker {
    color: ${editorTheme.prose.listMarker};
  }

  .tmnl-editor-content li p {
    margin: 0;
    display: inline;
  }

  /* Nested lists */
  .tmnl-editor-content ul ul,
  .tmnl-editor-content ol ol,
  .tmnl-editor-content ul ol,
  .tmnl-editor-content ol ul {
    margin: ${spacing[1]} 0;
  }

  /* Task lists */
  .tmnl-editor-content ul[data-type="taskList"] {
    list-style: none;
    padding-left: 0;
  }

  .tmnl-editor-content ul[data-type="taskList"] li {
    display: flex;
    align-items: flex-start;
    gap: ${spacing[2]};
  }

  .tmnl-editor-content ul[data-type="taskList"] li > label {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .tmnl-editor-content ul[data-type="taskList"] li[data-checked="true"] > div {
    text-decoration: line-through;
    color: ${editorTheme.text.muted};
  }

  /* =========================================================================
   * Tables
   * ========================================================================= */

  .tmnl-editor-content table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid ${editorTheme.table.border};
    border-radius: ${borderRadius.lg};
    overflow: hidden;
    margin: ${spacing[4]} 0;
  }

  .tmnl-editor-content th {
    padding: ${spacing[2]} ${spacing[4]};
    background: ${editorTheme.table.headerBackground};
    text-align: left;
    font-size: 0.875em; /* Slightly smaller for table headers */
    font-weight: ${typography.fontWeight.medium};
    color: ${editorTheme.table.headerText};
    border-bottom: 1px solid ${editorTheme.table.border};
  }

  .tmnl-editor-content td {
    padding: ${spacing[2]} ${spacing[4]};
    /* font-size inherited (scales with zoom) */
    color: ${editorTheme.table.cellText};
    border-bottom: 1px solid ${editorTheme.table.borderSubtle};
  }

  .tmnl-editor-content tr:last-child td {
    border-bottom: none;
  }

  .tmnl-editor-content th p,
  .tmnl-editor-content td p {
    margin: 0;
  }

  /* =========================================================================
   * Horizontal Rule
   * ========================================================================= */

  .tmnl-editor-content hr {
    border: none;
    border-top: 1px solid ${editorTheme.prose.hr};
    margin: ${spacing[8]} 0;
  }

  /* =========================================================================
   * Links
   * ========================================================================= */

  .tmnl-editor-content a {
    color: ${editorTheme.text.link};
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.15s ease;
  }

  .tmnl-editor-content a:hover {
    color: ${editorTheme.text.linkHover};
  }

  /* =========================================================================
   * Images
   * ========================================================================= */

  .tmnl-editor-content img {
    max-width: 100%;
    height: auto;
    border-radius: ${borderRadius.lg};
    margin: ${spacing[4]} 0;
  }

  /* =========================================================================
   * Placeholder
   * ========================================================================= */

  .tmnl-editor-content p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: ${editorTheme.editor.placeholder};
    float: left;
    height: 0;
    pointer-events: none;
  }

  /* =========================================================================
   * Selection
   * ========================================================================= */

  .tmnl-editor-content ::selection {
    background: ${editorTheme.editor.selection};
    color: ${editorTheme.editor.selectionText};
  }

  /* =========================================================================
   * Focus Ring (for accessibility)
   * ========================================================================= */

  .tmnl-editor-content:focus-visible {
    outline: 2px solid ${editorTheme.text.accent};
    outline-offset: 2px;
  }
`;

// =============================================================================
// Collaborative Editor Styles
// =============================================================================

/**
 * Collaborative editor specific styles.
 * Extends base styles with collab-specific indicators.
 */
export const collaborativeEditorStyles = `
  .tmnl-collab-editor {
    padding: ${spacing[6]};
    min-height: 200px;
    height: 100%;
    color: ${editorTheme.prose.body};
    font-family: ${typography.fontFamily.sans};
    font-size: ${typography.fontSize.base};
    line-height: ${typography.lineHeight.relaxed};
    outline: none;
  }

  .tmnl-collab-editor:focus {
    outline: none;
  }

  /* Ensure editor content wrapper fills container */
  [data-tmnl-editor] .tiptap {
    height: 100%;
    min-height: 100%;
  }

  /* Connected indicator */
  .tmnl-collab-editor[data-connected="true"]::after {
    content: '';
    position: absolute;
    top: 8px;
    right: 8px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${editorTheme.text.accent};
    box-shadow: 0 0 4px ${editorTheme.text.accent};
  }
`;

// =============================================================================
// Table of Contents Styles
// =============================================================================

/**
 * Table of Contents sidebar styles.
 * Matches the DocViewer TOC navigation.
 */
export const tableOfContentsStyles = `
  .tmnl-editor-toc {
    width: 14rem; /* w-56 */
    flex-shrink: 0;
    border-right: 1px solid ${editorTheme.surface.border};
    padding: ${spacing[4]};
    overflow-y: auto;
  }

  .tmnl-editor-toc-nav {
    display: flex;
    flex-direction: column;
    gap: ${spacing[1]};
  }

  .tmnl-editor-toc-item {
    display: block;
    padding: ${spacing[2]} ${spacing[3]};
    font-size: 0.875rem; /* TOC is outside editor, fixed size */
    color: ${editorTheme.text.muted};
    border-radius: ${borderRadius.md};
    text-decoration: none;
    transition: all 0.15s ease;
    cursor: pointer;
    border: none;
    background: none;
    text-align: left;
    width: 100%;
  }

  .tmnl-editor-toc-item:hover {
    color: ${editorTheme.text.secondary};
    background: ${editorTheme.surface.secondary}80;
  }

  .tmnl-editor-toc-item.active {
    background: ${editorTheme.text.accent}1a;
    color: ${editorTheme.text.accent};
    border-left: 2px solid ${editorTheme.text.accent};
    padding-left: calc(${spacing[3]} - 2px);
  }

  /* Heading levels */
  .tmnl-editor-toc-item[data-level="2"] {
    padding-left: ${spacing[6]};
  }

  .tmnl-editor-toc-item[data-level="3"] {
    padding-left: ${spacing[8]};
    font-size: 0.75rem; /* TOC is outside editor, fixed size */
  }
`;

// =============================================================================
// Editor Header Styles
// =============================================================================

/**
 * Sticky header styles for document metadata.
 */
export const editorHeaderStyles = `
  .tmnl-editor-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: ${editorTheme.surface.background}f2; /* 95% opacity */
    backdrop-filter: blur(8px);
    border-bottom: 1px solid ${editorTheme.surface.border};
    padding: ${spacing[6]} ${spacing[8]};
  }

  .tmnl-editor-header-meta {
    display: flex;
    align-items: center;
    gap: ${spacing[3]};
    margin-bottom: ${spacing[2]};
  }

  .tmnl-editor-header-badge {
    padding: ${spacing[0.5]} ${spacing[2]};
    font-size: ${typography.fontSize.xs};
    font-weight: ${typography.fontWeight.medium};
    border-radius: ${borderRadius.sm};
  }

  .tmnl-editor-header-date {
    font-size: ${typography.fontSize.xs};
    font-family: ${typography.fontFamily.mono};
    color: ${editorTheme.text.subtle};
  }

  .tmnl-editor-header-title {
    font-size: ${typography.fontSize['2xl']};
    font-weight: ${typography.fontWeight.bold};
    color: ${editorTheme.prose.heading};
    margin: 0;
  }

  .tmnl-editor-header-description {
    color: ${editorTheme.text.muted};
    margin-top: ${spacing[2]};
    margin-bottom: 0;
  }
`;

// =============================================================================
// Combined Styles Export
// =============================================================================

/**
 * All editor styles combined.
 * Inject this into a single <style> tag.
 */
export const allEditorStyles = `
  ${editorContentStyles}
  ${collaborativeEditorStyles}
  ${tableOfContentsStyles}
  ${editorHeaderStyles}
  ${blockHandleStyles}
  ${columnLayoutStyles}
`;
