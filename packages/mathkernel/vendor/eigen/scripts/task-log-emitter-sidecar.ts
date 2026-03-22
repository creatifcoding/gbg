#!/usr/bin/env bun
/**
 * Task Log Emitter Sidecar (faker-powered)
 *
 * Publishes synthetic AgentTaskLogEntry JSONL lines to:
 *   agent.task.{taskId}.logs
 *
 * Useful for exercising InlineTaskLogView / RvnChatIsolated in real time.
 *
 * Usage examples:
 *   bun run scripts/task-log-emitter-sidecar.ts --task rm-003
 *   bun run scripts/task-log-emitter-sidecar.ts --task rm-003,rm-004 --interval 250 --jitter 80
 *   bun run scripts/task-log-emitter-sidecar.ts --task rm-003 --count 200 --seed 42
 */

import { DateTime } from 'effect'
import { faker } from '@faker-js/faker'
import { connect, StringCodec, type NatsConnection } from 'nats.ws'
import { AgentTaskLogEntry, type LogLevel } from '../src/lib/agents/tasks/schemas'
import { serializeLine } from '../src/lib/agents/tasks/codec/jsonl-codec'

interface CliOptions {
  readonly server: string
  readonly tasks: ReadonlyArray<string>
  readonly intervalMs: number
  readonly jitterMs: number
  readonly count: number
  readonly source: string
  readonly seed?: number
  readonly startSeq: number
}

const DEFAULTS = {
  server: process.env.NATS_WS_URL ?? 'ws://127.0.0.1:9222',
  tasks: ['rm-003'],
  intervalMs: 300,
  jitterMs: 120,
  count: 0,
  source: 'sidecar.faker',
  startSeq: 0,
} satisfies Omit<CliOptions, 'seed'>

const HELP = `
Task Log Emitter Sidecar

Options:
  --task <id[,id...]>   Task id(s) to emit for (repeatable). Default: rm-003
  --server <ws-url>     NATS WebSocket URL. Default: ws://127.0.0.1:9222
  --interval <ms>       Base interval between emits. Default: 300
  --jitter <ms>         Random jitter added to interval. Default: 120
  --count <n>           Total emits. 0 = infinite. Default: 0
  --source <name>       Log source field. Default: sidecar.faker
  --seed <n>            Faker deterministic seed
  --start-seq <n>       Starting sequence offset. Default: 0
  -h, --help            Show this help

Examples:
  bun run scripts/task-log-emitter-sidecar.ts --task rm-003
  bun run scripts/task-log-emitter-sidecar.ts --task rm-003,rm-004 --interval 250 --jitter 80
  bun run scripts/task-log-emitter-sidecar.ts --task rm-003 --count 200 --seed 42
`

