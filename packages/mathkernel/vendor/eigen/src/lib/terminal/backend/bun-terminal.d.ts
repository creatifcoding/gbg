/**
 * Minimal Bun.Terminal type declarations for PtyBackend.
 *
 * Bun 1.3.5+ provides native PTY support via Bun.spawn({ terminal: ... }).
 * These declarations cover only the API surface we use.
 *
 * @see https://bun.com/blog/bun-v1.3.5#bun-terminal-api-for-pseudo-terminal-pty-support
 */

declare namespace Bun {
  interface Terminal {
    /** Write data to the PTY stdin */
    write(data: string | Uint8Array): void
    /** Resize the PTY */
    resize(cols: number, rows: number): void
    /** Close the terminal (releases PTY resources) */
    close(): void
  }

  interface TerminalOptions {
    /** Number of columns */
    cols?: number
    /** Number of rows */
    rows?: number
    /** Data callback — called when PTY produces output */
    data?(terminal: Terminal, data: string): void
  }

  interface SpawnOptions {
    cwd?: string
    env?: Record<string, string | undefined>
    /** Attach a pseudo-terminal to the subprocess */
    terminal?: TerminalOptions
    stdin?: 'pipe' | 'inherit' | 'ignore' | null
    stdout?: 'pipe' | 'inherit' | 'ignore' | null
    stderr?: 'pipe' | 'inherit' | 'ignore' | null
  }

  interface Subprocess {
    readonly pid: number
    readonly exited: Promise<number>
    readonly exitCode: number | null
    /** Terminal handle (only present if spawned with terminal option) */
    readonly terminal?: Terminal
    kill(signal?: number): void
  }

  function spawn(cmd: string[], options?: SpawnOptions): Subprocess
}
