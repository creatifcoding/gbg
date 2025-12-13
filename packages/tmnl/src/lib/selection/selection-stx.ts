/**
 * Selection State Management
 *
 * Atom-based state for marquee selection and grouping.
 * Uses Legend-State atoms directly (no Effect services needed).
 *
 * @pattern Atom-as-State (direct atom manipulation, React subscribes)
 * @module
 */

import { observable } from '@legendapp/state'
import type {
  SelectionState,
  SelectionEvent,
  Position,
  Rect,
  GroupState,
  SelectionMode,
} from './types'

// =============================================================================
// Initial State
// =============================================================================

const initialState: SelectionState = {
  selectedIds: new Set(),
  marqueeRect: null,
  isSelecting: false,
  modifiers: { shift: false, ctrl: false, alt: false },
  groups: new Map(),
  itemToGroup: new Map(),
}

// =============================================================================
// Observable State (Singleton)
// =============================================================================

export const selectionState$ = observable<SelectionState>({
  ...initialState,
  // Legend-State needs plain objects, convert Sets/Maps on access
})

// Backing stores (actual Sets/Maps)
let _selectedIds = new Set<string>()
let _groups = new Map<string, GroupState>()
let _itemToGroup = new Map<string, string>()

// =============================================================================
// Selectors (Read)
// =============================================================================

export function getSelectedIds(): Set<string> {
  return new Set(_selectedIds)
}

export function isSelected(id: string): boolean {
  return _selectedIds.has(id)
}

export function getMarqueeRect(): Rect | null {
  return selectionState$.marqueeRect.get()
}

export function isSelecting(): boolean {
  return selectionState$.isSelecting.get()
}

export function getModifiers() {
  return selectionState$.modifiers.get()
}

export function getGroup(groupId: string): GroupState | undefined {
  return _groups.get(groupId)
}

export function getItemGroup(itemId: string): string | undefined {
  return _itemToGroup.get(itemId)
}

export function getGroupForItem(itemId: string): GroupState | undefined {
  const groupId = _itemToGroup.get(itemId)
  return groupId ? _groups.get(groupId) : undefined
}

export function getSelectedCount(): number {
  return _selectedIds.size
}

export function hasSelection(): boolean {
  return _selectedIds.size > 0
}

// =============================================================================
// Actions (Write)
// =============================================================================

let marqueeStart: Position | null = null

export function startMarquee(position: Position, mode: SelectionMode = 'replace'): void {
  marqueeStart = position
  selectionState$.isSelecting.set(true)
  selectionState$.marqueeRect.set({
    x: position.x,
    y: position.y,
    width: 0,
    height: 0,
  })

  // If replace mode, clear existing selection
  if (mode === 'replace' && !selectionState$.modifiers.get().shift) {
    _selectedIds.clear()
    notifySelectionChange()
  }
}

export function updateMarquee(position: Position): void {
  if (!marqueeStart) return

  const x = Math.min(marqueeStart.x, position.x)
  const y = Math.min(marqueeStart.y, position.y)
  const width = Math.abs(position.x - marqueeStart.x)
  const height = Math.abs(position.y - marqueeStart.y)

  selectionState$.marqueeRect.set({ x, y, width, height })
}

export function endMarquee(itemsInRect: string[]): void {
  const mode = selectionState$.modifiers.get().shift ? 'add' : 'replace'

  if (mode === 'replace') {
    _selectedIds.clear()
  }

  // Add items in rect to selection
  for (const id of itemsInRect) {
    _selectedIds.add(id)
    // If item is in a group, select entire group
    const groupId = _itemToGroup.get(id)
    if (groupId) {
      const group = _groups.get(groupId)
      if (group) {
        for (const memberId of group.memberIds) {
          _selectedIds.add(memberId)
        }
      }
    }
  }

  marqueeStart = null
  selectionState$.isSelecting.set(false)
  selectionState$.marqueeRect.set(null)
  notifySelectionChange()
}

export function cancelMarquee(): void {
  marqueeStart = null
  selectionState$.isSelecting.set(false)
  selectionState$.marqueeRect.set(null)
}