const parsePositiveInt = (raw: string, label: string): number => {
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer, got '${raw}'`)
  }
  return value
}

const parseArgs = (argv: ReadonlyArray<string>): CliOptions => {
  const tasks: string[] = []

  let server = DEFAULTS.server
  let intervalMs = DEFAULTS.intervalMs
  let jitterMs = DEFAULTS.jitterMs
  let count = DEFAULTS.count
  let source = DEFAULTS.source
  let seed: number | undefined
  let startSeq = DEFAULTS.startSeq

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    switch (arg) {
      case '-h':
      case '--help':
        console.log(HELP)
        process.exit(0)

      case '--task': {
        const value = argv[i + 1]
        if (!value) throw new Error('--task requires a value')
        i += 1

        const ids = value
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part.length > 0)

        tasks.push(...ids)
        break
      }

      case '--server': {
        const value = argv[i + 1]
        if (!value) throw new Error('--server requires a value')
        i += 1
        server = value
        break
      }

      case '--interval': {
        const value = argv[i + 1]
        if (!value) throw new Error('--interval requires a value')
        i += 1
        intervalMs = parsePositiveInt(value, '--interval')
        break
      }

      case '--jitter': {
        const value = argv[i + 1]
        if (!value) throw new Error('--jitter requires a value')
        i += 1
        jitterMs = parsePositiveInt(value, '--jitter')
        break
      }

      case '--count': {
        const value = argv[i + 1]
        if (!value) throw new Error('--count requires a value')
        i += 1
        count = parsePositiveInt(value, '--count')
        break
      }

      case '--source': {
        const value = argv[i + 1]
        if (!value) throw new Error('--source requires a value')
        i += 1
        source = value
        break
      }

      case '--seed': {
        const value = argv[i + 1]
        if (!value) throw new Error('--seed requires a value')
        i += 1
        seed = parsePositiveInt(value, '--seed')
        break
      }

      case '--start-seq': {
        const value = argv[i + 1]
        if (!value) throw new Error('--start-seq requires a value')
        i += 1
        startSeq = parsePositiveInt(value, '--start-seq')
        break
      }

      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return {
    server,
    tasks: tasks.length > 0 ? tasks : DEFAULTS.tasks,
    intervalMs,
    jitterMs,
    count,
    source,
    seed,
    startSeq,
  }
}

const LEVELS: ReadonlyArray<LogLevel> = ['DEBUG', 'INFO', 'INFO', 'INFO', 'WARN', 'ERROR']

const randomLevel = (): LogLevel =>
  LEVELS[Math.floor(Math.random() * LEVELS.length)] ?? 'INFO'

const resolveSubject = (taskId: string): string => `agent.task.${taskId}.logs`

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const buildEntry = (taskId: string, source: string, seq: number): AgentTaskLogEntry => {
  const level = randomLevel()
  const operation = faker.helpers.arrayElement([
    'hydrate-window',
    'archive-spill',
    'durability-ack',
    'controller-scroll',
    'filter-apply',
    'outbox-drain',
  ])

  return new AgentTaskLogEntry({
    id: `sidecar-${taskId}-${Date.now()}-${seq}`,
    timestamp: DateTime.unsafeNow(),
    level,
    source,
    message: `${operation} :: ${faker.hacker.phrase()} [seq=${seq}]`,
    parentTaskId: taskId,
    traceId: faker.string.alphanumeric(16),
    spanId: faker.string.alphanumeric(16),
    metadata: {
      seq,
      operation,
      lane: faker.helpers.arrayElement(['hot', 'durability', 'archive', 'hydration']),
      latencyMs: faker.number.int({ min: 4, max: 850 }),
      worker: faker.helpers.arrayElement(['alpha', 'beta', 'gamma', 'delta']),
      node: faker.location.city(),
    },
    payload: {
      sample: faker.number.float({ min: 0, max: 1, precision: 0.001 }),
      note: faker.company.catchPhrase(),
      status: faker.helpers.arrayElement(['ok', 'warn', 'retry', 'degraded']),
    },
  })
}

const main = async () => {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.seed !== undefined) {
    faker.seed(opts.seed)
  }

  const sc = StringCodec()
  let nc: NatsConnection | null = null
  let stopRequested = false

  const stop = async (signal: string) => {
    if (stopRequested) return
    stopRequested = true
    console.log(`\n[emitter] stopping on ${signal}...`)

    if (nc) {
      try {
        await nc.drain()
      } catch {
        await nc.close()
      }
    }
  }

  process.on('SIGINT', () => {
    void stop('SIGINT')
  })
  process.on('SIGTERM', () => {
    void stop('SIGTERM')
  })

  try {
    nc = await connect({ servers: opts.server })

    console.log('[emitter] connected')
    console.log(`  server:   ${opts.server}`)
    console.log(`  tasks:    ${opts.tasks.join(', ')}`)
    console.log(`  interval: ${opts.intervalMs}ms (+${opts.jitterMs}ms jitter)`)
    console.log(`  count:    ${opts.count === 0 ? '∞' : opts.count}`)
    console.log(`  source:   ${opts.source}`)
    if (opts.seed !== undefined) {
      console.log(`  seed:     ${opts.seed}`)
    }

    let emitted = 0

    while (!stopRequested && (opts.count === 0 || emitted < opts.count)) {
      const taskId = opts.tasks[emitted % opts.tasks.length] ?? opts.tasks[0] ?? 'rm-003'
      const seq = opts.startSeq + emitted + 1
      const subject = resolveSubject(taskId)

      const entry = buildEntry(taskId, opts.source, seq)
      const line = serializeLine(entry)

      nc.publish(subject, sc.encode(line))
      emitted += 1

      if (emitted % 25 === 0) {
        await nc.flush()
      }

      console.log(
        `[emit] ${subject} :: ${entry.level} :: ${entry.id} :: ${entry.message}`,
      )

      const jitter = opts.jitterMs > 0 ? faker.number.int({ min: 0, max: opts.jitterMs }) : 0
      await sleep(opts.intervalMs + jitter)
    }

    await nc.flush()
    console.log(`[emitter] done. emitted=${emitted}`)
    await stop('completed')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[emitter] failed: ${message}`)
    await stop('error')
    process.exitCode = 1
  }
}

void main()
