/**
 * MockTransportService — Timed Effect.Stream emission for dev/test.
 *
 * Produces realistic log lines on a configurable schedule without any
 * network dependency. Uses Effect.Schedule for interval timing and
 * Effect.Random for jitter.
 *
 * Mock scenarios:
 * - Boot sequence (INFO lines at fast cadence)
 * - Processing (mixed INFO/WARN at moderate cadence)
 * - Error burst (ERROR/FATAL cluster)
 * - Completion (final INFO + optional DEBUG summary)
 *
 * @module agent-task/services/MockTransportService
 */

import {
  Effect,
  Layer,
  Stream,
  Duration,
  DateTime,
  Random,
  Option,
  pipe,
} from 'effect'
import { faker } from '@faker-js/faker'
import { TransportService, TransportSubscribeError } from './TransportService'
import { AgentTaskLogEntry } from '../schemas/log-entry'
import { serializeLine } from '../codec/jsonl-codec'
import type { LogLevel } from '../schemas/log-level'

// ---------------------------------------------------------------------------
// Mock log scenarios
// ---------------------------------------------------------------------------

interface MockLogTemplate {
  readonly level: LogLevel
  readonly source: string
  readonly message: string
  readonly metadata?: Record<string, unknown>
}

const BOOT_SEQUENCE: ReadonlyArray<MockLogTemplate> = [
  { level: 'INFO', source: 'runtime', message: 'Initializing agent task runtime' },
  { level: 'INFO', source: 'runtime', message: 'Loading service dependencies' },
  { level: 'DEBUG', source: 'config', message: 'Configuration resolved from environment' },
  { level: 'INFO', source: 'transport', message: 'NATS connection established', metadata: { server: 'nats://localhost:4222' } },
  { level: 'INFO', source: 'runtime', message: 'Agent task runtime ready' },
]

const PROCESSING_SEQUENCE: ReadonlyArray<MockLogTemplate> = [
  { level: 'INFO', source: 'worker', message: 'Processing batch 1/4' },
  { level: 'INFO', source: 'worker', message: 'Validating schema constraints' },
  { level: 'WARN', source: 'worker', message: 'Latency spike detected (120ms)', metadata: { latency: 120 } },
  { level: 'INFO', source: 'worker', message: 'Processing batch 2/4' },
  { level: 'INFO', source: 'worker', message: 'Checksum verification passed' },
  { level: 'INFO', source: 'worker', message: 'Processing batch 3/4' },
  { level: 'WARN', source: 'metrics', message: 'Memory pressure approaching threshold', metadata: { heapUsed: 0.82 } },
  { level: 'INFO', source: 'worker', message: 'Processing batch 4/4' },
  { level: 'INFO', source: 'worker', message: 'All batches processed successfully' },
]

const ERROR_BURST: ReadonlyArray<MockLogTemplate> = [
  { level: 'ERROR', source: 'network', message: 'Connection refused on port 443', metadata: { host: 'api.cluster-east.internal', port: 443 } },
  { level: 'ERROR', source: 'network', message: 'Retry attempt 1/3 failed' },
  { level: 'WARN', source: 'circuit-breaker', message: 'Circuit breaker tripped — backing off' },
  { level: 'ERROR', source: 'network', message: 'Retry attempt 2/3 failed' },
  { level: 'FATAL', source: 'network', message: 'Max retries exhausted — task failed', metadata: { totalAttempts: 3, lastError: 'ECONNREFUSED' } },
]

const COMPLETION_SEQUENCE: ReadonlyArray<MockLogTemplate> = [
  { level: 'INFO', source: 'worker', message: 'Task execution completed' },
  { level: 'DEBUG', source: 'metrics', message: 'Execution summary: 4 batches, 0 errors, 142ms total', metadata: { batches: 4, errors: 0, durationMs: 142 } },
  { level: 'INFO', source: 'runtime', message: 'Releasing task resources' },
]

/** All scenarios in order. Consumers get the full sequence. */
const ALL_TEMPLATES: ReadonlyArray<MockLogTemplate> = [
  ...BOOT_SEQUENCE,
  ...PROCESSING_SEQUENCE,
  ...COMPLETION_SEQUENCE,
]

