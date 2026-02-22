/**
 * FilterSyncPlugin
 *
 * TipTap plugin that synchronizes annotation visibility atoms
 * with ProseMirror mark decorations.
 *
 * When visibleMarkIdsAtom changes:
 * 1. Updates data-hidden attribute on non-visible marks
 * 2. Triggers CSS transitions for smooth hide/show
 *
 * @module editor/v3/extensions/annotations/plugins/FilterSyncPlugin
 */

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { visibleMarkIdsAtom, marksAtom, annotationRegistry } from '../atoms';
import type { AnnotationId } from '../schemas';

// =============================================================================
// Plugin Key
// =============================================================================

export const filterSyncPluginKey = new PluginKey<FilterSyncPluginState>('annotationFilterSync');

// =============================================================================
// Plugin State
// =============================================================================

interface FilterSyncPluginState {
  visibleIds: Set<AnnotationId>;
  decorations: DecorationSet;
}

// =============================================================================
// Plugin Factory
// =============================================================================

export interface FilterSyncPluginOptions {
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: Set<AnnotationId>, hidden: Set<AnnotationId>) => void;
}

export function createFilterSyncPlugin(options: FilterSyncPluginOptions = {}): Plugin {
  return new Plugin<FilterSyncPluginState>({
    key: filterSyncPluginKey,

    state: {
      init(_, state) {
        const visibleIds = Atom.get(visibleMarkIdsAtom);
        const marks = Atom.get(marksAtom);
        const decorations = buildDecorations(state.doc, marks, visibleIds);

        return {
          visibleIds,
          decorations,
        };
      },

      apply(tr, pluginState, _oldState, newState) {
        // Check if we need to update decorations
        const visibleIds = Atom.get(visibleMarkIdsAtom);
        const marks = Atom.get(marksAtom);

        // Compare sets
        const changed = !setsEqual(pluginState.visibleIds, visibleIds);

        if (changed || tr.docChanged) {
          const decorations = buildDecorations(newState.doc, marks, visibleIds);

          // Notify callback
          if (changed && options.onVisibilityChange) {
            const hidden = new Set<AnnotationId>();
            for (const [id] of marks) {
              if (!visibleIds.has(id)) {
                hidden.add(id);
              }
            }
            options.onVisibilityChange(visibleIds, hidden);
          }

          return {
            visibleIds,
            decorations,
          };
        }

        // Map decorations through transaction if doc changed
        if (tr.docChanged) {
          return {
            ...pluginState,
            decorations: pluginState.decorations.map(tr.mapping, tr.doc),
          };
        }

        return pluginState;
      },
    },

    props: {
      decorations(state) {
        const pluginState = filterSyncPluginKey.getState(state);
        return pluginState?.decorations ?? DecorationSet.empty;
      },
    },

    view(editorView) {
      // Subscribe to atom changes and force update
      let unsubscribe: (() => void) | undefined;

      // Set up subscription after initial render
      queueMicrotask(() => {
        unsubscribe = annotationRegistry.subscribe(visibleMarkIdsAtom, () => {
          // Force plugin state update by dispatching empty transaction
          const { state, dispatch } = editorView;
          const tr = state.tr.setMeta(filterSyncPluginKey, { forceUpdate: true });
          dispatch(tr);
        });
      });

      return {
        destroy() {
          unsubscribe?.();
        },
      };
    },
  });
}

// =============================================================================
// Decoration Builder
// =============================================================================

function buildDecorations(
  doc: import('@tiptap/pm/model').Node,
  marks: ReadonlyMap<AnnotationId, unknown>,
  visibleIds: Set<AnnotationId>
): DecorationSet {
  const decorations: Decoration[] = [];

  // Find all annotation marks in the document
  doc.descendants((node, pos) => {
    if (!node.isText) return;

    for (const mark of node.marks) {
      if (mark.type.name === 'intentMark') {
        const markId = mark.attrs.id as AnnotationId;
        const annotationId = mark.attrs.annotationId as AnnotationId;
        const isHidden = !visibleIds.has(markId) && !visibleIds.has(annotationId);

        if (isHidden) {
          // Add decoration to set data-hidden attribute
          decorations.push(
            Decoration.inline(pos, pos + node.nodeSize, {
              class: 'intent-mark--filtered-hidden',
              'data-filtered': 'true',
              'data-hidden': 'true',
            })
          );
        }
      }
    }

    return true;
  });

  return DecorationSet.create(doc, decorations);
}

// =============================================================================
// Utility
// =============================================================================

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

export default createFilterSyncPlugin;
