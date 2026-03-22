/**
 * Document Extension
 *
 * Root node for the editor. Required for any TipTap editor.
 *
 * @module editor/v3/extensions/blocks/Document
 */

import { Node } from '@tiptap/core';

export interface DocumentOptions {
  /** Custom document node name */
  name?: string;
}

export const Document = Node.create<DocumentOptions>({
  name: 'doc',

  topNode: true,

  content: 'block+',
});
