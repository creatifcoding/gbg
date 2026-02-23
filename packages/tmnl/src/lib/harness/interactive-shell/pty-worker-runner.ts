/**
 * PTY Worker Runner — Runs in a dedicated Bun Worker thread.
 *
 * Handles PTY spawn/write/resize/kill/dump/read requests via Schema.TaggedRequest.
 * Uses Bun.spawn with terminal option for PTY operations — zero native addons.
 * Uses @xterm/headless for server-side terminal state tracking (agent vision).
 *
 * Architecture:
 *   - Bun.spawn terminal: raw PTY bytes → client (ghostty-web rendering)
 *   - xterm-headless: parallel write → cell-level buffer state (agent reads)
 *   - DSR interception: cursor position queries answered from xterm buffer
 *   - WriteQueue: ordered writes ensure xterm stays in sync with PTY
 *
 * @module harness/interactive-shell/pty-worker-runner
 */

import { Effect, Layer, Stream } from 'effect'
import * as WorkerRunner from '@effect/platform/WorkerRunner'
import * as BunRunnerLayer from '@effect/platform-bun/BunWorkerRunner'
import { Terminal as XtermTerminal } from '@xterm/headless'
import { SerializeAddon } from '@xterm/addon-serialize'
import { stripVTControlCharacters } from 'node:util'
import {
  PtyWorkerMessage,
  PtyOutputChunk,
  PtyScreenDumpResult,
  PtyRawOutputResult,
  PtyWorkerError,
} from './pty-worker-schema'

// ─────────────────────────────────────────────────────────────────────────────
// DSR interception (Device Status Report — ESC[6n / ESC[?6n)
// ─────────────────────────────────────────────────────────────────────────────

const DSR_PATTERN = /\x1b\[\??6n/g

interface DsrSplit {
  segments: Array<{ text: string; dsrAfter: boolean }>
  hasDsr: boolean
}

function splitAroundDsr(input: string): DsrSplit {
  const segments: Array<{ text: string; dsrAfter: boolean }> = []
  let lastIndex = 0
  let hasDsr = false

  const regex = new RegExp(DSR_PATTERN.source, 'g')
  let match: RegExpExecArray | null
  while ((match = regex.exec(input)) !== null) {
    hasDsr = true
    if (match.index > lastIndex) {
      segments.push({ text: input.slice(lastIndex, match.index), dsrAfter: true })
    } else {
      segments.push({ text: '', dsrAfter: true })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex), dsrAfter: false })
  }

  return { segments, hasDsr }
}

function buildCursorPositionResponse(row: number, col: number): string {
  return `\x1b[${row};${col}R`
}

// ─────────────────────────────────────────────────────────────────────────────
// Ordered write queue (ensures xterm stays in sync with PTY data)
// ─────────────────────────────────────────────────────────────────────────────

class WriteQueue {
  private queue = Promise.resolve()

  enqueue(fn: () => Promise<void> | void): void {
    this.queue = this.queue.then(() => fn()).catch((err) => {
      console.error('[pty-worker] WriteQueue error:', err)
    })
  }

