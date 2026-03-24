/**
 * TMNL Variables v2 — Configuration
 *
 * This is the "config.el" equivalent — a declarative file that defines
 * all variables. Import this file at startup to register variables.
 *
 * Variables are accessed at RUNTIME by string ID — no need to import
 * individual variable definitions.
 *
 * @example
 * ```typescript
 * // main.tsx — Import config once at startup
 * import '@/lib/variables/v2/config'
 *
 * // Anywhere else — Access by string ID (no import needed!)
 * const tabWidth = yield* Variable.get('editor.tabWidth')
 * ```
 */

import { Schema } from 'effect';
import { Variable } from './index';

// ─────────────────────────────────────────────────────────────────────────────
// Editor Variables
// ─────────────────────────────────────────────────────────────────────────────

// Indentation
Variable.define({
  id: 'editor.tabWidth',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)),
  default: 4,
  description: 'Number of spaces per tab character',
});

Variable.define({
  id: 'editor.insertSpaces',
  schema: Schema.Boolean,
  default: true,
  description: 'Insert spaces when pressing Tab',
});

Variable.define({
  id: 'editor.detectIndentation',
  schema: Schema.Boolean,
  default: true,
  description: 'Automatically detect indentation from file content',
});

// Display
Variable.define({
  id: 'editor.fontSize',
  schema: Schema.Number.pipe(Schema.between(8, 72)),
  default: 14,
  description: 'Font size in pixels',
});

Variable.define({
  id: 'editor.fontFamily',
  schema: Schema.String.pipe(Schema.minLength(1)),
  default: 'JetBrains Mono, Fira Code, Consolas, monospace',
  description: 'Font family for editor text',
});

Variable.define({
  id: 'editor.lineHeight',
  schema: Schema.Number.pipe(Schema.between(1, 3)),
  default: 1.5,
  description: 'Line height multiplier',
});

Variable.define({
  id: 'editor.wordWrap',
  schema: Schema.Literal('off', 'on', 'wordWrapColumn', 'bounded'),
  default: 'off',
  description: 'How to wrap long lines',
});

Variable.define({
  id: 'editor.wordWrapColumn',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(40, 200)),
  default: 80,
  description: 'Column at which to wrap lines',
});

// Cursor
Variable.define({
  id: 'editor.cursorStyle',
  schema: Schema.Literal(
    'line',
    'block',
    'underline',
    'line-thin',
    'block-outline',
    'underline-thin'
  ),
  default: 'line',
  description: 'Cursor style',
});

Variable.define({
  id: 'editor.cursorBlinking',
  schema: Schema.Literal('blink', 'smooth', 'phase', 'expand', 'solid'),
  default: 'blink',
  description: 'Cursor blinking animation style',
});

Variable.define({
  id: 'editor.cursorWidth',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
  default: 2,
  description: 'Cursor width in pixels (for line cursor)',
});

// Minimap
Variable.define({
  id: 'editor.minimap.enabled',
  schema: Schema.Boolean,
  default: true,
  description: 'Show minimap',
});

Variable.define({
  id: 'editor.minimap.side',
  schema: Schema.Literal('left', 'right'),
  default: 'right',
  description: 'Minimap position',
});

Variable.define({
  id: 'editor.minimap.maxColumn',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(40, 200)),
  default: 120,
  description: 'Maximum column width for minimap',
});

// Scrolling
Variable.define({
  id: 'editor.smoothScrolling',
  schema: Schema.Boolean,
  default: true,
  description: 'Enable smooth scrolling animation',
});

Variable.define({
  id: 'editor.scrollBeyondLastLine',
  schema: Schema.Boolean,
  default: true,
  description: 'Allow scrolling past the last line',
});

// Rendering
Variable.define({
  id: 'editor.renderWhitespace',
  schema: Schema.Literal('none', 'boundary', 'selection', 'trailing', 'all'),
  default: 'selection',
  description: 'When to render whitespace characters',
});

Variable.define({
  id: 'editor.renderLineHighlight',
  schema: Schema.Literal('none', 'gutter', 'line', 'all'),
  default: 'line',
  description: 'How to highlight the current line',
});

Variable.define({
  id: 'editor.lineNumbers',
  schema: Schema.Literal('off', 'on', 'relative', 'interval'),
  default: 'on',
  description: 'Line number display mode',
});

// Auto-features
Variable.define({
  id: 'editor.autoClosingBrackets',
  schema: Schema.Literal(
    'always',
    'languageDefined',
    'beforeWhitespace',
    'never'
  ),
  default: 'languageDefined',
  description: 'When to auto-close brackets',
});

Variable.define({
  id: 'editor.autoClosingQuotes',
  schema: Schema.Literal(
    'always',
    'languageDefined',
    'beforeWhitespace',
    'never'
  ),
  default: 'languageDefined',
  description: 'When to auto-close quotes',
});

Variable.define({
  id: 'editor.autoIndent',
  schema: Schema.Literal('none', 'keep', 'brackets', 'advanced', 'full'),
  default: 'full',
  description: 'Auto-indentation mode',
});

// ─────────────────────────────────────────────────────────────────────────────
// Appearance Variables
// ─────────────────────────────────────────────────────────────────────────────

