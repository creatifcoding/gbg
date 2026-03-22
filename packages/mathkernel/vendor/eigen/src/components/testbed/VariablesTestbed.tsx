/**
 * Variables Testbed
 *
 * Demonstrates the Emacs-inspired variables system.
 */

import { useState, useMemo } from 'react'
import {
  useVariable,
  useVariableValue,
  useVariableGroups,
  useVariablePersistence,
  getAllVariableMetadata,
  getVariableGroups,
  type VariableMetadata,
} from '@/lib/variables'
// Import to register editor variables
import '@/lib/variables/defaults/editor'

// ─────────────────────────────────────────────────────────────────────────────
// Variable Editor Component
// ─────────────────────────────────────────────────────────────────────────────

interface VariableEditorProps {
  variableId: string
}

function VariableEditor({ variableId }: VariableEditorProps) {
  const { value, set, reset, isModified, source, metadata } = useVariable(variableId)

  if (!metadata) {
    return (
      <div className="p-2 text-red-400 text-sm">
        Variable not found: {variableId}
      </div>
    )
  }

  // Render input based on type
  const renderInput = () => {
    const typeDesc = metadata.typeDescription

    // Boolean
    if (typeDesc === 'boolean') {
      return (
        <button
          onClick={() => set(!value)}
          className={`px-3 py-1 rounded text-sm font-mono ${
            value
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-neutral-700 text-neutral-400 border border-neutral-600'
          }`}
        >
          {value ? 'true' : 'false'}
        </button>
      )
    }

    // Literal union (dropdown)
    if (typeDesc.includes('|') && typeDesc.includes('"')) {
      const options = typeDesc
        .split('|')
        .map((s) => s.trim().replace(/"/g, ''))
      return (
        <select
          value={value as string}
          onChange={(e) => set(e.target.value)}
          className="bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-sm font-mono text-neutral-200"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    }

    // Number
    if (typeDesc === 'number') {
      return (
        <input
          type="number"
          value={value as number}
          onChange={(e) => set(Number(e.target.value))}
          className="bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-sm font-mono text-neutral-200 w-24"
        />
      )
    }

    // String (default)
    return (
      <input
        type="text"
        value={value as string}
        onChange={(e) => set(e.target.value)}
        className="bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-sm font-mono text-neutral-200 flex-1"
      />
    )
  }

  return (
    <div className="p-3 bg-neutral-800/50 rounded border border-neutral-700/50 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <code className="text-sm text-cyan-400">{metadata.id}</code>
            {isModified && (
              <span className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                modified
              </span>
            )}
            <span className="text-xs text-neutral-500">
              source: {source}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            {metadata.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {renderInput()}
          {isModified && (
            <button
              onClick={reset}
              className="text-xs text-neutral-400 hover:text-neutral-200 px-2 py-1 bg-neutral-700 rounded"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-4 text-xs text-neutral-500">
        <span>
          type: <code className="text-neutral-400">{metadata.typeDescription}</code>
        </span>
        <span>scope: {metadata.scope}</span>
        {metadata.hasSetter && <span className="text-purple-400">has setter</span>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Panel
// ─────────────────────────────────────────────────────────────────────────────

interface GroupPanelProps {
  group: string
  variables: VariableMetadata[]
}

function GroupPanel({ group, variables }: GroupPanelProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="border border-neutral-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-neutral-800 hover:bg-neutral-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-neutral-200 font-medium capitalize">{group}</span>
          <span className="text-xs text-neutral-500">
            {variables.length} variable{variables.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-neutral-400">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <div className="p-3 space-y-2 bg-neutral-900/50">
          {variables.map((v) => (
            <VariableEditor key={v.id} variableId={v.id} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Preview
// ─────────────────────────────────────────────────────────────────────────────

function LivePreview() {
  const fontSize = useVariableValue<number>('editor.fontSize')
  const fontFamily = useVariableValue<string>('editor.fontFamily')
  const lineHeight = useVariableValue<number>('editor.lineHeight')
  const tabWidth = useVariableValue<number>('editor.tabWidth')
  const cursorStyle = useVariableValue<string>('editor.cursorStyle')
  const lineNumbers = useVariableValue<string>('editor.lineNumbers')
  const renderWhitespace = useVariableValue<string>('editor.renderWhitespace')

  const lines = [
    'function greet(name: string) {',
    `${'\t'}const message = \`Hello, \${name}!\`;`,
    `${'\t'}console.log(message);`,
    `${'\t'}return message;`,
    '}',
    '',
    'greet("World");',
  ]

  return (
    <div className="border border-neutral-700 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between">
        <span className="text-sm text-neutral-300 font-medium">Live Preview</span>
        <div className="flex gap-3 text-xs text-neutral-500">
          <span>fontSize: {fontSize}px</span>
          <span>tabWidth: {tabWidth}</span>
          <span>cursor: {cursorStyle}</span>
        </div>
      </div>
      <div
        className="p-4 bg-neutral-950 overflow-auto"
        style={{
          fontFamily,
          fontSize: `${fontSize}px`,
          lineHeight,
        }}
      >
        <pre className="text-neutral-200">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              {lineNumbers !== 'off' && (
                <span className="text-neutral-600 w-8 text-right pr-3 select-none">
                  {lineNumbers === 'relative' ? Math.abs(i - 3) || '•' : i + 1}
                </span>
              )}
              <span>
                {renderWhitespace === 'all'
                  ? line.replace(/\t/g, '→'.padEnd(tabWidth, ' ')).replace(/ /g, '·')
                  : line.replace(/\t/g, ' '.repeat(tabWidth))}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Testbed
// ─────────────────────────────────────────────────────────────────────────────

export function VariablesTestbed() {
  // Setup persistence
  useVariablePersistence()

  // Get all metadata
  const allMetadata = useMemo(() => getAllVariableMetadata(), [])
  const groups = useMemo(() => getVariableGroups(), [])

  // Group variables by group
  const variablesByGroup = useMemo(() => {
    const map = new Map<string, VariableMetadata[]>()
    for (const v of allMetadata) {
      const group = v.group
      if (!map.has(group)) {
        map.set(group, [])
      }
      map.get(group)!.push(v)
    }
    return map
  }, [allMetadata])

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-neutral-100">Variables Testbed</h1>
          <p className="text-neutral-400">
            Emacs-inspired variables system with Effect Schema validation.
            Changes persist to localStorage automatically.
          </p>
          <div className="flex gap-4 text-sm text-neutral-500">
            <span>{allMetadata.length} variables</span>
            <span>{groups.length} groups</span>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Variable editors */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-neutral-200">Configuration</h2>
            {groups.map((group) => (
              <GroupPanel
                key={group}
                group={group}
                variables={variablesByGroup.get(group) ?? []}
              />
            ))}
          </div>

          {/* Right: Live preview */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-neutral-200">Preview</h2>
            <LivePreview />

            {/* API Examples */}
            <div className="border border-neutral-700 rounded-lg p-4 bg-neutral-800/50 space-y-3">
              <h3 className="text-sm font-medium text-neutral-300">API Examples</h3>
              <pre className="text-xs text-neutral-400 font-mono overflow-auto">
{`// Define a variable
const myVar = defineVariable({
  id: 'custom.myVar',
  schema: Schema.Number,
  default: 42,
  description: 'A custom variable',
  group: 'custom',
  scope: 'global',
})

// Use in React
const { value, set } = useVariable('custom.myVar')

// Use in Effect
const val = yield* VariableService.get('custom.myVar')
yield* VariableService.set('custom.myVar', 100)`}
              </pre>
            </div>

            {/* Scope Resolution */}
            <div className="border border-neutral-700 rounded-lg p-4 bg-neutral-800/50 space-y-2">
              <h3 className="text-sm font-medium text-neutral-300">Scope Resolution</h3>
              <div className="text-xs text-neutral-400 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span>editor-local (buffer-specific)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>workspace (project-specific)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>user (persisted customization)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-neutral-500"></span>
                  <span>default (from definition)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VariablesTestbed
