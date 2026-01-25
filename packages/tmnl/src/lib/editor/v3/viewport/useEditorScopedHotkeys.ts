/**
 * useEditorScopedHotkeys
 *
 * Scoped hotkey handling for editor panels.
 * Pushes 'editor' scope on focus, pops on blur.
 * Registers editor-specific keybindings for zoom, etc.
 *
 * This replaces the raw keyboard listeners in useEditorZoom.
 *
 * @module editor/v3/viewport/useEditorScopedHotkeys
 */

import { useContext, useCallback, useRef, useEffect } from 'react';
import { RegistryContext } from '@effect-atom/atom-react';
import { Effect } from 'effect';
import {
  hotkeyActions,
  Scopes,
  BindingSources,
  type KeyChord,
  type Binding,
} from '@/lib/hotkeys';

// =============================================================================
// Types
// =============================================================================

export interface EditorHotkeyBinding {
  /** Key combination (e.g., 'ctrl+=', 'ctrl+-', 'ctrl+0') */
  keys: string;
  /** Action to execute */
  action: () => void;
  /** Description for which-key popup */
  description?: string;
}

export interface UseEditorScopedHotkeysOptions {
  /** Editor instance ID (for multiple editors) */
  editorId?: string;
  /** Keybindings to register when editor is focused */
  bindings?: EditorHotkeyBinding[];
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseEditorScopedHotkeysResult {
  /** Ref callback for the editor container */
  containerRef: (element: HTMLElement | null) => void;
  /** Whether the editor scope is currently active */
  isScopeActive: boolean;
  /** Manually activate editor scope */
  activateScope: () => void;
  /** Manually deactivate editor scope */
  deactivateScope: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse a simple key string into a KeyChord.
 * Supports: ctrl, alt, shift, meta (cmd) modifiers.
 *
 * Examples:
 *   'ctrl+=' → { ctrl: true, key: '=' }
 *   'ctrl+shift+p' → { ctrl: true, shift: true, key: 'p' }
 */
function parseKeyString(keyStr: string): KeyChord {
  const parts = keyStr.toLowerCase().split('+');
  const key = parts.pop() ?? '';

  const chord: KeyChord = {
    ctrl: parts.includes('ctrl'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    key: normalizeKey(key),
  };

  return chord;
}

/**
 * Normalize key name to match event.key format.
 */
function normalizeKey(key: string): string {
  switch (key) {
    case 'space':
      return ' ';
    case 'esc':
    case 'escape':
      return 'esc';
    case 'up':
      return 'up';
    case 'down':
      return 'down';
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    case 'backspace':
      return 'backspace';
    case 'delete':
      return 'delete';
    case 'enter':
      return 'enter';
    case 'tab':
      return 'tab';
    default:
      return key;
  }
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for scoped editor hotkeys.
 *
 * Usage:
 * ```tsx
 * function Editor() {
 *   const zoom = useEditorZoom()
 *
 *   const { containerRef } = useEditorScopedHotkeys({
 *     editorId: 'my-editor',
 *     bindings: [
 *       { keys: 'ctrl+=', action: zoom.actions.zoomIn, description: 'Zoom In' },
 *       { keys: 'ctrl+-', action: zoom.actions.zoomOut, description: 'Zoom Out' },
 *       { keys: 'ctrl+0', action: zoom.actions.reset, description: 'Reset Zoom' },
 *     ],
 *   })
 *
 *   return <div ref={containerRef} tabIndex={-1}>...</div>
 * }
 * ```
 */
export function useEditorScopedHotkeys(
  options: UseEditorScopedHotkeysOptions = {}
): UseEditorScopedHotkeysResult {
  const { editorId = 'editor', bindings = [], debug = false } = options;

  const registry = useContext(RegistryContext);
  const scopeActiveRef = useRef(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const registeredBindingsRef = useRef<Binding[]>([]);

  // Generate unique command IDs for this editor instance
  const makeCommandId = useCallback(
    (index: number) => `editor.${editorId}.action-${index}`,
    [editorId]
  );

  // Activate editor scope and register bindings
  const activateScope = useCallback(() => {
    if (scopeActiveRef.current) return;
    scopeActiveRef.current = true;

    if (debug) {
      console.log(`[useEditorScopedHotkeys] Activating scope for: ${editorId}`);
    }

    // Push editor scope
    hotkeyActions.pushScope(registry, Scopes.EDITOR);

    // Register bindings
    const registered: Binding[] = [];
    bindings.forEach((b, index) => {
      const commandId = makeCommandId(index);
      const chord = parseKeyString(b.keys);

      // Register command handler
      hotkeyActions.registerCommand(
        registry,
        {
          id: commandId,
          name: b.description ?? `Editor Action ${index}`,
          category: 'editor',
        },
        // Wrap action in Effect.sync
        Effect.sync(() => {
          b.action();
        })
      );

      // Register binding
      const binding: Binding = {
        keys: [chord],
        commandId,
        scope: Scopes.EDITOR,
        priority: 100, // High priority to override global
        source: BindingSources.DEFAULT,
        description: b.description,
      };
      hotkeyActions.addBinding(registry, binding);
      registered.push(binding);

      if (debug) {
        console.log(
          `[useEditorScopedHotkeys] Registered: ${b.keys} → ${commandId}`
        );
      }
    });

    registeredBindingsRef.current = registered;
  }, [registry, bindings, editorId, makeCommandId, debug]);

  // Deactivate editor scope and remove bindings
  const deactivateScope = useCallback(() => {
    if (!scopeActiveRef.current) return;
    scopeActiveRef.current = false;

    if (debug) {
      console.log(
        `[useEditorScopedHotkeys] Deactivating scope for: ${editorId}`
      );
    }

    // Remove registered bindings
    for (const binding of registeredBindingsRef.current) {
      hotkeyActions.removeBinding(registry, binding.keys, Scopes.EDITOR);
    }
    registeredBindingsRef.current = [];

    // Pop editor scope
    hotkeyActions.popScope(registry);
  }, [registry, editorId, debug]);

  // Container ref callback — attaches focus/blur handlers
  const containerRef = useCallback(
    (element: HTMLElement | null) => {
      // Cleanup old element
      if (elementRef.current) {
        elementRef.current.removeEventListener('focus', activateScope);
        elementRef.current.removeEventListener('blur', deactivateScope);
      }

      elementRef.current = element;

      // Setup new element
      if (element) {
        element.addEventListener('focus', activateScope, { capture: true });
        element.addEventListener('blur', deactivateScope, { capture: true });

        // If already focused, activate immediately
        if (
          document.activeElement === element ||
          element.contains(document.activeElement)
        ) {
          activateScope();
        }
      }
    },
    [activateScope, deactivateScope]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scopeActiveRef.current) {
        deactivateScope();
      }
    };
  }, [deactivateScope]);

  return {
    containerRef,
    isScopeActive: scopeActiveRef.current,
    activateScope,
    deactivateScope,
  };
}

export default useEditorScopedHotkeys;