Variable.define({
  id: 'appearance.theme',
  schema: Schema.Literal('light', 'dark', 'system'),
  default: 'dark',
  description: 'Color theme',
});

Variable.define({
  id: 'appearance.accentColor',
  schema: Schema.String.pipe(Schema.pattern(/^#[0-9a-fA-F]{6}$/)),
  default: '#00ffcc',
  description: 'Accent color (hex)',
});

Variable.define({
  id: 'appearance.iconTheme',
  schema: Schema.String,
  default: 'default',
  description: 'Icon theme',
});

// ─────────────────────────────────────────────────────────────────────────────
// Layout Variables
// ─────────────────────────────────────────────────────────────────────────────

// Sidebar
Variable.define({
  id: 'layout.sidebar.collapsed',
  group: 'layout',
  schema: Schema.Boolean,
  default: false,
  description: 'Whether sidebar starts collapsed',
});

Variable.define({
  id: 'layout.sidebar.collapsedWidth',
  group: 'layout',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(32, 96)),
  default: 48,
  description: 'Width of collapsed sidebar in pixels',
});

Variable.define({
  id: 'layout.sidebar.expandedWidth',
  group: 'layout',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(160, 480)),
  default: 256,
  description: 'Width of expanded sidebar in pixels',
});

Variable.define({
  id: 'layout.sidebar.side',
  group: 'layout',
  schema: Schema.Literal('left', 'right'),
  default: 'left',
  description: 'Which side the sidebar appears on',
});

// Drawers
Variable.define({
  id: 'layout.drawer.defaultWidth',
  group: 'layout',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(200, 800)),
  default: 400,
  description: 'Default width for side drawers in pixels',
});

Variable.define({
  id: 'layout.drawer.defaultHeight',
  group: 'layout',
  schema: Schema.String.pipe(Schema.minLength(1)),
  default: '50%',
  description: 'Default height for top/bottom drawers (px or %)',
});

Variable.define({
  id: 'layout.drawer.showBackdrop',
  group: 'layout',
  schema: Schema.Boolean,
  default: true,
  description: 'Show backdrop overlay when drawer is open',
});

Variable.define({
  id: 'layout.drawer.closeOnOverlayClick',
  group: 'layout',
  schema: Schema.Boolean,
  default: true,
  description: 'Close drawer when clicking backdrop',
});

// Top Bar
Variable.define({
  id: 'layout.topBar.height',
  group: 'layout',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(32, 96)),
  default: 56,
  description: 'Height of top bar in pixels',
});

Variable.define({
  id: 'layout.topBar.visible',
  group: 'layout',
  schema: Schema.Boolean,
  default: true,
  description: 'Whether top bar is visible',
});

Variable.define({
  id: 'layout.topBar.autoHide',
  group: 'layout',
  schema: Schema.Boolean,
  default: false,
  description: 'Auto-hide top bar on scroll',
});

Variable.define({
  id: 'layout.topBar.transparent',
  group: 'layout',
  schema: Schema.Boolean,
  default: false,
  description: 'Transparent top bar background',
});

// Status Bar
Variable.define({
  id: 'layout.statusBar.visible',
  group: 'layout',
  schema: Schema.Boolean,
  default: true,
  description: 'Whether status bar is visible',
});

Variable.define({
  id: 'layout.statusBar.position',
  group: 'layout',
  schema: Schema.Literal('bottom', 'top'),
  default: 'bottom',
  description: 'Status bar position',
});

// ─────────────────────────────────────────────────────────────────────────────
// Debug Variables
// ─────────────────────────────────────────────────────────────────────────────

Variable.define({
  id: 'debug.showFPS',
  schema: Schema.Boolean,
  default: false,
  description: 'Show FPS counter',
});

Variable.define({
  id: 'debug.showMemory',
  schema: Schema.Boolean,
  default: false,
  description: 'Show memory usage',
});

Variable.define({
  id: 'debug.logLevel',
  schema: Schema.Literal('none', 'error', 'warn', 'info', 'debug', 'trace'),
  default: 'warn',
  description: 'Console log level',
});

// ─────────────────────────────────────────────────────────────────────────────
// File Index Variables
// ─────────────────────────────────────────────────────────────────────────────

Variable.define({
  id: 'fileIndex.scanRoot',
  group: 'fileIndex',
  schema: Schema.String.pipe(Schema.minLength(1)),
  default:
    '/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl',
  description: 'Root directory for file discovery (like Obsidian vault path)',
});

Variable.define({
  id: 'fileIndex.autoScan',
  group: 'fileIndex',
  schema: Schema.Boolean,
  default: false,
  description: 'Automatically scan on application start',
});

Variable.define({
  id: 'fileIndex.extensions',
  group: 'fileIndex',
  schema: Schema.String,
  default: 'md,mdx',
  description: 'Comma-separated file extensions to index',
});

Variable.define({
  id: 'fileIndex.maxDepth',
  group: 'fileIndex',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(1, 50)),
  default: 10,
  description: 'Maximum directory depth for scanning',
});

// ─────────────────────────────────────────────────────────────────────────────
// Export count for verification
// ─────────────────────────────────────────────────────────────────────────────

/** Number of variables defined in config */
export const VARIABLE_COUNT = Variable.list().length;

// Log registration on import
if (typeof window !== 'undefined') {
  // ${VARIABLE_COUNT} variables registered
}
