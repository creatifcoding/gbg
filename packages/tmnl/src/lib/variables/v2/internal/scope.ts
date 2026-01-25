/**
 * TMNL Variables v2 — Scope Chain
 *
 * Implements the hierarchical scope resolution:
 * editor → workspace → user → default
 *
 * Uses VariableProvider.orElse() for fallback chain.
 *
 * NOTE: This module uses a Registry singleton for synchronous atom access
 * outside of derived atoms. For derived atoms, pass the `get` function.
 */

import { Effect, pipe } from 'effect';
import { Atom, Registry } from '@effect-atom/atom';
import {
  type VariableProvider,
  type VariableDef,
  type VariableError,
  makeProvider,
  fromObjectWithDefuFn,
  getAllVariableDefinitions,
} from './core';

// ─────────────────────────────────────────────────────────────────────────────
// Registry Singleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Module-level registry for synchronous atom access.
 * Used by mutation functions and Effect-based providers.
 */
export const variablesRegistry = Registry.make();

// ─────────────────────────────────────────────────────────────────────────────
// Scope Identifiers
// ─────────────────────────────────────────────────────────────────────────────

/** Workspace identifier — for workspace-scoped variables */
export type WorkspaceId = string & { readonly _brand: unique symbol };

/** Editor identifier — for editor-scoped (buffer-local) variables */
export type EditorId = string & { readonly _brand: unique symbol };

// ─────────────────────────────────────────────────────────────────────────────
// Scope Storage Atoms
// ─────────────────────────────────────────────────────────────────────────────

/** User customizations — persisted, highest priority */
export const userScopeAtom = Atom.make<Record<string, unknown>>({});

/** Current workspace ID */
export const currentWorkspaceAtom = Atom.make<WorkspaceId | null>(null);

/** Workspace-specific configurations */
export const workspaceScopesAtom = Atom.make<
  Map<WorkspaceId, Record<string, unknown>>
>(new Map());

/** Current editor ID */
export const currentEditorAtom = Atom.make<EditorId | null>(null);

/** Editor-specific (buffer-local) configurations */
export const editorScopesAtom = Atom.make<
  Map<EditorId, Record<string, unknown>>
>(new Map());

// ─────────────────────────────────────────────────────────────────────────────
// Scope Providers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the default scope provider.
 * Returns values from variable definitions' default field.
 */
export const createDefaultProvider = (): VariableProvider =>
  makeProvider({
    load: <A>(def: VariableDef<A>): Effect.Effect<A, VariableError> => {
      const defaultVal = def.default;
      if (typeof defaultVal === 'function') {
        // Can't compute without lower value at the bottom
        // Return a sensible error
        return Effect.die(
          new Error(
            `Variable ${def.id} has computed default but no lower scope`
          )
        );
      }
      return Effect.succeed(defaultVal);
    },
    enumerate: () =>
      Effect.sync(() => Array.from(getAllVariableDefinitions().keys())),
  });

/**
 * Create the user scope provider.
 * Reads from userScopeAtom, falls back to defaults.
 */
export const createUserProvider = (
  defaults: VariableProvider
): VariableProvider => {
  return makeProvider({
    load: <A>(def: VariableDef<A>): Effect.Effect<A, VariableError> => {
      const userScope = variablesRegistry.get(userScopeAtom);
      const provider = fromObjectWithDefuFn(userScope, defaults, {
        name: 'user',
      });
      return provider.load(def);
    },
    enumerate: () =>
      pipe(
        defaults.enumerate(),
        Effect.map((defaultKeys) => {
          const userScope = variablesRegistry.get(userScopeAtom);
          const userKeys = Object.keys(userScope);
          return Array.from(new Set([...userKeys, ...defaultKeys]));
        })
      ),
  });
};

/**
 * Create the workspace scope provider.
 * Reads from current workspace, falls back to user.
 */
export const createWorkspaceProvider = (
  user: VariableProvider
): VariableProvider => {
  return makeProvider({
    load: <A>(def: VariableDef<A>): Effect.Effect<A, VariableError> => {
      const workspaceId = variablesRegistry.get(currentWorkspaceAtom);
      if (!workspaceId) {
        // No workspace context — fall through to user
        return user.load(def);
      }

      const workspaceScopes = variablesRegistry.get(workspaceScopesAtom);
      const workspaceScope = workspaceScopes.get(workspaceId) ?? {};
      const provider = fromObjectWithDefuFn(workspaceScope, user, {
        name: 'workspace',
      });
      return provider.load(def);
    },
    enumerate: () =>
      pipe(
        user.enumerate(),
        Effect.map((userKeys) => {
          const workspaceId = variablesRegistry.get(currentWorkspaceAtom);
          const workspaceScopes = variablesRegistry.get(workspaceScopesAtom);
          const workspaceScope = workspaceId
            ? workspaceScopes.get(workspaceId) ?? {}
            : {};
          const workspaceKeys = Object.keys(workspaceScope);
          return Array.from(new Set([...workspaceKeys, ...userKeys]));
        })
      ),
  });
};

