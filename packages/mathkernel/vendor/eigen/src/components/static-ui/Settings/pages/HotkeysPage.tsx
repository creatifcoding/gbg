/**
 * Hotkeys Settings Page
 *
 * Compact hotkey configuration for the Settings modal.
 * Adapted from HotkeyTestbed for embedded use.
 *
 * @module
 */

import { useState, useCallback, useContext } from 'react'
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import { Search, Command, RotateCcw, Keyboard } from 'lucide-react'
import { Separator, Kbd } from '@/components/primitives'
import {
  bindingsSourceAtom,
  commandsSourceAtom,
  whichKeyEntriesAtom,
  sequenceSourceAtom,
  activeScopeAtom,
  hotkeyActions,
  Scopes,
} from '@/lib/hotkeys'
import type { Binding, KeyChord, KeySequence } from '@/lib/hotkeys'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function serializeChord(chord: KeyChord): string {
  const parts: string[] = []
  if (chord.ctrl) parts.push('Ctrl')
  if (chord.alt) parts.push('Alt')
  if (chord.shift) parts.push('Shift')
  if (chord.meta) parts.push('Cmd')
  let keyStr = chord.key
  if (chord.key === ' ') keyStr = 'Space'
  else if (chord.key === 'Escape') keyStr = 'Esc'
  else if (chord.key.length === 1) keyStr = chord.key.toUpperCase()
  parts.push(keyStr)
  return parts.join('+')
}

function serializeSequence(sequence: KeySequence): string {
  return sequence.map(serializeChord).join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

interface BindingRowProps {
  binding: Binding
  commandName?: string
  onEdit?: () => void
}

function BindingRow({ binding, commandName, onEdit }: BindingRowProps) {
  const keyStr = serializeSequence(binding.keys)
  const scopeColor = {
    global: 'text-cyan-400',
    editor: 'text-green-400',
    grid: 'text-purple-400',
    tldraw: 'text-orange-400',
  }[binding.scope] || 'text-neutral-400'

  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-neutral-900/50 transition-colors group">
      <div className="flex items-center gap-3 flex-1">
        <span className={`w-14 text-right ${scopeColor}`} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {binding.scope}
        </span>
        <span className="text-neutral-200" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          {commandName ?? binding.commandId}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <code
          className="text-cyan-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {keyStr}
        </code>
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-neutral-300 transition-all"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Edit
        </button>
      </div>
    </div>
  )
}

function ScopeFilter({
  scopes,
  activeScope,
  onScopeChange,
}: {
  scopes: string[]
  activeScope: string | null
  onScopeChange: (scope: string | null) => void
}) {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => onScopeChange(null)}
        className={`px-2 py-1 rounded-sm transition-colors ${
          activeScope === null
            ? 'bg-neutral-800 text-neutral-200'
            : 'text-neutral-500 hover:text-neutral-300'
        }`}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        All
      </button>
      {scopes.map((scope) => (
        <button
          key={scope}
          onClick={() => onScopeChange(scope)}
          className={`px-2 py-1 rounded-sm transition-colors ${
            activeScope === scope
              ? 'bg-neutral-800 text-neutral-200'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {scope}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export function HotkeysPage() {
  const registry = useContext(RegistryContext)
  const bindings = useAtomValue(bindingsSourceAtom)
  const commands = useAtomValue(commandsSourceAtom)
  const currentSequence = useAtomValue(sequenceSourceAtom)
  const whichKeyEntries = useAtomValue(whichKeyEntriesAtom)

  const [searchQuery, setSearchQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState<string | null>(null)

  // Get unique scopes
  const scopes = [...new Set(bindings.map((b) => b.scope))]

  // Filter bindings
  const filteredBindings = bindings.filter((b) => {
    const matchesScope = scopeFilter === null || b.scope === scopeFilter
    const matchesSearch =
      searchQuery === '' ||
      b.commandId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (commands.get(b.commandId)?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchesScope && matchesSearch
  })

  // Group by category
  const grouped = filteredBindings.reduce((acc, binding) => {
    const command = commands.get(binding.commandId)
    const category = command?.category ?? 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push(binding)
    return acc
  }, {} as Record<string, Binding[]>)

  const handleResetAll = useCallback(() => {
    // TODO: Implement reset to defaults
    console.log('[HotkeysPage] Reset all bindings')
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Header controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              type="text"
              placeholder="Search commands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 rounded-sm pl-8 pr-3 py-1.5 text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 w-64"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            />
          </div>
          <ScopeFilter scopes={scopes} activeScope={scopeFilter} onScopeChange={setScopeFilter} />
        </div>
        <button
          onClick={handleResetAll}
          className="flex items-center gap-1.5 px-2 py-1 text-neutral-500 hover:text-neutral-300 transition-colors"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          <RotateCcw size={12} />
          Reset All
        </button>
      </div>

      {/* Current sequence indicator */}
      {currentSequence.length > 0 && (
        <div className="mb-4 px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-sm">
          <div className="flex items-center gap-2">
            <Keyboard size={14} className="text-cyan-400" />
            <span className="text-cyan-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              Sequence in progress:
            </span>
            <code className="text-cyan-300" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              {serializeSequence(currentSequence)}
            </code>
          </div>
          {whichKeyEntries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {whichKeyEntries.slice(0, 5).map((entry, i) => (
                <span
                  key={i}
                  className="text-neutral-400"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  <span className="text-cyan-400">{entry.key}</span>
                  <span className="text-neutral-600 ml-1">→</span>
                  <span className="ml-1">{entry.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bindings list */}
      <div className="flex-1 overflow-auto -mx-6 px-6">
        {Object.entries(grouped).map(([category, categoryBindings]) => (
          <div key={category} className="mb-4">
            <h3
              className="text-neutral-500 uppercase tracking-wider mb-2 sticky top-0 bg-black py-1"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {category} ({categoryBindings.length})
            </h3>
            <div className="border border-neutral-800 rounded-sm divide-y divide-neutral-800">
              {categoryBindings.map((binding, i) => (
                <BindingRow
                  key={`${binding.commandId}-${i}`}
                  binding={binding}
                  commandName={commands.get(binding.commandId)?.name}
                />
              ))}
            </div>
          </div>
        ))}

        {filteredBindings.length === 0 && (
          <div className="text-center py-12">
            <Command size={32} className="mx-auto mb-3 text-neutral-700" />
            <div className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              No bindings found
            </div>
            <div className="text-neutral-600 mt-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              Try adjusting your search or scope filter
            </div>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="mt-4 pt-4 border-t border-neutral-800 flex items-center justify-between text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        <span>{filteredBindings.length} of {bindings.length} bindings shown</span>
        <span>{commands.size} commands registered</span>
      </div>
    </div>
  )
}

export default HotkeysPage
