/**
 * BlockTerminalTestbed - Validation testbed for Terminal v2 Block Mode
 *
 * Tests:
 * - Block-based terminal (OpenWarp mode)
 * - BlockInput component (Terminal/AI mode toggle)
 * - BlocksView container
 * - Natural language detection
 * - CLI command detection
 * - Effect-atom state management
 *
 * @route /testbed/block-terminal
 */

import { useCallback, useState } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  useBlockTerminal,
  BlocksView,
  BlockInput,
  blocksAtom,
  blockCwdAtom,
  blockCountAtom,
  hasActiveBlockAtom,
  clearBlocks,
  type ThinkingLevel,
} from '@/lib/terminal/v2'
import { Trash2, Terminal, Sparkles, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BlockTerminalTestbed() {
  const [showDebug, setShowDebug] = useState(true)

  // Use the block terminal hook
  const {
    blocks,
    cwd,
    executeCommand,
    executeAIQuery,
    containerRef,
  } = useBlockTerminal({
    initialCwd: '~',
    maxBlocks: 100,
    autoScroll: true,
  })

  // Derived state from atoms
  const blockCount = useAtomValue(blockCountAtom)
  const hasActiveBlock = useAtomValue(hasActiveBlockAtom)

  // Handle submit from BlockInput
  const handleSubmit = useCallback(
    async (command: string, isAI: boolean, thinkingLevel?: ThinkingLevel) => {
      if (isAI) {
        await executeAIQuery(command, thinkingLevel)
      } else {
        await executeCommand(command)
      }
    },
    [executeCommand, executeAIQuery]
  )

  // Clear all blocks
  const handleClear = useCallback(() => {
    clearBlocks()
  }, [])

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/50">
        <div className="flex items-center gap-3">
          <Terminal size={18} className="text-cyan-400" />
          <span className="font-mono font-medium">Block Terminal v2</span>
          <span className="text-white/30">|</span>
          <span
            className="font-mono text-white/50 flex items-center gap-1"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <FolderOpen size={12} />
            {cwd}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Block count badge */}
          <div
            className={cn(
              'px-2 py-0.5 rounded font-mono',
              hasActiveBlock
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-white/10 text-white/50'
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
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
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Debug
          </button>

          {/* Clear button */}
          <button
            onClick={handleClear}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded',
              'bg-red-500/10 text-red-400 hover:bg-red-500/20',
              'transition-colors'
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Terminal area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Blocks view */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <BlocksView
              blocks={blocks}
              containerRef={containerRef}
              autoScroll
              className="h-full"
            />
          </div>

          {/* Input area */}
          <BlockInput onSubmit={handleSubmit} />
        </div>

        {/* Debug panel */}
        {showDebug && (
          <div className="w-80 border-l border-white/10 bg-black/30 overflow-auto">
            <div className="p-3 border-b border-white/10">
              <h3 className="font-mono font-medium text-white/70 flex items-center gap-2">
                <Sparkles size={14} className="text-magenta-400" />
                Debug Panel
              </h3>
            </div>

            <div className="p-3 space-y-4">
              {/* State summary */}
              <div>
                <h4
                  className="font-mono text-white/50 uppercase tracking-wider mb-2"
                  style={{ fontSize: '10px' }}
                >
                  State
                </h4>
                <div className="space-y-1 font-mono" style={{ fontSize: '12px' }}>
                  <div className="flex justify-between">
                    <span className="text-white/50">Blocks:</span>
                    <span className="text-cyan-400">{blockCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Active:</span>
                    <span className={hasActiveBlock ? 'text-green-400' : 'text-white/30'}>
                      {hasActiveBlock ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">CWD:</span>
                    <span className="text-yellow-400 truncate max-w-[120px]">{cwd}</span>
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
                        block._tag === 'CommandBlock'
                          ? 'border-blue-500/30 bg-blue-500/5'
                          : block._tag === 'AIResponseBlock'
                            ? 'border-magenta-500/30 bg-magenta-500/5'
                            : block._tag === 'ErrorBlock'
                              ? 'border-red-500/30 bg-red-500/5'
                              : 'border-white/10 bg-white/5'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="font-mono text-white/50"
                          style={{ fontSize: '10px' }}
                        >
                          {block._tag.replace('Block', '')}
                        </span>
                        <span
                          className="font-mono text-white/30"
                          style={{ fontSize: '10px' }}
                        >
                          {block.id.slice(0, 8)}
                        </span>
                      </div>
                      <div
                        className="font-mono text-white/70 truncate"
                        style={{ fontSize: '11px' }}
                      >
                        {block._tag === 'CommandBlock'
                          ? block.command
                          : block._tag === 'AIResponseBlock'
                            ? block.prompt.slice(0, 50) + '...'
                            : block._tag === 'ErrorBlock'
                              ? block.message
                              : 'System message'}
                      </div>
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
                    onClick={() => executeCommand('echo "Hello from TMNL!"')}
                    className="w-full text-left px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
                    style={{ fontSize: '12px' }}
                  >
                    <code>echo "Hello from TMNL!"</code>
                  </button>
                  <button
                    onClick={() => executeCommand('ls -la')}
                    className="w-full text-left px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
                    style={{ fontSize: '12px' }}
                  >
                    <code>ls -la</code>
                  </button>
                  <button
                    onClick={() => executeCommand('pwd')}
                    className="w-full text-left px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
                    style={{ fontSize: '12px' }}
                  >
                    <code>pwd</code>
                  </button>
                  <button
                    onClick={() => executeAIQuery('What files are in this directory?')}
                    className="w-full text-left px-2 py-1.5 rounded bg-magenta-500/10 hover:bg-magenta-500/20 text-magenta-300 transition-colors"
                    style={{ fontSize: '12px' }}
                  >
                    AI: What files are here?
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

export default BlockTerminalTestbed
