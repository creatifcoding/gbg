/**
 * Surface Bridge — Connects sandbox to GeniferHarnessService surfaces
 *
 * Pattern: setSurfaceBridge(fns) wired at service construction,
 * sandbox reads/writes via these functions.
 *
 * @module genifer/code-mode/surface-bridge
 */

import type { UITree, UIElement } from '../core/schemas'
import {
  updateElementProps,
  addChildElement,
  removeElement,
  getElement,
  listElements,
} from './tree-mutator'

// =============================================================================
// Bridge Interface
// =============================================================================

export interface SurfaceBridgeFns {
  /** Get a surface by ID */
  getSurface: (id: string) => {
    id: string
    status: string
    prompt: string
    treeSnapshot: UITree | null
  } | undefined

  /** Update a surface's tree snapshot (triggers React re-render via atom) */
  updateSurfaceTree: (surfaceId: string, tree: UITree) => void
}

// =============================================================================
// Module-level bridge (set once at bootstrap)
// =============================================================================

let _bridge: SurfaceBridgeFns | null = null

export function setSurfaceBridge(fns: SurfaceBridgeFns): void {
  _bridge = fns
}

export function getSurfaceBridge(): SurfaceBridgeFns | null {
  return _bridge
}

export function resetSurfaceBridge(): void {
  _bridge = null
}

// =============================================================================
// Surface operations (used by sandbox SDK)
// =============================================================================

export function surfaceGet(surfaceId: string) {
  const bridge = _bridge
  if (!bridge) return undefined
  const s = bridge.getSurface(surfaceId)
  if (!s) return undefined
  const elementCount = s.treeSnapshot
    ? listElements(s.treeSnapshot).length
    : 0
  return { id: s.id, status: s.status, prompt: s.prompt, elementCount }
}

export function surfaceListElements(surfaceId: string) {
  const bridge = _bridge
  if (!bridge) return []
  const s = bridge.getSurface(surfaceId)
  if (!s?.treeSnapshot) return []
  return listElements(s.treeSnapshot)
}

export function surfaceGetElement(surfaceId: string, elementKey: string) {
  const bridge = _bridge
  if (!bridge) return undefined
  const s = bridge.getSurface(surfaceId)
  if (!s?.treeSnapshot) return undefined
  const el = getElement(s.treeSnapshot, elementKey)
  return el?.props as Record<string, unknown> | undefined
}

export function surfaceUpdateElement(
  surfaceId: string,
  elementKey: string,
  props: Record<string, unknown>,
): void {
  const bridge = _bridge
  if (!bridge) throw new Error('Surface bridge not initialized')
  const s = bridge.getSurface(surfaceId)
  if (!s) throw new Error(`Surface '${surfaceId}' not found`)
  if (!s.treeSnapshot) throw new Error(`Surface '${surfaceId}' has no tree`)
  const updated = updateElementProps(s.treeSnapshot, elementKey, props)
  bridge.updateSurfaceTree(surfaceId, updated)
}

export function surfaceAddElement(
  surfaceId: string,
  parentKey: string,
  element: { key: string; type: string; props?: Record<string, unknown>; children?: string[] },
): void {
  const bridge = _bridge
  if (!bridge) throw new Error('Surface bridge not initialized')
  const s = bridge.getSurface(surfaceId)
  if (!s) throw new Error(`Surface '${surfaceId}' not found`)
  if (!s.treeSnapshot) throw new Error(`Surface '${surfaceId}' has no tree`)
  const uiElement: UIElement = {
    key: element.key,
    type: element.type,
    props: element.props ?? {},
    children: element.children ?? [],
  }
  const updated = addChildElement(s.treeSnapshot, parentKey, uiElement)
  bridge.updateSurfaceTree(surfaceId, updated)
}

export function surfaceRemoveElement(surfaceId: string, elementKey: string): void {
  const bridge = _bridge
  if (!bridge) throw new Error('Surface bridge not initialized')
  const s = bridge.getSurface(surfaceId)
  if (!s) throw new Error(`Surface '${surfaceId}' not found`)
  if (!s.treeSnapshot) throw new Error(`Surface '${surfaceId}' has no tree`)
  const updated = removeElement(s.treeSnapshot, elementKey)
  bridge.updateSurfaceTree(surfaceId, updated)
}
