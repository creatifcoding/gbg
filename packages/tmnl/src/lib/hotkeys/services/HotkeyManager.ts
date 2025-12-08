/**
 * TMNL Hotkeys — HotkeyManager Service
 *
 * @deprecated Use atoms + hotkeyActions + processKeyboardEvent() instead.
 * This service maintains its own Effect.Ref state which is OPAQUE to effect-atom reactivity.
 *
 * Migration:
 *   HotkeyManager.bind(keys, commandId, opts)
 *     → hotkeyActions.addBinding(registry, binding)
 *
 *   HotkeyManager.processEvent(event)
 *     → processKeyboardEvent(chord, sequence, scopedBindings, commands)
 *
 *   HotkeyManager.getCurrentSequence()
 *     → useAtomValue(sequenceSourceAtom)
 *
 *   HotkeyManager.getActiveScope()
 *     → useAtomValue(activeScopeAtom)
 *
 *   HotkeyManager.setActiveScope(scope)
 *     → hotkeyActions.setScope(registry, scope)
 *
 *   HotkeyManager.getWhichKeyEntries()
 *     → useAtomValue(whichKeyEntriesAtom)
 *
 * This file will be removed in a future version.
 *
 * ---
 * Original description:
 * Core orchestrator for hotkey processing:
 * - Binding management (key sequences -> commands)
 * - Sequence tracking for multi-chord combos
 * - Prefix matching for which-key hints
 * - Scope-aware binding resolution
 * - Command execution via CommandRegistry
 */

import { Context, Effect, Layer, Ref, Option, Array as Arr } from 'effect'
import type {
  Binding,
  BindingMatch,
  BindingSource,
  CommandContext,
  HotkeyConfig,
  KeyChord,
  KeySequence,
  KeyString,
  Scope,
  ScopeId,
  WhichKeyEntry,
} from '../types'
import { DEFAULT_CONFIG, Scopes } from '../types'
import { KeyParser, KeyParserError } from './KeyParser'
import { CommandRegistry } from './CommandRegistry'

// ─────────────────────────────────────────────────────────────────────────────
// Service Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface HotkeyManagerService {
  // ─── Binding Management ────────────────────────────────────────────────────

  /** Register a binding */
  readonly bind: (
    keys: KeyString,
    commandId: string,
    options?: BindingOptions
  ) => Effect.Effect<void, KeyParserError>

  /** Remove a binding by key sequence */
  readonly unbind: (keys: KeyString) => Effect.Effect<boolean, KeyParserError>

  /** Get all bindings */
  readonly getBindings: () => Effect.Effect<readonly Binding[]>

  /** Get bindings for a specific command */
  readonly getBindingsForCommand: (commandId: string) => Effect.Effect<readonly Binding[]>

  // ─── Sequence State ────────────────────────────────────────────────────────

  /** Get current sequence (pending chords) */
  readonly getCurrentSequence: () => Effect.Effect<KeySequence>

  /** Clear current sequence */
  readonly resetSequence: () => Effect.Effect<void>

  /** Process a key chord, returning match result */
  readonly processChord: (chord: KeyChord) => Effect.Effect<ProcessResult>

  /** Process a keyboard event */
  readonly processEvent: (event: KeyboardEvent) => Effect.Effect<ProcessResult>

  // ─── Scope Management ──────────────────────────────────────────────────────

  /** Register a scope */
  readonly registerScope: (scope: Scope) => Effect.Effect<void>

  /** Get active scope */
  readonly getActiveScope: () => Effect.Effect<ScopeId>

  /** Set active scope */
  readonly setActiveScope: (scope: ScopeId) => Effect.Effect<void>

  /** Push scope (stacking) */
  readonly pushScope: (scope: ScopeId) => Effect.Effect<void>

  /** Pop scope (returns to previous) */
  readonly popScope: () => Effect.Effect<ScopeId | null>

  // ─── which-key Support ─────────────────────────────────────────────────────

  /** Get which-key entries for current prefix */
  readonly getWhichKeyEntries: () => Effect.Effect<readonly WhichKeyEntry[]>

  // ─── Configuration ─────────────────────────────────────────────────────────

  /** Get current config */
  readonly getConfig: () => Effect.Effect<HotkeyConfig>

  /** Update config */
  readonly updateConfig: (partial: Partial<HotkeyConfig>) => Effect.Effect<void>
}

