/**
 * Editor Styles
 *
 * Shared CSS-in-JS styles for Tiptap editor components.
 * Used by both TiptapEditor and CollaborativeTiptapEditor.
 *
 * @module editor/v3/components/styles
 */

/**
 * Base editor content styles.
 * Typography, spacing, and basic formatting.
 */
export const editorContentStyles = `
  .tmnl-editor-content {
    padding: 1.5rem;
    min-height: 200px;
    color: var(--tmnl-text-primary, #e0e0e0);
    font-family: var(--tmnl-font-sans, system-ui, -apple-system, sans-serif);
    font-size: var(--tmnl-text-base, 16px);
    line-height: 1.6;
    outline: none;
  }

  .tmnl-editor-content:focus {
    outline: none;
  }

  /* Paragraphs */
  .tmnl-editor-content p {
    margin: 0 0 1em 0;
  }

  .tmnl-editor-content p:last-child {
    margin-bottom: 0;
  }

  /* Headings */
  .tmnl-editor-content h1,
  .tmnl-editor-content h2,
  .tmnl-editor-content h3,
  .tmnl-editor-content h4,
  .tmnl-editor-content h5,
  .tmnl-editor-content h6 {
    color: var(--tmnl-text-primary, #e0e0e0);
    margin: 1.5em 0 0.5em 0;
    line-height: 1.3;
  }

  .tmnl-editor-content h1 { font-size: 2em; }
  .tmnl-editor-content h2 { font-size: 1.5em; }
  .tmnl-editor-content h3 { font-size: 1.25em; }

  /* Inline styles */
  .tmnl-editor-content strong {
    font-weight: 600;
  }

  .tmnl-editor-content em {
    font-style: italic;
  }

  /* Code */
  .tmnl-editor-content code {
    font-family: var(--tmnl-font-mono, 'JetBrains Mono', monospace);
    font-size: 0.9em;
    background: var(--tmnl-surface-2, #2a2a2a);
    padding: 0.2em 0.4em;
    border-radius: 4px;
  }

  .tmnl-editor-content pre {
    background: var(--tmnl-surface-2, #2a2a2a);
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1em 0;
  }

  .tmnl-editor-content pre code {
    background: none;
    padding: 0;
  }

  /* Blockquote */
  .tmnl-editor-content blockquote {
    border-left: 3px solid var(--tmnl-accent-cyan, #4ecdc4);
    margin: 1em 0;
    padding-left: 1rem;
    color: var(--tmnl-text-secondary, #a0a0a0);
  }

  /* Lists */
  .tmnl-editor-content ul,
  .tmnl-editor-content ol {
    padding-left: 1.5rem;
    margin: 0.5em 0;
  }

  .tmnl-editor-content li {
    margin: 0.25em 0;
  }

  /* Horizontal rule */
  .tmnl-editor-content hr {
    border: none;
    border-top: 1px solid var(--tmnl-surface-3, #3a3a3a);
    margin: 2em 0;
  }

  /* Links */
  .tmnl-editor-content a {
    color: var(--tmnl-accent-cyan, #4ecdc4);
    text-decoration: none;
  }

  .tmnl-editor-content a:hover {
    text-decoration: underline;
  }

  /* Placeholder */
  .tmnl-editor-content p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: var(--tmnl-text-muted, #666);
    float: left;
    height: 0;
    pointer-events: none;
  }

  /* Selection */
  .tmnl-editor-content ::selection {
    background: var(--tmnl-accent-cyan, #4ecdc4);
    color: var(--tmnl-surface-0, #1a1a1a);
  }
`;

/**
 * Collaborative editor specific styles.
 * Extends base styles with collab-specific class.
 */
export const collaborativeEditorStyles = `
  .tmnl-collab-editor {
    padding: 1.5rem;
    min-height: 200px;
    color: var(--tmnl-text-primary, #e0e0e0);
    font-family: var(--tmnl-font-sans, system-ui, -apple-system, sans-serif);
    font-size: var(--tmnl-text-base, 16px);
    line-height: 1.6;
    outline: none;
  }

  .tmnl-collab-editor:focus {
    outline: none;
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
    background: var(--tmnl-status-success, #4ade80);
    box-shadow: 0 0 4px var(--tmnl-status-success, #4ade80);
  }
`;
