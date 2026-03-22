/**
 * Text Extension
 *
 * Inline text node. Required for any text content.
 *
 * @module editor/v3/extensions/blocks/Text
 */

import { Node } from '@tiptap/core';

export interface TextOptions {
  /** Custom text node name */
  name?: string;
}

export const Text = Node.create<TextOptions>({
  name: 'text',

  group: 'inline',
});
