/**
 * BlockTerminalTestbedV3 - Validation testbed for Terminal v3
 *
 * v3 Key Architecture:
 * - Reference-based blocks (AIResponseBlockV3 stores streamRef, not content)
 * - Content derived from ai-core via useAIBlockContent()
 * - XState machine for terminal states
 * - STX pattern for XState → effect-atom bridge
 * - NO dual-write: stream events go ONLY to ai-core
 *
 * @route /testbed/block-terminal-v3
 */

import { useCallback, useState, useMemo, useRef } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  // Main hook
  useBlockTerminal,
  useTerminalInput,
  // Atoms
  blocksAtom,
  blockCountAtom,
  // STX atoms
  terminalStateAtom,
  inputModeAtom,
  isStreamingAtom,
  isExecutingAtom,
  activeStreamIdAtom,
  cwdAtom,
  // Schemas
  isAIResponseBlock,
  isCommandBlock,
  isErrorBlock,
  type BlockV3,
  type AIResponseBlockV3,
  // Operations
  clearBlocks,
  // Provider
  TerminalRegistryProvider,
  // Components
  AIResponse,
  TerminalInput,
  type TerminalInputRef,
} from '@/lib/terminal/v3'
import { streamStateByIdAtom } from '@/lib/ai-core'
import { Trash2, Terminal, FolderOpen, Zap, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================================================
// AI Block Renderer (using AIResponse compound component)
// =============================================================================

function AIBlockRenderer({ block }: { block: AIResponseBlockV3 }) {
  // KEY v3 PATTERN: Use compound component that derives content from ai-core
  return (
    <AIResponse block={block}>
      <AIResponse.Header />
      <AIResponse.Prompt />
      <AIResponse.Thinking />
      <AIResponse.Content />
      <AIResponse.ToolCalls />
      <AIResponse.Error />
      <AIResponse.Meta />
    </AIResponse>
  )
}

// =============================================================================
// Command Block Renderer
// =============================================================================

function CommandBlockRenderer({ block }: { block: BlockV3 }) {
  if (block._tag !== 'command') return null

  return (
    <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-blue-400" />
          <span className="font-mono text-blue-400" style={{ fontSize: '12px' }}>
            Command
          </span>
        </div>
        <span className="font-mono text-white/30" style={{ fontSize: '10px' }}>
          {block.id.slice(0, 8)}
        </span>
      </div>
      <code className="text-white/90" style={{ fontSize: '13px' }}>
        $ {block.command}
      </code>
      {block.output && (
        <pre className="mt-2 text-white/70 whitespace-pre-wrap" style={{ fontSize: '12px' }}>
          {block.output}
        </pre>
      )}
    </div>
  )
}

// =============================================================================
// Generic Block Renderer
// =============================================================================

function BlockRenderer({ block }: { block: BlockV3 }) {
  if (isAIResponseBlock(block)) {
    return <AIBlockRenderer block={block} />
  }
  if (isCommandBlock(block)) {
    return <CommandBlockRenderer block={block} />
  }
  if (isErrorBlock(block)) {
    return (
      <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-400">
          <span className="font-mono" style={{ fontSize: '12px' }}>Error</span>
        </div>
        <div className="text-red-300 mt-2" style={{ fontSize: '13px' }}>
          {block.message}
        </div>
      </div>
    )
  }

  // System/other blocks
  return (
    <div className="border border-white/10 bg-white/5 rounded-lg p-4">
      <span className="text-white/50" style={{ fontSize: '12px' }}>
        {block._tag}
      </span>
    </div>
  )
}

// =============================================================================
// Testbed Inner (uses v3 hooks)
// =============================================================================

function TestbedInner() {
  const [showDebug, setShowDebug] = useState(true)

  // Ref for TerminalInput
  const inputRef = useRef<TerminalInputRef>(null)

  // v3 hooks
  const {
    blocks,
    state,
    inputMode,
    isStreaming,
    isExecuting,
    cwd,
    activeStreamId,
    executeCommand,
    executeAIQuery,
    abort,
    setMode,
    toggleMode,
  } = useBlockTerminal()

  // TerminalInput wiring hook
  const terminalInputProps = useTerminalInput({
    inputRef,
    autoFocus: true,
  })

  // Direct atom reads for debug
  const blockCount = useAtomValue(blockCountAtom)
  const terminalState = useAtomValue(terminalStateAtom)

  // Active stream state (from ai-core)
  // IMPORTANT: Always call useAtomValue unconditionally (Rules of Hooks)
  const activeStreamAtom = useMemo(
    () => streamStateByIdAtom(activeStreamId ?? '__no_active_stream__'),
    [activeStreamId]
  )
  const activeStreamStateRaw = useAtomValue(activeStreamAtom)
  const activeStreamState = activeStreamId ? activeStreamStateRaw : null

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/50">
        <div className="flex items-center gap-3">
          <Zap size={18} className="text-cyan-400" />
          <span className="font-mono font-medium">Block Terminal v3</span>
          <span className="text-white/30">|</span>
          <span
            className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-mono"
            style={{ fontSize: '10px' }}
          >
            reference-based
          </span>
          <span className="text-white/30">|</span>
          <span
            className="font-mono text-white/50 flex items-center gap-1"
            style={{ fontSize: '12px' }}
          >
            <FolderOpen size={12} />
            {cwd}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Machine state badge */}
          <div
            className={cn(
              'px-2 py-0.5 rounded font-mono',
              isStreaming ? 'bg-cyan-500/20 text-cyan-400' :
              isExecuting ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-white/10 text-white/50'
            )}
            style={{ fontSize: '10px' }}
          >
            {terminalState}
          </div>

          {/* Block count */}
          <div
            className="px-2 py-0.5 rounded font-mono bg-white/10 text-white/50"
            style={{ fontSize: '12px' }}
          >
            {blockCount} blocks
          </div>

          {/* Debug toggle */}
          <button
            onClick={() => setShowDebug((prev) => !prev)}
            className={cn(
              'px-2 py-1 rounded font-mono transition-colors',
              showDebug
                ? 'bg-magenta-500/20 text-magenta-400'
                : 'bg-white/10 text-white/50 hover:text-white'
            )}
            style={{ fontSize: '12px' }}
          >
            Debug
          </button>

          {/* Clear button */}
          <button
            onClick={clearBlocks}
            className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            style={{ fontSize: '12px' }}
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Terminal area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Blocks view */}
          <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
            {blocks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/30 font-mono">
                No blocks yet. Try a command or AI query.
              </div>
            ) : (
              blocks.map((block) => (
                <BlockRenderer key={block.id} block={block} />
              ))
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-2">
              {/* Mode toggle */}
              <button
                onClick={toggleMode}
                className={cn(
                  'px-3 py-2 rounded font-mono transition-colors',
                  inputMode === 'ai'
                    ? 'bg-magenta-500/20 text-magenta-400'
                    : inputMode === 'shell'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-cyan-500/20 text-cyan-400'
                )}
                style={{ fontSize: '12px' }}
              >
                {inputMode === 'ai' ? 'AI' : inputMode === 'shell' ? 'Shell' : 'Hybrid'}
              </button>

              {/* TerminalInput - properly wired to v3 state machine */}
              <div className="flex-1">
                <TerminalInput
                  ref={inputRef}
                  {...terminalInputProps}
                  className="bg-white/5 border border-white/10 rounded focus-within:border-cyan-500/50"
                  minHeight={40}
                  maxHeight={120}
                />
              </div>

              {/* Submit/Abort */}
              {(isStreaming || isExecuting) ? (
                <button
                  onClick={abort}
                  className="px-4 py-2 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-mono transition-colors"
                  style={{ fontSize: '12px' }}
                >
                  Abort
                </button>
              ) : (
                <button
                  onClick={terminalInputProps.onSubmit}
                  className="px-4 py-2 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 font-mono transition-colors"
                  style={{ fontSize: '12px' }}
                >
                  Run
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Debug panel */}
        {showDebug && (
          <div className="w-96 border-l border-white/10 bg-black/30 overflow-auto">
            <div className="p-3 border-b border-white/10">
              <h3 className="font-mono font-medium text-white/70 flex items-center gap-2">
                <Activity size={14} className="text-cyan-400" />
                v3 Debug Panel
              </h3>
            </div>

            <div className="p-3 space-y-4">
              {/* XState machine state */}
              <div>
                <h4
                  className="font-mono text-white/50 uppercase tracking-wider mb-2"
                  style={{ fontSize: '10px' }}
                >
                  XState Machine
                </h4>
                <div className="space-y-1 font-mono" style={{ fontSize: '12px' }}>
                  <div className="flex justify-between">
                    <span className="text-white/50">State:</span>
                    <span className={cn(
                      terminalState === 'idle' ? 'text-white/50' :
                      terminalState === 'streaming' ? 'text-cyan-400' :
                      terminalState === 'executing' ? 'text-yellow-400' :
                      'text-red-400'
                    )}>
                      {terminalState}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Input Mode:</span>
                    <span className="text-magenta-400">{inputMode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Streaming:</span>
                    <span className={isStreaming ? 'text-green-400' : 'text-white/30'}>
                      {isStreaming ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Executing:</span>
                    <span className={isExecuting ? 'text-green-400' : 'text-white/30'}>
                      {isExecuting ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Active stream (from ai-core) */}
              {activeStreamId && (
                <div>
                  <h4
                    className="font-mono text-white/50 uppercase tracking-wider mb-2"
                    style={{ fontSize: '10px' }}
                  >
                    Active Stream (ai-core)
                  </h4>
                  <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/20">
                    <div className="space-y-1 font-mono" style={{ fontSize: '11px' }}>
                      <div className="text-cyan-400 truncate">
                        ID: {activeStreamId.slice(0, 20)}...
                      </div>
                      <div className="text-white/50">
                        Status: {activeStreamState?.status ?? 'unknown'}
                      </div>
                      <div className="text-white/50">
                        Text length: {activeStreamState?.text?.length ?? 0}
                      </div>
                      <div className="text-white/50">
                        Thinking: {activeStreamState?.thinking ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* v3 Architecture highlight */}
              <div>
                <h4
                  className="font-mono text-white/50 uppercase tracking-wider mb-2"
                  style={{ fontSize: '10px' }}
                >
                  v3 Architecture
                </h4>
                <div className="p-2 rounded bg-green-500/10 border border-green-500/20 space-y-1" style={{ fontSize: '11px' }}>
                  <div className="text-green-400">
                    ✓ Reference-based blocks
                  </div>
                  <div className="text-green-400">
                    ✓ Content from ai-core
                  </div>
                  <div className="text-green-400">
                    ✓ XState machine
                  </div>
                  <div className="text-green-400">
                    ✓ NO dual-write
                  </div>
                </div>
              </div>

              {/* Recent blocks */}
              <div>
                <h4
                  className="font-mono text-white/50 uppercase tracking-wider mb-2"
                  style={{ fontSize: '10px' }}
                >
                  Recent Blocks
                </h4>
                <div className="space-y-2">
                  {blocks.slice(-5).reverse().map((block) => (
                    <div
                      key={block.id}
                      className={cn(
                        'p-2 rounded border',
                        block._tag === 'command'
                          ? 'border-blue-500/30 bg-blue-500/5'
                          : block._tag === 'ai-response'
                            ? 'border-magenta-500/30 bg-magenta-500/5'
                            : block._tag === 'error'
                              ? 'border-red-500/30 bg-red-500/5'
                              : 'border-white/10 bg-white/5'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="font-mono text-white/50"
                          style={{ fontSize: '10px' }}
                        >
                          {block._tag}
                        </span>
                        <span
                          className="font-mono text-white/30"
                          style={{ fontSize: '10px' }}
                        >
                          {block.id.slice(0, 8)}
                        </span>
                      </div>
                      {block._tag === 'ai-response' && (
                        <div
                          className="font-mono text-cyan-400/70"
                          style={{ fontSize: '10px' }}
                        >
                          streamRef: {block.streamRef.requestId.slice(0, 16)}...
                        </div>
                      )}
                    </div>
                  ))}
                  {blocks.length === 0 && (
                    <div
                      className="text-white/30 font-mono text-center py-4"
                      style={{ fontSize: '12px' }}
                    >
                      No blocks yet
                    </div>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div>
                <h4
                  className="font-mono text-white/50 uppercase tracking-wider mb-2"
                  style={{ fontSize: '10px' }}
                >
                  Quick Actions
                </h4>
                <div className="space-y-1">
                  <button
                    onClick={() => executeCommand('echo "Hello from v3!"')}
                    disabled={isStreaming || isExecuting}
                    className="w-full text-left px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-white/70 transition-colors disabled:opacity-50"
                    style={{ fontSize: '12px' }}
                  >
                    <code>echo "Hello from v3!"</code>
                  </button>
                  <button
                    onClick={() => executeCommand('ls -la')}
                    disabled={isStreaming || isExecuting}
                    className="w-full text-left px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-white/70 transition-colors disabled:opacity-50"
                    style={{ fontSize: '12px' }}
                  >
                    <code>ls -la</code>
                  </button>
                  <button
                    onClick={() => executeAIQuery('What is 2+2?')}
                    disabled={isStreaming || isExecuting}
                    className="w-full text-left px-2 py-1.5 rounded bg-magenta-500/10 hover:bg-magenta-500/20 text-magenta-300 transition-colors disabled:opacity-50"
                    style={{ fontSize: '12px' }}
                  >
                    AI: What is 2+2?
                  </button>
                  <button
                    onClick={() => executeAIQuery('Explain the v3 terminal architecture')}
                    disabled={isStreaming || isExecuting}
                    className="w-full text-left px-2 py-1.5 rounded bg-magenta-500/10 hover:bg-magenta-500/20 text-magenta-300 transition-colors disabled:opacity-50"
                    style={{ fontSize: '12px' }}
                  >
                    AI: Explain v3 architecture
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Main Export (with Provider)
// =============================================================================

export function BlockTerminalTestbedV3() {
  return (
    <TerminalRegistryProvider>
      <TestbedInner />
    </TerminalRegistryProvider>
  )
}

export default BlockTerminalTestbedV3