export function selectItem(id: string, mode: SelectionMode = 'replace'): void {
  if (mode === 'replace') {
    _selectedIds.clear()
    _selectedIds.add(id)
  } else if (mode === 'add') {
    _selectedIds.add(id)
  } else if (mode === 'toggle') {
    if (_selectedIds.has(id)) {
      _selectedIds.delete(id)
    } else {
      _selectedIds.add(id)
    }
  }

  // If item is in a group, select entire group
  const groupId = _itemToGroup.get(id)
  if (groupId && mode !== 'toggle') {
    const group = _groups.get(groupId)
    if (group) {
      for (const memberId of group.memberIds) {
        _selectedIds.add(memberId)
      }
    }
  }

  notifySelectionChange()
}

export function selectItems(ids: string[], mode: SelectionMode = 'replace'): void {
  if (mode === 'replace') {
    _selectedIds.clear()
  }

  for (const id of ids) {
    if (mode === 'toggle') {
      if (_selectedIds.has(id)) {
        _selectedIds.delete(id)
      } else {
        _selectedIds.add(id)
      }
    } else {
      _selectedIds.add(id)
    }
  }

  notifySelectionChange()
}

export function deselectItem(id: string): void {
  _selectedIds.delete(id)
  notifySelectionChange()
}

export function deselectAll(): void {
  _selectedIds.clear()
  notifySelectionChange()
}

export function selectAll(ids: string[]): void {
  _selectedIds.clear()
  for (const id of ids) {
    _selectedIds.add(id)
  }
  notifySelectionChange()
}

export function updateModifiers(modifiers: { shift: boolean; ctrl: boolean; alt: boolean }): void {
  selectionState$.modifiers.set(modifiers)
}

// =============================================================================
// Grouping
// =============================================================================

let groupCounter = 0

export function groupSelected(): string | null {
  if (_selectedIds.size < 2) return null

  const groupId = `group-${++groupCounter}-${Date.now()}`
  const memberIds = Array.from(_selectedIds)

  // Remove members from existing groups
  for (const memberId of memberIds) {
    const existingGroupId = _itemToGroup.get(memberId)
    if (existingGroupId) {
      const existingGroup = _groups.get(existingGroupId)
      if (existingGroup) {
        existingGroup.memberIds = existingGroup.memberIds.filter((id) => id !== memberId)
        if (existingGroup.memberIds.length < 2) {
          // Dissolve group with less than 2 members
          for (const id of existingGroup.memberIds) {
            _itemToGroup.delete(id)
          }
          _groups.delete(existingGroupId)
        }
      }
    }
  }

  // Create new group
  const group: GroupState = {
    id: groupId,
    memberIds,
    createdAt: Date.now(),
  }

  _groups.set(groupId, group)
  for (const memberId of memberIds) {
    _itemToGroup.set(memberId, groupId)
  }

  notifyGroupChange()
  return groupId
}

export function ungroupSelected(): void {
  const groupsToDissolve = new Set<string>()

  for (const selectedId of _selectedIds) {
    const groupId = _itemToGroup.get(selectedId)
    if (groupId) {
      groupsToDissolve.add(groupId)
    }
  }

  for (const groupId of groupsToDissolve) {
    const group = _groups.get(groupId)
    if (group) {
      for (const memberId of group.memberIds) {
        _itemToGroup.delete(memberId)
      }
      _groups.delete(groupId)
    }
  }

  notifyGroupChange()
}

// =============================================================================
// Change Notifications (for React subscriptions)
// =============================================================================

type SelectionListener = (selectedIds: Set<string>) => void
type GroupListener = (groups: Map<string, GroupState>) => void

const selectionListeners = new Set<SelectionListener>()
const groupListeners = new Set<GroupListener>()

export function subscribeToSelection(listener: SelectionListener): () => void {
  selectionListeners.add(listener)
  // Immediately notify with current state
  listener(new Set(_selectedIds))
  return () => selectionListeners.delete(listener)
}

export function subscribeToGroups(listener: GroupListener): () => void {
  groupListeners.add(listener)
  listener(new Map(_groups))
  return () => groupListeners.delete(listener)
}

function notifySelectionChange(): void {
  const snapshot = new Set(_selectedIds)
  for (const listener of selectionListeners) {
    listener(snapshot)
  }
}

function notifyGroupChange(): void {
  const snapshot = new Map(_groups)
  for (const listener of groupListeners) {
    listener(snapshot)
  }
}

// =============================================================================
// Reset
// =============================================================================

export function resetSelection(): void {
  _selectedIds.clear()
  _groups.clear()
  _itemToGroup.clear()
  marqueeStart = null
  selectionState$.set(initialState)
  notifySelectionChange()
  notifyGroupChange()
}
