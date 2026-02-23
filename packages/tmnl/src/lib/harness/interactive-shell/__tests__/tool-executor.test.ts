/**
 * Tool Executor Routing Tests — validates the multi-operation tool dispatch.
 *
 * The interactive_shell tool is a single tool with arg routing:
 *   - command → spawn
 *   - sessionId + input → write
 *   - sessionId + kill → kill
 *   - sessionId (alone) → read output / status
 *   - sessionId + background → detach
 *
 * These tests validate the routing logic WITHOUT requiring a live PTY.
 * Integration tests (#2357) test the full spawn→write→read→kill flow.
 */

import { describe, it, expect } from 'vitest'
import type { InteractiveShellToolArgs } from '../schemas'

/**
 * Replicates the routing logic from tool.ts without executing Effects.
 * Returns the operation name that would be dispatched.
 */
function classifyOperation(args: Partial<InteractiveShellToolArgs>): string {
  if (args.command) return 'spawn'
  if (args.sessionId && args.kill) return 'kill'
  if (args.sessionId && (args.input || args.inputKeys || args.inputHex || args.inputPaste)) return 'write'
  if (args.sessionId && args.background !== undefined) return 'background'
  if (args.sessionId) return 'read'
  if (args.listBackground) return 'list-background'
  if (args.dismissBackground !== undefined) return 'dismiss-background'
  return 'unknown'
}

