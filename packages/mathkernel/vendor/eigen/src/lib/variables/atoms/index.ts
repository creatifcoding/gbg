/**
 * TMNL Variables — Atom Storage
 *
 * Reactive storage for variable values using effect-atom.
 * Implements scoped value resolution (editor → workspace → user → default).
 */

import { Atom, Registry } from '@effect-atom/atom';
import type {
  VariableId,
  WorkspaceId,
  EditorId,
  ValueSource,
  VariableChangeEvent,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Value Storage Types
// ─────────────────────────────────────────────────────────────────────────────

/** Stored value with metadata */
interface StoredValue<A = unknown> {
  readonly value: A;
  readonly source: ValueSource;
  readonly updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Atom Registry (for imperative subscriptions)
// ─────────────────────────────────────────────────────────────────────────────

/** Shared registry for the variables domain. Used by persistence auto-save. */
export const variablesRegistry = Registry.make();

// ─────────────────────────────────────────────────────────────────────────────
// Global Value Storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * User customizations — persisted overrides of default values.
 * Source: 'user'
 */
export const userValuesAtom = Atom.make<ReadonlyMap<string, StoredValue>>(
  new Map()
);

// ─────────────────────────────────────────────────────────────────────────────
// Workspace-Scoped Storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Current workspace ID.
 * Set by workspace management system.
 */
export const currentWorkspaceIdAtom = Atom.make<WorkspaceId | null>(null);

/**
 * Workspace-specific values.
 * Outer map: WorkspaceId → Inner map: VariableId → Value
 * Source: 'workspace'
 */
export const workspaceValuesAtom = Atom.make<
  ReadonlyMap<string, ReadonlyMap<string, StoredValue>>
>(new Map());

// ─────────────────────────────────────────────────────────────────────────────
// Editor-Scoped Storage (Buffer-Local)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Current editor ID.
 * Set by editor management system.
 */
export const currentEditorIdAtom = Atom.make<EditorId | null>(null);

/**
 * Editor-specific values (buffer-local variables).
 * Outer map: EditorId → Inner map: VariableId → Value
 * Source: 'editor'
 */
export const editorValuesAtom = Atom.make<
  ReadonlyMap<string, ReadonlyMap<string, StoredValue>>
>(new Map());

// ─────────────────────────────────────────────────────────────────────────────
// Change Event Stream
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variable change events.
 * Subscribers can react to variable changes.
 */
export const variableChangesAtom = Atom.make<readonly VariableChangeEvent[]>(
  []
);

/**
 * Emit a variable change event.
 */
export function emitVariableChange(event: VariableChangeEvent): void {
  Atom.update(variableChangesAtom, (events) => {
    // Keep last 100 events for debugging
    const newEvents = [...events, event];
    return newEvents.slice(-100);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Value Setters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set a user customization value.
 */
export function setUserValue(variableId: string, value: unknown): void {
  const stored: StoredValue = {
    value,
    source: 'user',
    updatedAt: new Date(),
  };

  Atom.update(userValuesAtom, (map) => {
    const newMap = new Map(map);
    newMap.set(variableId, stored);
    return newMap;
  });
}

/**
 * Remove a user customization (revert to default).
 */
export function removeUserValue(variableId: string): void {
  Atom.update(userValuesAtom, (map) => {
    const newMap = new Map(map);
    newMap.delete(variableId);
    return newMap;
  });
}

/**
 * Set a workspace-scoped value.
 */
export function setWorkspaceValue(
  workspaceId: WorkspaceId,
  variableId: string,
  value: unknown
): void {
  const stored: StoredValue = {
    value,
    source: 'workspace',
    updatedAt: new Date(),
  };

  Atom.update(workspaceValuesAtom, (outer) => {
    const newOuter = new Map(outer);
    const inner = new Map(outer.get(workspaceId as string) ?? new Map());
    inner.set(variableId, stored);
    newOuter.set(workspaceId as string, inner);
    return newOuter;
  });
}

/**
 * Remove a workspace-scoped value.
 */
export function removeWorkspaceValue(
  workspaceId: WorkspaceId,
  variableId: string
): void {
  Atom.update(workspaceValuesAtom, (outer) => {
    const inner = outer.get(workspaceId as string);
    if (!inner) return outer;

    const newInner = new Map(inner);
    newInner.delete(variableId);

    const newOuter = new Map(outer);
    if (newInner.size === 0) {
      newOuter.delete(workspaceId as string);
    } else {
      newOuter.set(workspaceId as string, newInner);
    }
    return newOuter;
  });
}

/**
 * Set an editor-scoped value (buffer-local).
 */
export function setEditorValue(
  editorId: EditorId,
  variableId: string,
  value: unknown
): void {
  const stored: StoredValue = {
    value,
    source: 'editor',
    updatedAt: new Date(),
  };

  Atom.update(editorValuesAtom, (outer) => {
    const newOuter = new Map(outer);
    const inner = new Map(outer.get(editorId as string) ?? new Map());
    inner.set(variableId, stored);
    newOuter.set(editorId as string, inner);
    return newOuter;
  });
}

/**
 * Remove an editor-scoped value.
 */
export function removeEditorValue(
  editorId: EditorId,
  variableId: string
): void {
  Atom.update(editorValuesAtom, (outer) => {
    const inner = outer.get(editorId as string);
    if (!inner) return outer;

    const newInner = new Map(inner);
    newInner.delete(variableId);

    const newOuter = new Map(outer);
    if (newInner.size === 0) {
      newOuter.delete(editorId as string);
    } else {
      newOuter.set(editorId as string, newInner);
    }
    return newOuter;
  });
}

/**
 * Clear all editor values for an editor (when editor closes).
 */
export function clearEditorValues(editorId: EditorId): void {
  Atom.update(editorValuesAtom, (outer) => {
    const newOuter = new Map(outer);
    newOuter.delete(editorId as string);
    return newOuter;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Value Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a variable's current value with full scope chain.
 *
 * Resolution order:
 * 1. Editor-local value (if in editor context and editor scope allows)
 * 2. Workspace value (if in workspace context and workspace scope allows)
 * 3. User customization
 * 4. Default value (from definition)
 */
export function resolveValue(
  variableId: string,
  defaultValue: unknown,
  scope: 'global' | 'workspace' | 'editor'
): { value: unknown; source: ValueSource } {
  // 1. Check editor-local (if scope allows and editor is active)
  if (scope === 'editor') {
    const editorId = Atom.get(currentEditorIdAtom);
    if (editorId) {
      const editorValues = Atom.get(editorValuesAtom);
      const editorMap = editorValues.get(editorId as string);
      const editorStored = editorMap?.get(variableId);
      if (editorStored) {
        return { value: editorStored.value, source: 'editor' };
      }
    }
  }

  // 2. Check workspace (if scope allows and workspace is active)
  if (scope === 'workspace' || scope === 'editor') {
    const workspaceId = Atom.get(currentWorkspaceIdAtom);
    if (workspaceId) {
      const workspaceValues = Atom.get(workspaceValuesAtom);
      const workspaceMap = workspaceValues.get(workspaceId as string);
      const workspaceStored = workspaceMap?.get(variableId);
      if (workspaceStored) {
        return { value: workspaceStored.value, source: 'workspace' };
      }
    }
  }

  // 3. Check user customization
  const userValues = Atom.get(userValuesAtom);
  const userStored = userValues.get(variableId);
  if (userStored) {
    return { value: userStored.value, source: 'user' };
  }

  // 4. Return default
  return { value: defaultValue, source: 'default' };
}
