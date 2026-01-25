/**
 * TMNL Hotkeys — Reactive Atoms
 *
 * Atoms as source of truth. No React context needed.
 * Services become pure functions operating on atom values.
 *
 * Pattern from receipts submodule:
 * - Source atoms hold state
 * - Derived atoms compute from sources
 * - runtime.fn() for Effects that need services
 */

import { Atom } from '@effect-atom/atom'
import { Effect, Layer, Option } from 'effect'
import type {
  Binding,
  BindingSource,
  Command,
  CommandConfig,
  CommandError,
  HotkeyConfig,
  KeyChord,
  KeySequence,
  KeyString,
  ScopeId,
  WhichKeyEntry,
} from '../types'
import { DEFAULT_CONFIG } from '../types'
import { Scopes } from '../ScopeRegistry'
import { KeyParser, KeyParserError } from '../services/KeyParser'

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE ATOMS (the actual state)
// ─────────────────────────────────────────────────────────────────────────────

/** All registered bindings */
export const bindingsSourceAtom = Atom.make<readonly Binding[]>([])

/** Current key sequence buffer (for multi-chord sequences like 'g i') */
export const sequenceSourceAtom = Atom.make<KeySequence>([])

/** Scope stack (last element is active) */
export const scopeStackSourceAtom = Atom.make<readonly ScopeId[]>([Scopes.GLOBAL])

/** Registered commands */
export const commandsSourceAtom = Atom.make<ReadonlyMap<string, Command>>(new Map())

/** Configuration */
export const configSourceAtom = Atom.make<HotkeyConfig>(DEFAULT_CONFIG)

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED ATOMS (computed from sources)
// ─────────────────────────────────────────────────────────────────────────────

/** Active scope (top of stack) */
export const activeScopeAtom = Atom.make((get) => {
  const stack = get(scopeStackSourceAtom)
  return stack[stack.length - 1] ?? Scopes.GLOBAL
})

/** Scope inheritance chain for active scope */
export const scopeChainAtom = Atom.make((get) => {
  const activeScope = get(activeScopeAtom)
  const config = get(configSourceAtom)
  const chain: ScopeId[] = [activeScope]

  let current = activeScope
  while (true) {
    const parent = config.scopeInheritance[current]
    if (!parent || chain.includes(parent)) break
    chain.push(parent)
    current = parent
  }

  return chain as readonly ScopeId[]
})

/** Bindings filtered to active scope chain */
export const scopedBindingsAtom = Atom.make((get) => {
  const bindings = get(bindingsSourceAtom)
  const scopeChain = get(scopeChainAtom)
  return bindings.filter((b) => scopeChain.includes(b.scope))
})

/** which-key entries for current sequence prefix */
export const whichKeyEntriesAtom = Atom.make((get) => {
  const bindings = get(scopedBindingsAtom)
  const sequence = get(sequenceSourceAtom)
  const commands = get(commandsSourceAtom)

  // Find bindings that start with current sequence
  const partialMatches = bindings.filter((b) =>
    sequence.length === 0 || isSequencePrefix(sequence, b.keys)
  )

  const entries: WhichKeyEntry[] = []
  const seenKeys = new Set<string>()

  for (const binding of partialMatches) {
    const nextIdx = sequence.length
    if (nextIdx >= binding.keys.length) continue

    const nextChord = binding.keys[nextIdx]
    const keyStr = serializeChord(nextChord)

    if (!seenKeys.has(keyStr)) {
      seenKeys.add(keyStr)

      // Check if this leads to more keys
      const nextSequence = [...sequence, nextChord] as KeySequence
      const isPrefix = partialMatches.some(
        (other) =>
          other !== binding &&
          other.keys.length > nextSequence.length &&
          isSequencePrefix(nextSequence, other.keys)
      )

      // Get command name
      const command = commands.get(binding.commandId)
      const label = command?.name ?? binding.description ?? binding.commandId

      entries.push({
        key: keyStr,
        label: isPrefix ? `+${label}` : label,
        isPrefix,
        binding,
      })
    }
  }

  return entries as readonly WhichKeyEntry[]
})

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME ATOM (for Effect services that need DI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runtime atom for operations that need Effect services (like KeyParser).
 * Most operations can use pure functions + source atoms directly.
 */
export const hotkeyRuntimeAtom = Atom.runtime(KeyParser.Default)

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Check if a sequence is a prefix of another */
function isSequencePrefix(prefix: KeySequence, full: KeySequence): boolean {
  if (prefix.length >= full.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (!chordsEqual(prefix[i], full[i])) return false
  }
  return true
}

/** Check if two chords are equal */
function chordsEqual(a: KeyChord, b: KeyChord): boolean {
  return (
    a.ctrl === b.ctrl &&
    a.alt === b.alt &&
    a.shift === b.shift &&
    a.meta === b.meta &&
    a.key === b.key
  )
}

/** Check if two sequences are equal */
function sequencesEqual(a: KeySequence, b: KeySequence): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!chordsEqual(a[i], b[i])) return false
  }
  return true
}

