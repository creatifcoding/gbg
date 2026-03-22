/**
 * UITree Differ
 *
 * Effect-native Differ implementation for compositional UITree patching.
 * Enables efficient patch computation and application for tree structures.
 *
 * @module morph-card/differ/UITreeDiffer
 */

import { Differ, HashMap } from 'effect';
import type { UITree, UIElement } from '@/lib/genifer';
import type { JsonPatch } from '../schemas/patch-protocol';

// =============================================================================
// Types
// =============================================================================

/** Patch for a single UIElement (replace entire element) */
type ElementPatch = (old: UIElement) => UIElement;

/** HashMap patch for elements Record */
type ElementsHashMapPatch = Differ.Differ.HashMap.Patch<string, UIElement, ElementPatch>;

/** Composite UITree patch */
export interface UITreePatch {
  readonly root: (old: string) => string;
  readonly elements: ElementsHashMapPatch;
}

// =============================================================================
// Helpers
// =============================================================================

const recordToHashMap = <K extends string, V>(record: Record<K, V>): HashMap.HashMap<K, V> =>
  HashMap.fromIterable(Object.entries(record) as [K, V][]);

const hashMapToRecord = <K extends string, V>(map: HashMap.HashMap<K, V>): Record<K, V> =>
  Object.fromEntries(HashMap.toEntries(map)) as Record<K, V>;

/** Identity function for no-change root patches */
const identity = <A>(a: A): A => a;

/** Constant function for replacement patches */
const constant =
  <A>(value: A) =>
  (_: A): A =>
    value;

// =============================================================================
// Differ Implementation
// =============================================================================

/** Element differ - simple replacement (non-compositional) */
const elementDiffer: Differ.Differ<UIElement, ElementPatch> = Differ.update<UIElement>();

/** HashMap differ for elements */
const elementsDiffer: Differ.Differ<HashMap.HashMap<string, UIElement>, ElementsHashMapPatch> =
  Differ.hashMap<string, UIElement, ElementPatch>(elementDiffer);

/**
 * Composite UITree differ
 *
 * Provides compositional patching for UITree structures:
 * - `diff`: Compute patch between old and new tree
 * - `combine`: Merge two patches (associative)
 * - `patch`: Apply patch to produce new tree
 * - `empty`: Identity patch (no changes)
 *
 * Laws:
 * - Associativity: combine(combine(p1, p2), p3) ≡ combine(p1, combine(p2, p3))
 * - Empty Identity: combine(patch, empty) ≡ patch ≡ combine(empty, patch)
 * - Self-Diff Empty: diff(value, value) ≡ empty
 * - Diff-Patch Roundtrip: patch(diff(old, new), old) ≡ new
 */
export const UITreeDiffer: Differ.Differ<UITree, UITreePatch> = Differ.make({
  empty: {
    root: identity,
    elements: elementsDiffer.empty,
  },

  diff: (oldTree: UITree, newTree: UITree): UITreePatch => ({
    root: oldTree.root === newTree.root ? identity : constant(newTree.root),
    elements: elementsDiffer.diff(
      recordToHashMap(oldTree.elements),
      recordToHashMap(newTree.elements)
    ),
  }),

  combine: (first: UITreePatch, second: UITreePatch): UITreePatch => ({
    // If second patch is identity, use first; otherwise use second
    root: second.root === identity ? first.root : second.root,
    elements: elementsDiffer.combine(first.elements, second.elements),
  }),

  patch: (patch: UITreePatch, oldTree: UITree): UITree => {
    const newRoot = patch.root(oldTree.root);
    const newElements = hashMapToRecord(
      elementsDiffer.patch(patch.elements, recordToHashMap(oldTree.elements))
    );

    // Return new UITree instance
    // Note: UITree is a Schema.Class, so we construct it via object spread
    return { ...oldTree, root: newRoot, elements: newElements } as UITree;
  },
});

// =============================================================================
// JSON Patch → UITreePatch Conversion
// =============================================================================

/**
 * Convert JSON Patch operations to UITreePatch
 *
 * JSON Patch paths:
 * - /root → root patch (replace root key)
 * - /elements/{key} → element add/remove/replace
 * - /elements/{key}/props → element property update (requires current tree)
 * - /elements/{key}/children → element children update (requires current tree)
 *
 * @param patches - Array of JSON Patch operations
 * @param currentTree - Current tree state (needed for partial element updates)
 * @returns UITreePatch that can be applied via UITreeDiffer.patch
 */
export const jsonPatchToUITreePatch = (
  patches: readonly JsonPatch[],
  currentTree: UITree
): UITreePatch => {
  // Build a mutable elements map to accumulate changes
  let elementsMap = recordToHashMap(currentTree.elements);
  let rootPatch: (old: string) => string = identity;

  for (const patch of patches) {
    // Handle /root path
    if (patch.path === '/root' && (patch.op === 'replace' || patch.op === 'set')) {
      rootPatch = constant(patch.value as string);
      continue;
    }

    // Handle /elements/* paths
    if (patch.path.startsWith('/elements/')) {
      const pathParts = patch.path.slice('/elements/'.length).split('/');
      const key = pathParts[0];
      const subPath = pathParts.slice(1).join('/');

      if (!subPath) {
        // Full element operation: /elements/{key}
        switch (patch.op) {
          case 'add':
          case 'replace':
          case 'set': {
            const element = patch.value as UIElement;
            elementsMap = HashMap.set(elementsMap, key, element);
            break;
          }
          case 'remove': {
            elementsMap = HashMap.remove(elementsMap, key);
            break;
          }
        }
      } else {
        // Partial element update: /elements/{key}/props or /elements/{key}/children
        const existingElement = HashMap.get(elementsMap, key);
        if (existingElement._tag === 'Some') {
          const element = existingElement.value;
          let updatedElement = element;

          if (subPath === 'props' && (patch.op === 'replace' || patch.op === 'set')) {
            updatedElement = { ...element, props: patch.value as Record<string, unknown> };
          } else if (subPath === 'children' && (patch.op === 'replace' || patch.op === 'set')) {
            updatedElement = { ...element, children: patch.value as string[] };
          } else if (subPath === 'type' && (patch.op === 'replace' || patch.op === 'set')) {
            updatedElement = { ...element, type: patch.value as string };
          } else if (subPath.startsWith('props/')) {
            // Nested prop update: /elements/{key}/props/{propName}
            const propName = subPath.slice('props/'.length);
            const newProps = { ...(element.props ?? {}), [propName]: patch.value };
            updatedElement = { ...element, props: newProps };
          }

          elementsMap = HashMap.set(elementsMap, key, updatedElement as UIElement);
        }
      }
    }
  }

  // Compute the diff between current and new elements
  const elementsPatch = elementsDiffer.diff(
    recordToHashMap(currentTree.elements),
    elementsMap
  );

  return {
    root: rootPatch,
    elements: elementsPatch,
  };
};

/**
 * Apply JSON Patches directly to a UITree
 *
 * Convenience function that combines jsonPatchToUITreePatch and UITreeDiffer.patch
 *
 * @param patches - Array of JSON Patch operations
 * @param tree - Current tree state
 * @returns New tree with patches applied
 */
export const applyJsonPatches = (patches: readonly JsonPatch[], tree: UITree): UITree => {
  const uiTreePatch = jsonPatchToUITreePatch(patches, tree);
  return UITreeDiffer.patch(uiTreePatch, tree);
};

// =============================================================================
// Export
// =============================================================================

export { recordToHashMap, hashMapToRecord };
