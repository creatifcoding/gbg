/**
 * UITree Element-Level Mutation Helpers
 *
 * Pure functions for immutable tree mutation.
 * Operates on HashMap<string, UIElement> and returns a new tree (COW).
 *
 * @module genifer/code-mode/tree-mutator
 */

import { HashMap, Option } from 'effect'
import type { UITree, UIElement } from '../core/schemas'

/**
 * Update an element's props in the tree.
 * Returns a new UITree with the element's props merged.
 */
export function updateElementProps(
  tree: UITree,
  elementKey: string,
  propsUpdate: Record<string, unknown>,
): UITree {
  const existing = HashMap.get(tree.elements, elementKey)
  if (Option.isNone(existing)) return tree // key not found — no-op

  const element = existing.value
  const updated: UIElement = {
    ...element,
    props: { ...(element.props as any), ...propsUpdate },
  }

  return {
    ...tree,
    elements: HashMap.set(tree.elements, elementKey, updated),
  }
}

/**
 * Add a child element to a parent in the tree.
 * Appends the child key to the parent's children array
 * and adds the element to the elements map.
 */
export function addChildElement(
  tree: UITree,
  parentKey: string,
  element: UIElement,
): UITree {
  const parent = HashMap.get(tree.elements, parentKey)
  if (Option.isNone(parent)) return tree

  const parentEl = parent.value
  const children = [...(parentEl.children ?? []), element.key]

  const updatedParent: UIElement = {
    ...parentEl,
    children,
  }

  let elements = HashMap.set(tree.elements, parentKey, updatedParent)
  elements = HashMap.set(elements, element.key, element)

  return {
    ...tree,
    elements,
    size: tree.size + 1,
  }
}

/**
 * Remove an element from the tree.
 * Also removes its key from the parent's children array.
 */
export function removeElement(
  tree: UITree,
  elementKey: string,
): UITree {
  const existing = HashMap.get(tree.elements, elementKey)
  if (Option.isNone(existing)) return tree

  let elements = HashMap.remove(tree.elements, elementKey)

  // Find and update the parent that references this key
  for (const [key, el] of HashMap.toEntries(elements)) {
    if (el.children?.includes(elementKey)) {
      const updatedParent: UIElement = {
        ...el,
        children: el.children.filter((c) => c !== elementKey),
      }
      elements = HashMap.set(elements, key, updatedParent)
      break
    }
  }

  return {
    ...tree,
    elements,
    size: Math.max(0, tree.size - 1),
  }
}

/**
 * Get an element from the tree by key.
 */
export function getElement(tree: UITree, elementKey: string): UIElement | undefined {
  return Option.getOrUndefined(HashMap.get(tree.elements, elementKey))
}

/**
 * List all element keys and types.
 */
export function listElements(tree: UITree): Array<{ key: string; type: string }> {
  const result: Array<{ key: string; type: string }> = []
  for (const [key, el] of HashMap.toEntries(tree.elements)) {
    result.push({ key, type: el.type })
  }
  return result
}