/** Error scenario for failed tasks. */
const ERROR_TEMPLATES: ReadonlyArray<MockLogTemplate> = [
  ...BOOT_SEQUENCE,
  ...ERROR_BURST,
]

// ---------------------------------------------------------------------------
// Template → JSONL line
// ---------------------------------------------------------------------------

let _counter = 0
const templateToLine = (
  template: MockLogTemplate,
  taskId: string,
  sequence: number,
): string => {
  _counter++

  const syntheticLatency = faker.number.int({ min: 12, max: 350 })
  const syntheticWorker = faker.helpers.arrayElement([
    'worker.alpha',
    'worker.beta',
    'worker.gamma',
    'worker.delta',
  ])

  const message = `${template.message} · #${sequence.toString().padStart(5, '0')}`

  const entry = new AgentTaskLogEntry({
    id: `mock-${taskId}-${_counter.toString().padStart(6, '0')}`,
    timestamp: DateTime.unsafeNow(),
    level: template.level,
    source: template.source,
    message,
    parentTaskId: taskId,
    metadata: {
      ...(template.metadata ?? {}),
      sequence,
      syntheticLatency,
      worker: syntheticWorker,
      traceId: faker.string.alphanumeric(16),
    },
  })
  return serializeLine(entry)
}

// ---------------------------------------------------------------------------
// Mock config
// ---------------------------------------------------------------------------

export interface MockTransportConfig {
  /** Base interval between emissions (default: 200ms) */
  readonly intervalMs?: number
  /** Max random jitter added to interval (default: 100ms) */
  readonly jitterMs?: number
  /** Use error scenario instead of success (default: false) */
  readonly errorScenario?: boolean
  /** Keep stream open indefinitely (default: true) */
  readonly infinite?: boolean
  /** Optional deterministic seed for faker/randomized fields */
  readonly seed?: number
  /** Optional hard cap for entries (primarily tests) */
  readonly maxEntries?: number
}

const DEFAULT_CONFIG: Required<Omit<MockTransportConfig, 'seed' | 'maxEntries'>> = {
  intervalMs: 200,
  jitterMs: 100,
  errorScenario: false,
  infinite: true,
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const makeMockTransport = (
  userConfig?: MockTransportConfig,
): TransportService['Type'] => {
  const config = { ...DEFAULT_CONFIG, ...userConfig }

  return {
    subscribe: (taskId) =>
      Effect.gen(function* () {
        const templates = config.errorScenario ? ERROR_TEMPLATES : ALL_TEMPLATES

        if (config.seed !== undefined) {
          yield* Effect.sync(() => faker.seed(config.seed))
        }

        const lineStream = Stream.unfoldEffect(0, (emitted) =>
          Effect.gen(function* () {
            const exhaustedFiniteScenario = !config.infinite && emitted >= templates.length
            const exhaustedMaxEntries =
              config.maxEntries !== undefined && emitted >= config.maxEntries

            if (exhaustedFiniteScenario || exhaustedMaxEntries) {
              return Option.none()
            }

            const jitter =
              config.jitterMs > 0
                ? yield* Random.nextIntBetween(0, config.jitterMs)
                : 0

            yield* Effect.sleep(Duration.millis(config.intervalMs + jitter))

            const template = templates[emitted % templates.length]
            const sequence = emitted + 1
            const line = templateToLine(template, taskId, sequence)

            return Option.some([line, emitted + 1] as const)
          }),
        )

        return lineStream as Stream.Stream<string, TransportSubscribeError>
      }),

    publish: (_taskId, _line) =>
      // Mock publish is a no-op — logs go nowhere
      Effect.void,
  }
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

/** Default mock transport: 200ms interval, success scenario */
export const MockTransportServiceLive = Layer.succeed(
  TransportService,
  makeMockTransport(),
)

/** Fast mock for tests: 10ms interval, no jitter */
export const MockTransportServiceFast = Layer.succeed(
  TransportService,
  makeMockTransport({ intervalMs: 10, jitterMs: 0 }),
)

/** Error scenario mock: emits boot → error burst */
export const MockTransportServiceError = Layer.succeed(
  TransportService,
  makeMockTransport({ errorScenario: true }),
)

/** Custom configuration */
export const MockTransportServiceCustom = (config: MockTransportConfig) =>
  Layer.succeed(TransportService, makeMockTransport(config))
