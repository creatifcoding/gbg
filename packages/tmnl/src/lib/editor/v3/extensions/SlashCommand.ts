/**
 * SlashCommand Extension
 *
 * Custom slash command implementation using @tiptap/suggestion.
 * Replaces paid TipTap SlashDropdownMenu component.
 *
 * @module editor/v3/extensions/SlashCommand
 */

import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import type { Editor, Range } from '@tiptap/core';

// Custom plugin key to avoid conflicts
const SlashCommandPluginKey = new PluginKey('slashCommand');

// ============================================================================
// Types
// ============================================================================

export interface SlashMenuItem {
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly group:
    | 'Basic'
    | 'Headings'
    | 'Lists'
    | 'Blocks'
    | 'Media'
    | 'Advanced';
  readonly aliases: readonly string[];
  readonly command: (props: { editor: Editor; range: Range }) => void;
}

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashMenuItem>, 'editor'>;
}

// ============================================================================
// Slash Menu Items
// ============================================================================

export const SLASH_ITEMS: readonly SlashMenuItem[] = [
  // Basic
  {
    title: 'Text',
    description: 'Plain paragraph text',
    icon: 'Pilcrow',
    group: 'Basic',
    aliases: ['text', 'paragraph', 'p'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },

  // Headings
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'Heading1',
    group: 'Headings',
    aliases: ['h1', 'heading1', 'title'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'Heading2',
    group: 'Headings',
    aliases: ['h2', 'heading2', 'subtitle'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'Heading3',
    group: 'Headings',
    aliases: ['h3', 'heading3'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },

  // Lists
  {
    title: 'Bullet List',
    description: 'Unordered list with bullets',
    icon: 'List',
    group: 'Lists',
    aliases: ['bullet', 'ul', 'unordered', 'list'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Ordered list with numbers',
    icon: 'ListOrdered',
    group: 'Lists',
    aliases: ['numbered', 'ol', 'ordered'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Task List',
    description: 'Checklist with checkboxes',
    icon: 'ListTodo',
    group: 'Lists',
    aliases: ['todo', 'task', 'checklist', 'checkbox'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },

  // Blocks
  {
    title: 'Quote',
    description: 'Blockquote for citations',
    icon: 'Quote',
    group: 'Blocks',
    aliases: ['quote', 'blockquote', 'citation'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Code with syntax highlighting',
    icon: 'Code',
    group: 'Blocks',
    aliases: ['code', 'codeblock', 'pre'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Divider',
    description: 'Horizontal rule separator',
    icon: 'Minus',
    group: 'Blocks',
    aliases: ['divider', 'hr', 'horizontal', 'rule', 'separator'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: '2 Columns',
    description: 'Side-by-side layout',
    icon: 'Columns2',
    group: 'Blocks',
    aliases: ['columns', '2col', 'side-by-side', 'grid'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertColumnLayout({ columns: 2 }).run();
    },
  },
  {
    title: '3 Columns',
    description: 'Three column layout',
    icon: 'Columns3',
    group: 'Blocks',
    aliases: ['3col', 'triple', 'thirds'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertColumnLayout({ columns: 3 }).run();
    },
  },
  {
    title: '4 Columns',
    description: 'Four column layout',
    icon: 'LayoutGrid',
    group: 'Blocks',
    aliases: ['4col', 'quad', 'grid4', 'quarters'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertColumnLayout({ columns: 4 }).run();
    },
  },
  {
    title: '2 Rows',
    description: 'Stacked row layout',
    icon: 'Rows2',
    group: 'Blocks',
    aliases: ['rows', '2row', 'stacked', 'vertical'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertColumnLayout({ direction: 'row', columns: 2 }).run();
    },
  },
  {
    title: '3 Rows',
    description: 'Three row layout',
    icon: 'Rows3',
    group: 'Blocks',
    aliases: ['3row', 'triple-row', 'thirds-row'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertColumnLayout({ direction: 'row', columns: 3 }).run();
    },
  },
  {
    title: '4 Rows',
    description: 'Four row layout',
    icon: 'Rows4',
    group: 'Blocks',
    aliases: ['4row', 'quad-row'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertColumnLayout({ direction: 'row', columns: 4 }).run();
    },
  },

  // Media
  {
    title: 'Image',
    description: 'Insert an image',
    icon: 'Image',
    group: 'Media',
    aliases: ['image', 'img', 'picture', 'photo'],
    command: ({ editor, range }) => {
      const url = window.prompt('Enter image URL');
      if (url) {
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
      }
    },
  },

  // Advanced
  {
    title: 'Table',
    description: 'Basic table (markdown)',
    icon: 'Table',
    group: 'Advanced',
    aliases: ['table', 'markdown-table'],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3 })
        .run();
    },
  },
  {
    title: 'Data Grid',
    description: 'AG-Grid table with dataplane support',
    icon: 'Grid3x3',
    group: 'Advanced',
    aliases: ['datagrid', 'aggrid', 'datatable', 'spreadsheet', 'grid'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertDataGrid().run();
    },
  },
  {
    title: 'Callout',
    description: 'Callout block for notices',
    icon: 'AlertCircle',
    group: 'Advanced',
    aliases: ['callout', 'admonition', 'notice', 'info', 'warning'],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setCallout({ variant: 'info' })
        .run();
    },
  },
  {
    title: 'Map',
    description: 'Mapbox + deck.gl map',
    icon: 'MapPin',
    group: 'Advanced',
    aliases: ['map', 'mapbox', 'geo', 'location', 'deckgl'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertMap().run();
    },
  },
  {
    title: '3D Scene',
    description: 'Three.js 3D scene',
    icon: 'Box',
    group: 'Advanced',
    aliases: ['3d', 'scene', 'threejs', 'r3f', 'three', 'webgl'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertScene3D().run();
    },
  },
] as const;

// ============================================================================
// Extension
// ============================================================================

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        allowedPrefixes: null,
        items: ({ query }) => {
          const q = query.toLowerCase();
          return SLASH_ITEMS.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q) ||
              item.aliases.some((alias) => alias.includes(q))
          ).slice(0, 10);
        },
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: SlashCommandPluginKey,
        ...this.options.suggestion,
      }),
    ];
  },
});

// ============================================================================
// Helpers
// ============================================================================

/**
 * Group slash items by their group property
 */
export function groupSlashItems(
  items: readonly SlashMenuItem[]
): Map<string, SlashMenuItem[]> {
  const groups = new Map<string, SlashMenuItem[]>();

  for (const item of items) {
    const existing = groups.get(item.group) ?? [];
    groups.set(item.group, [...existing, item]);
  }

  return groups;
}

/**
 * Get the ordered group names
 */
export const SLASH_GROUPS = [
  'Basic',
  'Headings',
  'Lists',
  'Blocks',
  'Media',
  'Advanced',
] as const;