  async drain(): Promise<void> {
    await this.queue
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session registry (worker-local)
// ─────────────────────────────────────────────────────────────────────────────

interface BunTerminalHandle {
  write(data: string): void
  resize(cols: number, rows: number): void
  close(): void
  readonly closed: boolean
}

interface WorkerSession {
  proc: ReturnType<typeof Bun.spawn>
  termHandle: BunTerminalHandle | null
  xterm: InstanceType<typeof XtermTerminal>
  serializer: SerializeAddon
  writeQueue: WriteQueue
  shell: string
  /** Raw output buffer for incremental reads */
  rawOutput: string
  /** Position for incremental/drain reads */
  lastReadPosition: number
  /** Max raw buffer size before trimming (1MB) */
  maxBufferSize: number
}

const sessions = new Map<string, WorkerSession>()
const MAX_RAW_OUTPUT_SIZE = 1024 * 1024

// ─────────────────────────────────────────────────────────────────────────────
// Decode helpers
// ─────────────────────────────────────────────────────────────────────────────

const textDecoder = new TextDecoder('utf-8')

const decodeTerminalData = (data: unknown): string =>
  data instanceof Uint8Array
    ? textDecoder.decode(data)
    : typeof data === 'string'
      ? data
      : String(data)

function trimRawBuffer(session: WorkerSession): void {
  if (session.rawOutput.length > session.maxBufferSize) {
    const keepSize = Math.floor(session.maxBufferSize / 2)
    const trimAmount = session.rawOutput.length - keepSize
    session.rawOutput = session.rawOutput.substring(trimAmount)
    session.lastReadPosition = Math.max(0, session.lastReadPosition - trimAmount)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen reading helpers
// ─────────────────────────────────────────────────────────────────────────────

function getViewportLines(session: WorkerSession, ansi: boolean): string[] {
  const buffer = session.xterm.buffer.active
  const totalLines = buffer.length
  const viewportStart = Math.max(0, totalLines - session.xterm.rows)
  const lines: string[] = []

  for (let i = 0; i < session.xterm.rows; i++) {
    const lineIndex = viewportStart + i
    if (lineIndex < totalLines) {
      const line = buffer.getLine(lineIndex)
      lines.push(line?.translateToString(!ansi) ?? '')
    } else {
      lines.push('')
    }
  }
  return lines
}

function getTailLines(
  session: WorkerSession,
  count: number,
  ansi: boolean,
  maxChars?: number,
): { lines: string[]; totalLines: number; truncated: boolean } {
  const buffer = session.xterm.buffer.active
  const totalLines = buffer.length
  const requested = Math.max(0, Math.trunc(count))

  if (requested === 0) {
    return { lines: [], totalLines, truncated: false }
  }

  const start = Math.max(0, totalLines - requested)
  const out: string[] = []
  let remainingChars = maxChars
  let truncated = false

  for (let i = start; i < totalLines; i++) {
    const lineObj = buffer.getLine(i)
    const line = lineObj?.translateToString(!ansi) ?? ''
    if (remainingChars !== undefined) {
      if (remainingChars <= 0) {
        truncated = true
        break
      }
      remainingChars -= line.length
    }
    out.push(line)
  }

  return { lines: out, totalLines, truncated }
}

function getSliceLines(
  session: WorkerSession,
  offset: number,
  limit: number,
  ansi: boolean,
  maxChars?: number,
): { lines: string[]; totalLines: number; truncated: boolean } {
  const buffer = session.xterm.buffer.active
  const totalLines = buffer.length
  const start = Math.max(0, Math.trunc(offset))
  const end = Math.min(totalLines, start + Math.max(0, Math.trunc(limit)))
  const out: string[] = []
  let remainingChars = maxChars
  let truncated = false

  for (let i = start; i < end; i++) {
    const lineObj = buffer.getLine(i)
    const line = lineObj?.translateToString(!ansi) ?? ''
    if (remainingChars !== undefined) {
      if (remainingChars <= 0) {
        truncated = true
        break
      }
      remainingChars -= line.length
    }
    out.push(line)
  }

  return { lines: out, totalLines, truncated }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler implementations
// ─────────────────────────────────────────────────────────────────────────────

const WorkerLive = WorkerRunner.layerSerialized(PtyWorkerMessage, {
  /**
   * PtySpawn → Stream<PtyOutputChunk>
   *
   * Spawns a PTY via Bun.spawn + creates xterm-headless mirror.
   * Raw bytes stream to client. xterm tracks cell state for agent reads.
   */
  PtySpawn: (req) =>
    Stream.asyncPush<PtyOutputChunk, PtyWorkerError>((emit) =>
      Effect.gen(function* () {
        const env: Record<string, string> = {
          ...(process.env as Record<string, string>),
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        }
        if (req.env) {
          Object.assign(env, req.env)
        }

        // Create xterm-headless instance for state tracking
        const xterm = new XtermTerminal({
          cols: req.cols,
          rows: req.rows,
          scrollback: 5000,
          allowProposedApi: true,
          convertEol: true,
        })
        const serializer = new SerializeAddon()
        xterm.loadAddon(serializer)

        const writeQueue = new WriteQueue()

        try {
          let termHandle: BunTerminalHandle | null = null

          const proc = Bun.spawn([req.shell, ...req.args], {
            cwd: req.cwd,
            env,
            terminal: {
              cols: req.cols,
              rows: req.rows,
              data(term: unknown, rawData: unknown) {
                // Capture terminal handle on first data callback
                if (!termHandle) {
                  termHandle = term as BunTerminalHandle
                  // Update session reference so PtyWrite/Resize can reach it
                  const s = sessions.get(req.sessionId)
                  if (s) s.termHandle = termHandle
                }

                const str = decodeTerminalData(rawData)

                // Emit raw data to client immediately (hot path)
                emit.single(
                  new PtyOutputChunk({ sessionId: req.sessionId, data: str }),
                )

                // Queue ordered write to xterm-headless (with DSR handling)
                const session = sessions.get(req.sessionId)
                if (!session) return

                const { segments, hasDsr } = splitAroundDsr(str)

                if (!hasDsr) {
                  // Fast path: no DSR
                  writeQueue.enqueue(async () => {
                    session.rawOutput += str
                    trimRawBuffer(session)
                    await new Promise<void>((resolve) => {
                      xterm.write(str, () => resolve())
                    })
                  })
                } else {
                  // DSR handling: write segments, respond with cursor position
                  for (const segment of segments) {
                    writeQueue.enqueue(async () => {
                      if (segment.text) {
                        session.rawOutput += segment.text
                        trimRawBuffer(session)
                        await new Promise<void>((resolve) => {
                          xterm.write(segment.text, () => resolve())
                        })
                      }
                      if (segment.dsrAfter && termHandle) {
                        const buffer = xterm.buffer.active
                        const response = buildCursorPositionResponse(
                          buffer.cursorY + 1,
                          buffer.cursorX + 1,
                        )
                        termHandle.write(response)
                      }
                    })
                  }
                }
              },
            },
          })

          const session: WorkerSession = {
            proc,
            termHandle,
            xterm,
            serializer,
            writeQueue,
            shell: req.shell,
            rawOutput: '',
            lastReadPosition: 0,
            maxBufferSize: MAX_RAW_OUTPUT_SIZE,
          }
          sessions.set(req.sessionId, session)

          // Watch for exit
          void proc.exited.then((exitCode: number) => {
            const exitMsg = `\n[Process exited with code ${exitCode}]\n`
            writeQueue.enqueue(async () => {
              session.rawOutput += exitMsg
              await new Promise<void>((resolve) => {
                xterm.write(exitMsg, () => resolve())
              })
            })
            void writeQueue.drain().then(() => {
              sessions.delete(req.sessionId)
              emit.end()
            })
          })
        } catch (e) {
          xterm.dispose()
          emit.fail(
            new PtyWorkerError({
              message: `PTY spawn failed: ${e instanceof Error ? e.message : String(e)}`,
              sessionId: req.sessionId,
            }),
          )
        }

        // Cleanup on stream scope close
        return Effect.sync(() => {
          const session = sessions.get(req.sessionId)
          if (session) {
            try {
              session.proc.kill()
              if (session.termHandle && !session.termHandle.closed) {
                session.termHandle.close()
              }
            } catch {
              // already dead
            }
            session.xterm.dispose()
            sessions.delete(req.sessionId)
          }
        })
      }),
    ),

  /**
   * PtyWrite → Effect<void>
   * Broadcast-safe: silently no-ops if session not on this worker.
   */
  PtyWrite: (req) =>
    Effect.gen(function* () {
      const session = sessions.get(req.sessionId)
      if (!session) return
      try {
        if (session.termHandle) {
          session.termHandle.write(req.data)
        }
      } catch (e) {
        return yield* new PtyWorkerError({
          message: `Write failed: ${e instanceof Error ? e.message : String(e)}`,
          sessionId: req.sessionId,
        })
      }
    }),

  /**
   * PtyResize → Effect<void>
   * Broadcast-safe. Resizes both PTY and xterm-headless.
   */
  PtyResize: (req) =>
    Effect.gen(function* () {
      const session = sessions.get(req.sessionId)
      if (!session) return
      try {
        if (session.termHandle) {
          session.termHandle.resize(req.cols, req.rows)
        }
        session.xterm.resize(req.cols, req.rows)
      } catch (e) {
        return yield* new PtyWorkerError({
          message: `Resize failed: ${e instanceof Error ? e.message : String(e)}`,
          sessionId: req.sessionId,
        })
      }
    }),

  /**
   * PtyKill → Effect<void>
   * Broadcast-safe. Cleans up both PTY and xterm-headless.
   */
  PtyKill: (req) =>
    Effect.gen(function* () {
      const session = sessions.get(req.sessionId)
      if (!session) return
      try {
        session.proc.kill(req.signal ?? 15)
        if (session.termHandle && !session.termHandle.closed) {
          session.termHandle.close()
        }
      } catch {
        // already dead
      }
      session.xterm.dispose()
      sessions.delete(req.sessionId)
    }),

  /**
   * PtyDumpScreen → Effect<PtyScreenDumpResult>
   * Reads rendered terminal state from xterm-headless buffer.
   */
  PtyDumpScreen: (req) =>
    Effect.gen(function* () {
      const session = sessions.get(req.sessionId)
      if (!session) {
        return yield* new PtyWorkerError({
          message: `Session not found: ${req.sessionId}`,
          sessionId: req.sessionId,
        })
      }

      // Drain write queue to ensure xterm buffer is up-to-date
      yield* Effect.promise(() => session.writeQueue.drain())

      const ansi = req.ansi ?? false
      const buffer = session.xterm.buffer.active

      let result: { lines: string[]; totalLines: number; truncated: boolean }

      switch (req.mode) {
        case 'viewport':
          result = {
            lines: getViewportLines(session, ansi),
            totalLines: buffer.length,
            truncated: false,
          }
          break

        case 'tail':
          result = getTailLines(
            session,
            req.lines ?? session.xterm.rows,
            ansi,
            req.maxChars,
          )
          break

        case 'slice':
          result = getSliceLines(
            session,
            req.offset ?? 0,
            req.lines ?? session.xterm.rows,
            ansi,
            req.maxChars,
          )
          break

        default:
          result = {
            lines: getViewportLines(session, ansi),
            totalLines: buffer.length,
            truncated: false,
          }
      }

      return new PtyScreenDumpResult({
        lines: result.lines,
        totalLines: result.totalLines,
        truncated: result.truncated,
        cursorRow: buffer.cursorY,
        cursorCol: buffer.cursorX,
      })
    }),

  /**
   * PtyReadOutput → Effect<PtyRawOutputResult>
   * Reads raw output buffer with pagination / incremental support.
   */
  PtyReadOutput: (req) =>
    Effect.gen(function* () {
      const session = sessions.get(req.sessionId)
      if (!session) {
        return yield* new PtyWorkerError({
          message: `Session not found: ${req.sessionId}`,
          sessionId: req.sessionId,
        })
      }

      // Drain write queue
      yield* Effect.promise(() => session.writeQueue.drain())

      let text = session.rawOutput
      const shouldStripAnsi = req.stripAnsi !== false

      // Incremental / drain mode
      if (req.drain) {
        text = session.rawOutput.substring(session.lastReadPosition)
        session.lastReadPosition = session.rawOutput.length
      }

      if (shouldStripAnsi && text) {
        text = stripVTControlCharacters(text)
      }

      if (!text) {
        return new PtyRawOutputResult({
          text: '',
          totalLines: 0,
          totalChars: 0,
          sliceLineCount: 0,
        })
      }

      // Normalize and split
      const normalized = text.replace(/\r\n/g, '\n')
      const lines = normalized.split('\n')
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop()
      }

      const totalLines = lines.length
      const totalChars = text.length

      // Apply offset/limit
      let start: number
      if (typeof req.offset === 'number' && Number.isFinite(req.offset)) {
        start = Math.max(0, Math.floor(req.offset))
      } else if (req.limit !== undefined) {
        // No offset but limit → return tail
        const tailCount = Math.max(0, Math.floor(req.limit))
        start = Math.max(totalLines - tailCount, 0)
      } else {
        start = 0
      }

      const end =
        typeof req.limit === 'number' && Number.isFinite(req.limit)
          ? start + Math.max(0, Math.floor(req.limit))
          : undefined

      const selectedLines = lines.slice(start, end)

      return new PtyRawOutputResult({
        text: selectedLines.join('\n'),
        totalLines,
        totalChars,
        sliceLineCount: selectedLines.length,
      })
    }),
}).pipe(Layer.provide(BunRunnerLayer.layer))

// ─────────────────────────────────────────────────────────────────────────────
// Launch
// ─────────────────────────────────────────────────────────────────────────────

Effect.runFork(WorkerRunner.launch(WorkerLive))