/** Serialize a chord to string */
function serializeChord(chord: KeyChord): string {
  const parts: string[] = []
  if (chord.ctrl) parts.push('ctrl')
  if (chord.alt) parts.push('alt')
  if (chord.shift) parts.push('shift')
  if (chord.meta) parts.push('cmd')

  let keyStr = chord.key
  if (chord.key === ' ') keyStr = 'space'
  else if (chord.key === 'Escape') keyStr = 'esc'
  else if (chord.key === 'ArrowUp') keyStr = 'up'
  else if (chord.key === 'ArrowDown') keyStr = 'down'
  else if (chord.key === 'ArrowLeft') keyStr = 'left'
  else if (chord.key === 'ArrowRight') keyStr = 'right'

  parts.push(keyStr)
  return parts.join('+')
}

/** Serialize a sequence to string */
function serializeSequence(sequence: KeySequence): string {
  return sequence.map(serializeChord).join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONS (write to source atoms)
// ─────────────────────────────────────────────────────────────────────────────

export type ProcessResult =
  | { type: 'exact'; binding: Binding }
  | { type: 'partial'; entries: readonly WhichKeyEntry[] }
  | { type: 'none'; reason: 'no-match' | 'timeout' | 'wrong-scope' }

/**
 * Hotkey operations.
 *
 * These use runtime.fn() for operations that need KeyParser (Effect service).
 * Mutations write to source atoms, triggering reactive updates.
 */
export const hotkeyOps = {
  /** Bind a key sequence to a command */
  bind: hotkeyRuntimeAtom.fn(
    (
      keys: KeyString,
      commandId: string,
      options?: { scope?: ScopeId; priority?: number; source?: BindingSource }
    ) =>
      Effect.gen(function* () {
        const parser = yield* KeyParser
        const sequence = yield* parser.parse(keys)

        const binding: Binding = {
          keys: sequence,
          commandId,
          scope: options?.scope ?? Scopes.GLOBAL,
          priority: options?.priority ?? 0,
          source: options?.source ?? 'default',
        }

        // Write to source atom - this is the key!
        // We need to return an action that the caller executes with registry
        return { type: 'bind' as const, binding, sequence }
      })
  ),

  /** Parse keys using KeyParser service */
  parseKeys: hotkeyRuntimeAtom.fn((keys: KeyString) =>
    Effect.gen(function* () {
      const parser = yield* KeyParser
      return yield* parser.parse(keys)
    })
  ),

  /** Create chord from keyboard event */
  fromEvent: hotkeyRuntimeAtom.fn((event: KeyboardEvent) =>
    Effect.gen(function* () {
      const parser = yield* KeyParser
      return parser.fromEvent(event)
    })
  ),
}

/**
 * Registry-aware operations.
 * These directly mutate source atoms via registry.
 *
 * Usage:
 * ```tsx
 * const registry = useRegistry()
 * hotkeyActions.addBinding(registry, binding)
 * ```
 */
export const hotkeyActions = {
  /** Add a binding to source atom */
  addBinding: (
    registry: { get: <A>(atom: Atom.Atom<A>) => A; set: <A>(atom: Atom.Writable<A, A>, value: A) => void },
    binding: Binding
  ) => {
    const prev = registry.get(bindingsSourceAtom)
    // Remove existing binding with same keys and scope
    const filtered = prev.filter(
      (b) => !sequencesEqual(b.keys, binding.keys) || b.scope !== binding.scope
    )
    registry.set(bindingsSourceAtom, [...filtered, binding])
  },

  /** Remove a binding */
  removeBinding: (
    registry: { get: <A>(atom: Atom.Atom<A>) => A; set: <A>(atom: Atom.Writable<A, A>, value: A) => void },
    keys: KeySequence,
    scope: ScopeId
  ) => {
    const prev = registry.get(bindingsSourceAtom)
    registry.set(bindingsSourceAtom, prev.filter((b) => !sequencesEqual(b.keys, keys) || b.scope !== scope))
  },

  /** Register a command */
  registerCommand: <R>(
    registry: { get: <A>(atom: Atom.Atom<A>) => A; set: <A>(atom: Atom.Writable<A, A>, value: A) => void },
    config: CommandConfig,
    handler: Effect.Effect<void, CommandError, R>
  ) => {
    const command: Command = {
      ...config,
      handler: handler as Effect.Effect<void, CommandError, never>,
    }
    const prev = registry.get(commandsSourceAtom)
    const next = new Map(prev)
    next.set(config.id, command)
    registry.set(commandsSourceAtom, next)
  },

  /** Append chord to sequence */
  appendToSequence: (
    registry: { get: <A>(atom: Atom.Atom<A>) => A; set: <A>(atom: Atom.Writable<A, A>, value: A) => void },
    chord: KeyChord
  ) => {
    const prev = registry.get(sequenceSourceAtom)
    registry.set(sequenceSourceAtom, [...prev, chord] as KeySequence)
  },

  /** Reset sequence */
  resetSequence: (
    registry: { set: <A>(atom: Atom.Writable<A, A>, value: A) => void }
  ) => {
    registry.set(sequenceSourceAtom, [])
  },

  /** Set active scope */
  setScope: (
    registry: { get: <A>(atom: Atom.Atom<A>) => A; set: <A>(atom: Atom.Writable<A, A>, value: A) => void },
    scope: ScopeId
  ) => {
    const prev = registry.get(scopeStackSourceAtom)
    if (prev.length === 0) {
      registry.set(scopeStackSourceAtom, [scope])
    } else {
      registry.set(scopeStackSourceAtom, [...prev.slice(0, -1), scope])
    }
  },

  /** Push scope onto stack */
  pushScope: (
    registry: { get: <A>(atom: Atom.Atom<A>) => A; set: <A>(atom: Atom.Writable<A, A>, value: A) => void },
    scope: ScopeId
  ) => {
    const prev = registry.get(scopeStackSourceAtom)
    registry.set(scopeStackSourceAtom, [...prev, scope])
  },

  /** Pop scope from stack */
  popScope: (
    registry: { get: <A>(atom: Atom.Atom<A>) => A; set: <A>(atom: Atom.Writable<A, A>, value: A) => void }
  ): ScopeId | null => {
    const prev = registry.get(scopeStackSourceAtom)
    if (prev.length <= 1) return null
    const popped = prev[prev.length - 1]
    registry.set(scopeStackSourceAtom, prev.slice(0, -1))
    return popped
  },

  /** Update config */
  updateConfig: (
    registry: { get: <A>(atom: Atom.Atom<A>) => A; set: <A>(atom: Atom.Writable<A, A>, value: A) => void },
    partial: Partial<HotkeyConfig>
  ) => {
    const prev = registry.get(configSourceAtom)
    registry.set(configSourceAtom, { ...prev, ...partial })
  },
}

/**
 * Process a keyboard event and return what action to take.
 * Pure function - caller handles side effects.
 */
export function processKeyboardEvent(
  chord: KeyChord,
  currentSequence: KeySequence,
  scopedBindings: readonly Binding[],
  commands: ReadonlyMap<string, Command>
): {
  result: ProcessResult
  newSequence: KeySequence
} {
  const newSequence = [...currentSequence, chord] as KeySequence

  // Look for exact match
  const exactMatch = scopedBindings
    .filter((b) => sequencesEqual(b.keys, newSequence))
    .sort((a, b) => b.priority - a.priority)[0]

  if (exactMatch) {
    return {
      result: { type: 'exact', binding: exactMatch },
      newSequence: [], // Reset on match
    }
  }

  // Look for partial matches
  const partialMatches = scopedBindings.filter((b) =>
    isSequencePrefix(newSequence, b.keys)
  )

  if (partialMatches.length > 0) {
    // Build which-key entries
    const entries: WhichKeyEntry[] = []
    const seenKeys = new Set<string>()

    for (const b of partialMatches) {
      const nextChord = b.keys[newSequence.length]
      const keyStr = serializeChord(nextChord)

      if (!seenKeys.has(keyStr)) {
        seenKeys.add(keyStr)

        const nextSeq = [...newSequence, nextChord] as KeySequence
        const isPrefix = partialMatches.some(
          (other) => other !== b && isSequencePrefix(nextSeq, other.keys)
        )

        const command = commands.get(b.commandId)
        const label = command?.name ?? b.description ?? b.commandId

        entries.push({
          key: keyStr,
          label: isPrefix ? `+${label}` : label,
          isPrefix,
          binding: b,
        })
      }
    }

    return {
      result: { type: 'partial', entries },
      newSequence,
    }
  }

  // No match
  return {
    result: { type: 'none', reason: 'no-match' },
    newSequence: [], // Reset on no match
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND PALETTE SUPPORT
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandSearchResult {
  readonly command: Command
  readonly score: number
  readonly matches: readonly [number, number][]
}

/**
 * Fuzzy search scoring for command palette.
 *
 * Returns a score (0-1) based on:
 * - Character matches
 * - Consecutive matches bonus
 * - Start-of-word bonus
 */
function fuzzyMatch(
  pattern: string,
  text: string
): { score: number; matches: [number, number][] } | null {
  const patternLower = pattern.toLowerCase()
  const textLower = text.toLowerCase()

  if (patternLower.length === 0) {
    return { score: 1, matches: [] }
  }

  if (patternLower.length > textLower.length) {
    return null
  }

  const matches: [number, number][] = []
  let patternIdx = 0
  let matchStart = -1
  let score = 0
  let consecutiveBonus = 0

  for (
    let textIdx = 0;
    textIdx < textLower.length && patternIdx < patternLower.length;
    textIdx++
  ) {
    if (textLower[textIdx] === patternLower[patternIdx]) {
      if (matchStart === -1) {
        matchStart = textIdx
      }

      score += 1
      score += consecutiveBonus * 0.5
      consecutiveBonus++

      if (textIdx === 0 || /[\s._-]/.test(text[textIdx - 1])) {
        score += 2
      }

      patternIdx++
    } else {
      if (matchStart !== -1) {
        matches.push([matchStart, textIdx])
        matchStart = -1
      }
      consecutiveBonus = 0
    }
  }

  if (matchStart !== -1) {
    matches.push([matchStart, patternIdx + matchStart])
  }

  if (patternIdx !== patternLower.length) {
    return null
  }

  const normalizedScore = score / (patternLower.length * 3.5)

  return {
    score: Math.min(1, normalizedScore),
    matches,
  }
}

/**
 * Search commands with fuzzy matching (for M-x style command palette).
 * Pure function - reads from commands map.
 */
export function searchCommands(
  commands: ReadonlyMap<string, Command>,
  query: string
): readonly CommandSearchResult[] {
  const results: CommandSearchResult[] = []

  for (const command of commands.values()) {
    const nameMatch = fuzzyMatch(query, command.name)
    const idMatch = fuzzyMatch(query, command.id)
    const descMatch = command.description ? fuzzyMatch(query, command.description) : null

    const bestMatch = [nameMatch, idMatch, descMatch]
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.score - a.score)[0]

    if (bestMatch) {
      results.push({
        command,
        score: bestMatch.score,
        matches: bestMatch.matches,
      })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

/**
 * Get unique command categories.
 * Pure function - reads from commands map.
 */
export function getCategories(commands: ReadonlyMap<string, Command>): readonly string[] {
  const cats = new Set<string>()
  for (const cmd of commands.values()) {
    if (cmd.category) {
      cats.add(cmd.category)
    }
  }
  return Array.from(cats).sort()
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY EXPORTS (for gradual migration)
// ─────────────────────────────────────────────────────────────────────────────

// Re-export source atoms with legacy names
export const bindingsAtom = bindingsSourceAtom
export const currentSequenceAtom = sequenceSourceAtom
export const configAtom = configSourceAtom