/**
 * Create the editor scope provider.
 * Reads from current editor (buffer-local), falls back to workspace.
 */
export const createEditorProvider = (
  workspace: VariableProvider
): VariableProvider => {
  return makeProvider({
    load: <A>(def: VariableDef<A>): Effect.Effect<A, VariableError> => {
      const editorId = variablesRegistry.get(currentEditorAtom);
      if (!editorId) {
        // No editor context — fall through to workspace
        return workspace.load(def);
      }

      const editorScopes = variablesRegistry.get(editorScopesAtom);
      const editorScope = editorScopes.get(editorId) ?? {};
      const provider = fromObjectWithDefuFn(editorScope, workspace, {
        name: 'editor',
      });
      return provider.load(def);
    },
    enumerate: () =>
      pipe(
        workspace.enumerate(),
        Effect.map((workspaceKeys) => {
          const editorId = variablesRegistry.get(currentEditorAtom);
          const editorScopes = variablesRegistry.get(editorScopesAtom);
          const editorScope = editorId ? editorScopes.get(editorId) ?? {} : {};
          const editorKeys = Object.keys(editorScope);
          return Array.from(new Set([...editorKeys, ...workspaceKeys]));
        })
      ),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Composed Scope Chain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the full scope chain:
 * editor → workspace → user → default
 *
 * This is the primary provider for variable resolution.
 */
export const createScopeChain = (): VariableProvider => {
  const defaults = createDefaultProvider();
  const user = createUserProvider(defaults);
  const workspace = createWorkspaceProvider(user);
  const editor = createEditorProvider(workspace);
  return editor;
};

// ─────────────────────────────────────────────────────────────────────────────
// Scope Mutations
// ─────────────────────────────────────────────────────────────────────────────

/** Set a user-scope value */
export const setUserValue = (id: string, value: unknown): void => {
  const current = variablesRegistry.get(userScopeAtom);
  variablesRegistry.set(userScopeAtom, { ...current, [id]: value });
};

/** Remove a user-scope value */
export const removeUserValue = (id: string): void => {
  const current = variablesRegistry.get(userScopeAtom);
  const { [id]: _, ...rest } = current;
  variablesRegistry.set(userScopeAtom, rest);
};

/** Set a workspace-scope value */
export const setWorkspaceValue = (
  workspaceId: WorkspaceId,
  id: string,
  value: unknown
): void => {
  const scopes = variablesRegistry.get(workspaceScopesAtom);
  const newScopes = new Map(scopes);
  const workspaceScope = newScopes.get(workspaceId) ?? {};
  newScopes.set(workspaceId, { ...workspaceScope, [id]: value });
  variablesRegistry.set(workspaceScopesAtom, newScopes);
};

/** Remove a workspace-scope value */
export const removeWorkspaceValue = (
  workspaceId: WorkspaceId,
  id: string
): void => {
  const scopes = variablesRegistry.get(workspaceScopesAtom);
  const newScopes = new Map(scopes);
  const workspaceScope = newScopes.get(workspaceId);
  if (workspaceScope) {
    const { [id]: _, ...rest } = workspaceScope;
    newScopes.set(workspaceId, rest);
  }
  variablesRegistry.set(workspaceScopesAtom, newScopes);
};

/** Set an editor-scope value (buffer-local) */
export const setEditorValue = (
  editorId: EditorId,
  id: string,
  value: unknown
): void => {
  const scopes = variablesRegistry.get(editorScopesAtom);
  const newScopes = new Map(scopes);
  const editorScope = newScopes.get(editorId) ?? {};
  newScopes.set(editorId, { ...editorScope, [id]: value });
  variablesRegistry.set(editorScopesAtom, newScopes);
};

/** Remove an editor-scope value */
export const removeEditorValue = (editorId: EditorId, id: string): void => {
  const scopes = variablesRegistry.get(editorScopesAtom);
  const newScopes = new Map(scopes);
  const editorScope = newScopes.get(editorId);
  if (editorScope) {
    const { [id]: _, ...rest } = editorScope;
    newScopes.set(editorId, rest);
  }
  variablesRegistry.set(editorScopesAtom, newScopes);
};

/** Clear all editor-scope values (when editor closes) */
export const clearEditorScope = (editorId: EditorId): void => {
  const scopes = variablesRegistry.get(editorScopesAtom);
  const newScopes = new Map(scopes);
  newScopes.delete(editorId);
  variablesRegistry.set(editorScopesAtom, newScopes);
};

/** Set current workspace context */
export const setCurrentWorkspace = (id: WorkspaceId | null): void => {
  variablesRegistry.set(currentWorkspaceAtom, id);
};

/** Set current editor context */
export const setCurrentEditor = (id: EditorId | null): void => {
  variablesRegistry.set(currentEditorAtom, id);
};

/** Set user scope from parsed object (for persistence loading) */
export const setUserScopeFromObject = (obj: Record<string, unknown>): void => {
  variablesRegistry.set(userScopeAtom, obj);
};

// ─────────────────────────────────────────────────────────────────────────────
// Value Source Tracking
// ─────────────────────────────────────────────────────────────────────────────

/** Where a value came from */
export type ValueSource = 'editor' | 'workspace' | 'user' | 'default';

/** Resolved value with provenance */
export interface ResolvedValue<A> {
  readonly value: A;
  readonly source: ValueSource;
  readonly isModified: boolean;
}

/**
 * Atom getter type for derived atoms.
 * This is the `get` function passed to Atom.make((get) => ...).
 */
export type AtomGetter = <T>(atom: Atom.Atom<T>) => T;

/**
 * Resolve a variable synchronously with source tracking.
 * This is the primary function used by React hooks via derived atoms.
 *
 * IMPORTANT: Must be called from within an Atom.make((get) => ...) context,
 * passing the `get` function. The `get` function reads atom values synchronously
 * within the derived atom subscription.
 *
 * Resolution order: editor → workspace → user → default
 */
export const resolveValueSync = <A>(
  variableId: string,
  def: VariableDef<A>,
  get: AtomGetter
): ResolvedValue<A> | undefined => {
  // Check editor scope first
  const editorId = get(currentEditorAtom);
  if (editorId) {
    const editorScopes = get(editorScopesAtom);
    const editorScope = editorScopes.get(editorId) ?? {};
    if (variableId in editorScope) {
      return {
        value: editorScope[variableId] as A,
        source: 'editor' as const,
        isModified: true,
      };
    }
  }

  // Check workspace scope
  const workspaceId = get(currentWorkspaceAtom);
  if (workspaceId) {
    const workspaceScopes = get(workspaceScopesAtom);
    const workspaceScope = workspaceScopes.get(workspaceId) ?? {};
    if (variableId in workspaceScope) {
      return {
        value: workspaceScope[variableId] as A,
        source: 'workspace' as const,
        isModified: true,
      };
    }
  }

  // Check user scope
  const userScope = get(userScopeAtom);
  if (variableId in userScope) {
    return {
      value: userScope[variableId] as A,
      source: 'user' as const,
      isModified: true,
    };
  }

  // Use default from definition
  const defaultVal = def.default;
  if (typeof defaultVal === 'function') {
    // Computed default - can't resolve without lower value at sync level
    // Return undefined to signal this needs Effect-based resolution
    return undefined;
  }

  return {
    value: defaultVal,
    source: 'default' as const,
    isModified: false,
  };
};

/**
 * Resolve a variable synchronously using the registry (for Effect contexts).
 * Use this when you don't have a derived atom's `get` function.
 */
export const resolveValueSyncWithRegistry = <A>(
  variableId: string,
  def: VariableDef<A>
): ResolvedValue<A> | undefined => {
  // Check editor scope first
  const editorId = variablesRegistry.get(currentEditorAtom);
  if (editorId) {
    const editorScopes = variablesRegistry.get(editorScopesAtom);
    const editorScope = editorScopes.get(editorId) ?? {};
    if (variableId in editorScope) {
      return {
        value: editorScope[variableId] as A,
        source: 'editor' as const,
        isModified: true,
      };
    }
  }

  // Check workspace scope
  const workspaceId = variablesRegistry.get(currentWorkspaceAtom);
  if (workspaceId) {
    const workspaceScopes = variablesRegistry.get(workspaceScopesAtom);
    const workspaceScope = workspaceScopes.get(workspaceId) ?? {};
    if (variableId in workspaceScope) {
      return {
        value: workspaceScope[variableId] as A,
        source: 'workspace' as const,
        isModified: true,
      };
    }
  }

  // Check user scope
  const userScope = variablesRegistry.get(userScopeAtom);
  if (variableId in userScope) {
    return {
      value: userScope[variableId] as A,
      source: 'user' as const,
      isModified: true,
    };
  }

  // Use default from definition
  const defaultVal = def.default;
  if (typeof defaultVal === 'function') {
    // Computed default - can't resolve without lower value at sync level
    // Return undefined to signal this needs Effect-based resolution
    return undefined;
  }

  return {
    value: defaultVal,
    source: 'default' as const,
    isModified: false,
  };
};

/**
 * Load a variable with source tracking (Effect-based).
 * Checks each scope level to determine where the value came from.
 */
export const loadWithSource = <A>(
  def: VariableDef<A>
): Effect.Effect<ResolvedValue<A>, VariableError> =>
  Effect.sync(() => {
    const result = resolveValueSyncWithRegistry(def.id, def);
    if (result) return result;

    // Fallback to default for computed defaults
    const defaultVal = def.default;
    if (typeof defaultVal !== 'function') {
      return {
        value: defaultVal,
        source: 'default' as const,
        isModified: false,
      };
    }

    // For computed defaults, we'd need the full provider chain
    // For now, return a placeholder (this case is rare)
    return {
      value: undefined as A,
      source: 'default' as const,
      isModified: false,
    };
  });
