/**
 * CodeBlockHighlight Extension
 *
 * TipTap extension for syntax-highlighted code blocks using lowlight.
 * Matches the DocViewer code block styling with oneDark theme.
 *
 * @module editor/v3/extensions/CodeBlockHighlight
 */

import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

// =============================================================================
// Lowlight Instance
// =============================================================================

/**
 * Create a lowlight instance with common languages.
 * This includes: javascript, typescript, python, json, html, css, bash, etc.
 */
export const lowlight = createLowlight(common);

// =============================================================================
// Additional Languages
// =============================================================================

/**
 * Register additional languages as needed.
 * Import language definitions from highlight.js and register them:
 *
 * @example
 * ```ts
 * import rust from 'highlight.js/lib/languages/rust';
 * lowlight.register('rust', rust);
 * ```
 */

// =============================================================================
// Code Block Extension
// =============================================================================

/**
 * Default language for code blocks without a specified language.
 */
export const DEFAULT_CODE_LANGUAGE = 'plaintext';

/**
 * CodeBlockHighlight
 *
 * Preconfigured CodeBlockLowlight extension with:
 * - Common language support
 * - Default language fallback
 * - Custom CSS classes for styling
 *
 * @example
 * ```tsx
 * import { useEditor } from '@tiptap/react';
 * import StarterKit from '@tiptap/starter-kit';
 * import { CodeBlockHighlight } from '@/lib/editor/v3/extensions';
 *
 * const editor = useEditor({
 *   extensions: [
 *     StarterKit.configure({
 *       codeBlock: false, // Disable default code block
 *     }),
 *     CodeBlockHighlight,
 *   ],
 * });
 * ```
 */
export const CodeBlockHighlight = CodeBlockLowlight.configure({
  lowlight,
  defaultLanguage: DEFAULT_CODE_LANGUAGE,
  HTMLAttributes: {
    class: 'tmnl-code-block',
  },
});

// =============================================================================
// CSS Styles for Syntax Highlighting
// =============================================================================

/**
 * oneDark-inspired syntax highlighting CSS.
 * These classes are applied by lowlight/highlight.js.
 */
export const codeBlockHighlightStyles = `
  /* Code block container */
  .tmnl-code-block {
    position: relative;
    margin: 1rem 0;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid #262626;
    background: rgb(23, 23, 23);
  }

  .tmnl-code-block pre {
    margin: 0;
    padding: 1rem;
    overflow-x: auto;
    background: transparent;
    border: none;
  }

  .tmnl-code-block code {
    font-family: "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace;
    font-size: 0.8125rem;
    line-height: 1.5;
    background: transparent;
    padding: 0;
    color: #abb2bf;
  }

  /* =========================================================================
   * oneDark Theme Colors
   * ========================================================================= */

  /* Keywords: if, else, return, function, class, const, let, etc. */
  .tmnl-code-block .hljs-keyword,
  .tmnl-code-block .hljs-selector-tag,
  .tmnl-code-block .hljs-literal,
  .tmnl-code-block .hljs-section,
  .tmnl-code-block .hljs-link {
    color: #c678dd;
  }

  /* Functions */
  .tmnl-code-block .hljs-function,
  .tmnl-code-block .hljs-title.function_ {
    color: #61afef;
  }

  /* Strings */
  .tmnl-code-block .hljs-string,
  .tmnl-code-block .hljs-meta .hljs-string,
  .tmnl-code-block .hljs-doctag,
  .tmnl-code-block .hljs-regexp {
    color: #98c379;
  }

  /* Numbers */
  .tmnl-code-block .hljs-number,
  .tmnl-code-block .hljs-literal {
    color: #d19a66;
  }

  /* Variables, params */
  .tmnl-code-block .hljs-variable,
  .tmnl-code-block .hljs-params,
  .tmnl-code-block .hljs-template-variable {
    color: #e06c75;
  }

  /* Class names, types */
  .tmnl-code-block .hljs-title,
  .tmnl-code-block .hljs-class .hljs-title,
  .tmnl-code-block .hljs-type,
  .tmnl-code-block .hljs-built_in {
    color: #e5c07b;
  }

  /* Comments */
  .tmnl-code-block .hljs-comment,
  .tmnl-code-block .hljs-quote {
    color: #5c6370;
    font-style: italic;
  }

  /* Attributes (HTML, XML) */
  .tmnl-code-block .hljs-attr,
  .tmnl-code-block .hljs-attribute {
    color: #d19a66;
  }

  /* Tags (HTML, XML) */
  .tmnl-code-block .hljs-tag,
  .tmnl-code-block .hljs-name {
    color: #e06c75;
  }

  /* Operators */
  .tmnl-code-block .hljs-operator,
  .tmnl-code-block .hljs-punctuation {
    color: #abb2bf;
  }

  /* Special */
  .tmnl-code-block .hljs-meta,
  .tmnl-code-block .hljs-meta .hljs-keyword {
    color: #61afef;
  }

  /* Emphasis */
  .tmnl-code-block .hljs-emphasis {
    font-style: italic;
  }

  .tmnl-code-block .hljs-strong {
    font-weight: bold;
  }

  /* Deletion/Addition (diff) */
  .tmnl-code-block .hljs-deletion {
    color: #e06c75;
    background-color: rgba(224, 108, 117, 0.15);
  }

  .tmnl-code-block .hljs-addition {
    color: #98c379;
    background-color: rgba(152, 195, 121, 0.15);
  }

  /* Symbol */
  .tmnl-code-block .hljs-symbol,
  .tmnl-code-block .hljs-bullet {
    color: #56b6c2;
  }

  /* Selector (CSS) */
  .tmnl-code-block .hljs-selector-class,
  .tmnl-code-block .hljs-selector-id {
    color: #e5c07b;
  }

  .tmnl-code-block .hljs-selector-pseudo,
  .tmnl-code-block .hljs-selector-attr {
    color: #c678dd;
  }

  /* =========================================================================
   * Language Label (optional, via node view)
   * ========================================================================= */

  .tmnl-code-block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    background: #171717;
    border-bottom: 1px solid #262626;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.75rem;
  }

  .tmnl-code-block-language {
    color: #2dd4bf;
    text-transform: lowercase;
  }

  .tmnl-code-block-copy {
    color: #a3a3a3;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    transition: all 0.15s ease;
  }

  .tmnl-code-block-copy:hover {
    color: #e5e5e5;
    background: #262626;
  }

  .tmnl-code-block-copy.copied {
    color: #4ade80;
  }
`;

// =============================================================================
// Exports
// =============================================================================

export default CodeBlockHighlight;