export class HotkeyManager extends Context.Tag('tmnl/hotkeys/HotkeyManager')<
  HotkeyManager,
  HotkeyManagerService
>() {
  static Default = Layer.effect(
    this,
    Effect.gen(function* () {
      const keyParser = yield* KeyParser
      const commandRegistry = yield* CommandRegistry

      const bindingsRef = yield* Ref.make<readonly Binding[]>([])
      const sequenceRef = yield* Ref.make<KeySequence>([])
      const scopesRef = yield* Ref.make<Map<string, Scope>>(new Map())
      const scopeStackRef = yield* Ref.make<readonly ScopeId[]>([Scopes.GLOBAL])
      const configRef = yield* Ref.make<HotkeyConfig>(DEFAULT_CONFIG)

      return HotkeyManager.of(
        makeHotkeyManager(
          keyParser,
          commandRegistry,
          bindingsRef,
          sequenceRef,
          scopesRef,
          scopeStackRef,
          configRef
        )
      )
    })
  ).pipe(Layer.provide(KeyParser.Default), Layer.provide(CommandRegistry.Default))
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BindingOptions {
  readonly scope?: ScopeId
  readonly priority?: number
  readonly source?: BindingSource
  readonly description?: string
}

export type ProcessResult =
  | { type: 'exact'; binding: Binding }
  | { type: 'partial'; entries: readonly WhichKeyEntry[] }
  | { type: 'none'; reason: 'no-match' | 'timeout' | 'wrong-scope' }

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

interface KeyParserService {
  readonly parse: (keyString: KeyString) => Effect.Effect<KeySequence, KeyParserError>
  readonly serialize: (sequence: KeySequence) => string
  readonly normalizeKey: (key: string) => string
  readonly fromEvent: (event: KeyboardEvent) => KeyChord
  readonly chordsEqual: (a: KeyChord, b: KeyChord) => boolean
  readonly isPrefix: (sequence: KeySequence, prefix: KeySequence) => boolean
}

interface CommandRegistryService {
  readonly get: (id: string) => Effect.Effect<Option.Option<{ id: string; name: string }>>;
}

function makeHotkeyManager(
  keyParser: KeyParserService,
  commandRegistry: CommandRegistryService,
  bindingsRef: Ref.Ref<readonly Binding[]>,
  sequenceRef: Ref.Ref<KeySequence>,
  scopesRef: Ref.Ref<Map<string, Scope>>,
  scopeStackRef: Ref.Ref<readonly ScopeId[]>,
  configRef: Ref.Ref<HotkeyConfig>
): HotkeyManagerService {
  // ─── Helpers ───────────────────────────────────────────────────────────────

  const getActiveScope = (): Effect.Effect<ScopeId> =>
    Effect.map(Ref.get(scopeStackRef), (stack) => stack[stack.length - 1] ?? Scopes.GLOBAL)

  const getScopeChain = (scopeId: ScopeId): Effect.Effect<readonly ScopeId[]> =>
    Effect.gen(function* () {
      const scopes = yield* Ref.get(scopesRef)
      const config = yield* Ref.get(configRef)
      const chain: ScopeId[] = [scopeId]

      let current = scopeId
      while (true) {
        const parent = config.scopeInheritance[current]
        if (!parent || chain.includes(parent)) break
        chain.push(parent)
        current = parent
      }

      return chain
    })

  const isBindingInScope = (binding: Binding, scopeChain: readonly ScopeId[]): boolean =>
    scopeChain.includes(binding.scope)

  const sequencesMatch = (a: KeySequence, b: KeySequence): boolean => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!keyParser.chordsEqual(a[i], b[i])) return false
    }
    return true
  }

  const sequenceStartsWith = (sequence: KeySequence, prefix: KeySequence): boolean => {
    if (prefix.length >= sequence.length) return false
    for (let i = 0; i < prefix.length; i++) {
      if (!keyParser.chordsEqual(sequence[i], prefix[i])) return false
    }
    return true
  }

  // ─── Binding Management ────────────────────────────────────────────────────

  const bind = (
    keys: KeyString,
    commandId: string,
    options: BindingOptions = {}
  ): Effect.Effect<void, KeyParserError> =>
    Effect.gen(function* () {
      const sequence = yield* keyParser.parse(keys)

      const binding: Binding = {
        keys: sequence,
        commandId,
        scope: options.scope ?? Scopes.GLOBAL,
        priority: options.priority ?? 0,
        source: options.source ?? 'default',
        description: options.description,
      }

      yield* Ref.update(bindingsRef, (bindings) => {
        // Remove any existing binding with same keys and scope
        const filtered = bindings.filter(
          (b) => !sequencesMatch(b.keys, sequence) || b.scope !== binding.scope
        )
        return [...filtered, binding]
      })
    })

  const unbind = (keys: KeyString): Effect.Effect<boolean, KeyParserError> =>
    Effect.gen(function* () {
      const sequence = yield* keyParser.parse(keys)
      const activeScope = yield* getActiveScope()

      return yield* Ref.modify(bindingsRef, (bindings) => {
        const before = bindings.length
        const filtered = bindings.filter(
          (b) => !sequencesMatch(b.keys, sequence) || b.scope !== activeScope
        )
        return [filtered.length < before, filtered]
      })
    })

  const getBindings = (): Effect.Effect<readonly Binding[]> => Ref.get(bindingsRef)

  const getBindingsForCommand = (commandId: string): Effect.Effect<readonly Binding[]> =>
    Effect.map(Ref.get(bindingsRef), (bindings) =>
      bindings.filter((b) => b.commandId === commandId)
    )

  // ─── Sequence State ────────────────────────────────────────────────────────

  const getCurrentSequence = (): Effect.Effect<KeySequence> => Ref.get(sequenceRef)

  const resetSequence = (): Effect.Effect<void> => Ref.set(sequenceRef, [])

  const processChord = (chord: KeyChord): Effect.Effect<ProcessResult> =>
    Effect.gen(function* () {
      const currentSequence = yield* Ref.get(sequenceRef)
      const newSequence = [...currentSequence, chord] as KeySequence
      const bindings = yield* Ref.get(bindingsRef)
      const activeScope = yield* getActiveScope()
      const scopeChain = yield* getScopeChain(activeScope)

      // Filter to in-scope bindings
      const scopedBindings = bindings.filter((b) => isBindingInScope(b, scopeChain))

      // Look for exact match
      const exactMatch = scopedBindings
        .filter((b) => sequencesMatch(b.keys, newSequence))
        .sort((a, b) => b.priority - a.priority)[0]

      if (exactMatch) {
        yield* Ref.set(sequenceRef, [])
        return { type: 'exact', binding: exactMatch } as ProcessResult
      }

      // Look for partial matches (prefix)
      const partialMatches = scopedBindings.filter((b) =>
        sequenceStartsWith(b.keys, newSequence)
      )

      if (partialMatches.length > 0) {
        yield* Ref.set(sequenceRef, newSequence)

        // Build which-key entries
        const entries: WhichKeyEntry[] = []
        const seenKeys = new Set<string>()

        for (const b of partialMatches) {
          const nextChord = b.keys[newSequence.length]
          const keyStr = keyParser.serialize([nextChord])

          if (!seenKeys.has(keyStr)) {
            seenKeys.add(keyStr)

            // Check if this is a prefix to more bindings
            const nextSequence = [...newSequence, nextChord] as KeySequence
            const isPrefix = partialMatches.some(
              (other) =>
                other !== b && sequenceStartsWith(other.keys, nextSequence)
            )

            // Get command name
            const commandOpt = yield* commandRegistry.get(b.commandId)
            const label = Option.isSome(commandOpt)
              ? commandOpt.value.name
              : b.description ?? b.commandId

            entries.push({
              key: keyStr,
              label: isPrefix ? `+${label}` : label,
              isPrefix,
              binding: b,
            })
          }
        }

        return { type: 'partial', entries } as ProcessResult
      }

      // No match
      yield* Ref.set(sequenceRef, [])
      return { type: 'none', reason: 'no-match' } as ProcessResult
    })

  const processEvent = (event: KeyboardEvent): Effect.Effect<ProcessResult> =>
    Effect.gen(function* () {
      // Ignore modifier-only keypresses
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
        return { type: 'none', reason: 'no-match' } as ProcessResult
      }

      const chord = keyParser.fromEvent(event)
      return yield* processChord(chord)
    })

  // ─── Scope Management ──────────────────────────────────────────────────────

  const registerScope = (scope: Scope): Effect.Effect<void> =>
    Ref.update(scopesRef, (scopes) => {
      const newScopes = new Map(scopes)
      newScopes.set(scope.id, scope)
      return newScopes
    })

  const setActiveScope = (scope: ScopeId): Effect.Effect<void> =>
    Ref.update(scopeStackRef, (stack) => {
      if (stack.length === 0) return [scope]
      return [...stack.slice(0, -1), scope]
    })

  const pushScope = (scope: ScopeId): Effect.Effect<void> =>
    Ref.update(scopeStackRef, (stack) => [...stack, scope])

  const popScope = (): Effect.Effect<ScopeId | null> =>
    Ref.modify(scopeStackRef, (stack) => {
      if (stack.length <= 1) return [null, stack]
      const popped = stack[stack.length - 1]
      return [popped, stack.slice(0, -1)]
    })

  // ─── which-key Support ─────────────────────────────────────────────────────

  const getWhichKeyEntries = (): Effect.Effect<readonly WhichKeyEntry[]> =>
    Effect.gen(function* () {
      const result = yield* processChord({
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
        key: '', // Dummy chord to get current state
      })

      // That's not right — let's just compute from current sequence
      const currentSequence = yield* Ref.get(sequenceRef)
      const bindings = yield* Ref.get(bindingsRef)
      const activeScope = yield* getActiveScope()
      const scopeChain = yield* getScopeChain(activeScope)

      const scopedBindings = bindings.filter((b) => isBindingInScope(b, scopeChain))
      const partialMatches = scopedBindings.filter((b) =>
        currentSequence.length === 0 || sequenceStartsWith(b.keys, currentSequence)
      )

      const entries: WhichKeyEntry[] = []
      const seenKeys = new Set<string>()

      for (const b of partialMatches) {
        const nextIdx = currentSequence.length
        if (nextIdx >= b.keys.length) continue

        const nextChord = b.keys[nextIdx]
        const keyStr = keyParser.serialize([nextChord])

        if (!seenKeys.has(keyStr)) {
          seenKeys.add(keyStr)

          const nextSequence = [...currentSequence, nextChord] as KeySequence
          const isPrefix = partialMatches.some(
            (other) =>
              other !== b &&
              other.keys.length > nextSequence.length &&
              sequenceStartsWith(other.keys, nextSequence)
          )

          const commandOpt = yield* commandRegistry.get(b.commandId)
          const label = Option.isSome(commandOpt)
            ? commandOpt.value.name
            : b.description ?? b.commandId

          entries.push({
            key: keyStr,
            label: isPrefix ? `+${label}` : label,
            isPrefix,
            binding: b,
          })
        }
      }

      return entries
    })

  // ─── Configuration ─────────────────────────────────────────────────────────

  const getConfig = (): Effect.Effect<HotkeyConfig> => Ref.get(configRef)

  const updateConfig = (partial: Partial<HotkeyConfig>): Effect.Effect<void> =>
    Ref.update(configRef, (config) => ({ ...config, ...partial }))

  return {
    bind,
    unbind,
    getBindings,
    getBindingsForCommand,
    getCurrentSequence,
    resetSequence,
    processChord,
    processEvent,
    registerScope,
    getActiveScope,
    setActiveScope,
    pushScope,
    popScope,
    getWhichKeyEntries,
    getConfig,
    updateConfig,
  }
}