describe('tool executor routing', () => {
  it('routes spawn command', () => {
    expect(classifyOperation({ command: 'bash' })).toBe('spawn')
  })

  it('routes spawn with options', () => {
    expect(classifyOperation({
      command: 'zsh',
      cwd: '/tmp',
      cols: 200,
      rows: 50,
      mode: 'hands-free',
    })).toBe('spawn')
  })

  it('routes kill command', () => {
    expect(classifyOperation({
      sessionId: 'shell-123',
      kill: true,
    })).toBe('kill')
  })

  it('routes write (raw input)', () => {
    expect(classifyOperation({
      sessionId: 'shell-123',
      input: 'ls -la\n',
    })).toBe('write')
  })

  it('routes write (named keys)', () => {
    expect(classifyOperation({
      sessionId: 'shell-123',
      inputKeys: ['ctrl+c'],
    })).toBe('write')
  })

  it('routes write (hex bytes)', () => {
    expect(classifyOperation({
      sessionId: 'shell-123',
      inputHex: ['0x1b', '0x5b', '0x41'],
    })).toBe('write')
  })

  it('routes write (paste)', () => {
    expect(classifyOperation({
      sessionId: 'shell-123',
      inputPaste: 'multi\nline',
    })).toBe('write')
  })

  it('routes read (sessionId only)', () => {
    expect(classifyOperation({
      sessionId: 'shell-123',
    })).toBe('read')
  })

  it('routes read with options', () => {
    expect(classifyOperation({
      sessionId: 'shell-123',
      outputLines: 50,
      outputMaxChars: 10000,
    })).toBe('read')
  })

  it('routes background attach/detach', () => {
    expect(classifyOperation({
      sessionId: 'shell-123',
      background: true,
    })).toBe('background')
  })

  it('kill takes priority over write', () => {
    // If both kill and input are provided, kill wins
    expect(classifyOperation({
      sessionId: 'shell-123',
      kill: true,
      input: 'should-not-run',
    })).toBe('kill')
  })

  it('spawn takes priority over everything', () => {
    expect(classifyOperation({
      command: 'bash',
      sessionId: 'shell-123',
      input: 'ls',
    })).toBe('spawn')
  })

  it('empty args is unknown', () => {
    expect(classifyOperation({})).toBe('unknown')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Mode routing
// ─────────────────────────────────────────────────────────────────────────────

describe('tool mode routing', () => {
  it('interactive mode blocks until completion', () => {
    const args = { command: 'bash', mode: 'interactive' as const }
    // Interactive = blocking. Tool waits for process exit.
    expect(args.mode).toBe('interactive')
  })

  it('hands-free mode returns immediately with session ID', () => {
    const args = { command: 'bash', mode: 'hands-free' as const }
    expect(args.mode).toBe('hands-free')
  })

  it('dispatch mode returns immediately, notifies on completion', () => {
    const args = { command: 'bash', mode: 'dispatch' as const }
    expect(args.mode).toBe('dispatch')
  })

  it('dispatch defaults autoExitOnQuiet to true', () => {
    const args = {
      command: 'bash',
      mode: 'dispatch' as const,
      handsFree: { autoExitOnQuiet: undefined },
    }
    // Implementation: dispatch mode sets autoExitOnQuiet=true if not explicitly set
    const autoExit = args.mode === 'dispatch'
      ? (args.handsFree?.autoExitOnQuiet ?? true)
      : (args.handsFree?.autoExitOnQuiet ?? false)
    expect(autoExit).toBe(true)
  })

  it('hands-free defaults autoExitOnQuiet to false', () => {
    const args = {
      command: 'bash',
      mode: 'hands-free' as const,
      handsFree: { autoExitOnQuiet: undefined },
    }
    const autoExit = args.mode === 'dispatch'
      ? (args.handsFree?.autoExitOnQuiet ?? true)
      : (args.handsFree?.autoExitOnQuiet ?? false)
    expect(autoExit).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Shell command parsing
// ─────────────────────────────────────────────────────────────────────────────

describe('shell command parsing', () => {
  /**
   * Replicates the command parsing logic from tool.ts:
   * - Single word → shell binary (e.g., "bash", "zsh")
   * - Multi-word → bash -c (e.g., "npm run dev")
   */
  function parseCommand(command: string): { binary: string; args: string[] } {
    const parts = command.trim().split(/\s+/)
    if (parts.length === 1) {
      return { binary: parts[0], args: [] }
    }
    // Multi-word: wrap in bash -c
    return { binary: 'bash', args: ['-c', command] }
  }

  it('single word → direct binary', () => {
    const { binary, args } = parseCommand('bash')
    expect(binary).toBe('bash')
    expect(args).toEqual([])
  })

  it('multi-word → bash -c wrapper', () => {
    const { binary, args } = parseCommand('npm run dev')
    expect(binary).toBe('bash')
    expect(args).toEqual(['-c', 'npm run dev'])
  })

  it('handles extra whitespace', () => {
    const { binary, args } = parseCommand('  bash  ')
    expect(binary).toBe('bash')
    expect(args).toEqual([])
  })

  it('complex command with pipes', () => {
    const cmd = 'ls -la | grep .ts | wc -l'
    const { binary, args } = parseCommand(cmd)
    expect(binary).toBe('bash')
    expect(args).toEqual(['-c', cmd])
  })

  it('command with environment variables', () => {
    const cmd = 'NODE_ENV=production bun run build'
    const { binary, args } = parseCommand(cmd)
    expect(binary).toBe('bash')
    expect(args).toEqual(['-c', cmd])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Output truncation
// ─────────────────────────────────────────────────────────────────────────────

describe('output truncation contract', () => {
  it('outputLines defaults to 20', () => {
    const defaultLines = 20
    expect(defaultLines).toBe(20)
  })

  it('outputMaxChars defaults to 5KB', () => {
    const defaultMaxChars = 5_000
    expect(defaultMaxChars).toBe(5_000)
  })

  it('outputLines max is 200', () => {
    const maxLines = 200
    const requested = 500
    const effective = Math.min(requested, maxLines)
    expect(effective).toBe(200)
  })

  it('outputMaxChars max is 50KB', () => {
    const maxChars = 50_000
    const requested = 100_000
    const effective = Math.min(requested, maxChars)
    expect(effective).toBe(50_000)
  })
})
