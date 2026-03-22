/**
 * Knowledge Tools Tests
 *
 * Unit tests for createKnowledgeTools factory.
 * Tests knowledge service integration and tool execution.
 */

import { describe, it, expect } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import {
  createKnowledgeTools,
  searchKnowledge,
  getAllSchemas,
  getAllServices,
  getAllPatterns,
  loadFullContext,
  reloadKnowledge,
} from '../knowledge-tools'
import { KnowledgeService, makeKnowledgeServiceLive } from '../../services/KnowledgeService'
import type { SchemaInfo, ServiceInfo, PatternInfo } from '../../schemas/knowledge'

// -----------------------------------------------------------------------------
// Test Fixtures
// -----------------------------------------------------------------------------

const testSchemas: readonly SchemaInfo[] = [
  {
    name: 'EditorId',
    file: 'src/lib/editor-ai/schemas/editor.ts',
    typeSignature: 'string & Brand<"EditorId">',
    category: 'editor',
    description: 'Branded ID for editor instances',
  },
  {
    name: 'Selection',
    file: 'src/lib/editor-ai/schemas/editor.ts',
    typeSignature: '{ from: number; to: number; empty: boolean }',
    category: 'editor',
    description: 'Text selection range',
  },
]

const testServices: readonly ServiceInfo[] = [
  {
    name: 'EditorOperations',
    file: 'src/lib/editor-ai/services/EditorOperations.ts',
    tag: 'tmnl/EditorOperations',
    description: 'Base editor interface',
    capabilities: ['insert', 'replace', 'select'],
    methods: [
      { name: 'insertAtCursor', signature: '(content: string) => Effect<number>' },
      { name: 'getSelection', signature: 'Effect<Selection | null>' },
    ],
  },
]

const testPatterns: readonly PatternInfo[] = [
  {
    name: 'Atom-as-State',
    category: 'effect',
    description: 'Use Atom.make() for cross-component state',
    example: 'const atom = Atom.make(initialValue)',
    source: '.edin/EFFECT_PATTERNS.md',
  },
  {
    name: 'Service Pattern',
    category: 'effect',
    description: 'Effect.Service<>() for dependency injection',
    example: 'class MyService extends Effect.Service...',
    source: '.edin/EFFECT_PATTERNS.md',
  },
]

// -----------------------------------------------------------------------------
// Mock KnowledgeService Layer
// -----------------------------------------------------------------------------

const mockKnowledgeService = {
  loadContext: Effect.succeed({
    schemas: testSchemas,
    services: testServices,
    patterns: testPatterns,
  }),
  getSchemas: () => Effect.succeed(testSchemas),
  getServices: () => Effect.succeed(testServices),
  getPatterns: () => Effect.succeed(testPatterns),
  searchSimilar: (query: string, limit: number) =>
    Effect.succeed(
      [
        { kind: 'schema' as const, name: 'EditorId', description: 'Editor ID', relevance: 0.9 },
        { kind: 'service' as const, name: 'EditorOperations', description: 'Base editor', relevance: 0.8 },
        { kind: 'pattern' as const, name: 'Atom-as-State', description: 'State pattern', relevance: 0.7 },
      ].slice(0, limit)
    ),
  reload: Effect.void,
}

const TestKnowledgeLayer = Layer.succeed(KnowledgeService, mockKnowledgeService)

// Helper to run effects with test layer
const runEffect = <A>(effect: Effect.Effect<A, unknown, KnowledgeService>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(TestKnowledgeLayer)))

// -----------------------------------------------------------------------------
// Tool Factory Tests
// -----------------------------------------------------------------------------

describe('createKnowledgeTools', () => {
  const tools = createKnowledgeTools(runEffect)

  describe('Tool Structure', () => {
    it('creates expected tools', () => {
      expect(tools.get_codebase_context).toBeDefined()
      expect(tools.get_pattern_for_task).toBeDefined()
      expect(tools.refresh_codebase_knowledge).toBeDefined()
    })

    it('each tool has required properties', () => {
      const toolNames = Object.keys(tools) as Array<keyof typeof tools>

      for (const name of toolNames) {
        const tool = tools[name]
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('parameters')
        expect(tool).toHaveProperty('execute')
      }
    })
  })

  describe('get_codebase_context', () => {
    it('returns summary by default', async () => {
      const result = await tools.get_codebase_context.execute(
        {},
        { toolCallId: 'test' }
      )

      expect(result.type).toBe('summary')
      expect(result.schemaCount).toBe(2)
      expect(result.serviceCount).toBe(1)
      expect(result.patternCount).toBe(2)
    })

    it('returns schemas when category=schemas', async () => {
      const result = await tools.get_codebase_context.execute(
        { category: 'schemas' },
        { toolCallId: 'test' }
      )

      expect(result.type).toBe('schemas')
      expect(result.schemas).toHaveLength(2)
    })

    it('returns services when category=services', async () => {
      const result = await tools.get_codebase_context.execute(
        { category: 'services' },
        { toolCallId: 'test' }
      )

      expect(result.type).toBe('services')
      expect(result.services).toHaveLength(1)
    })

    it('returns patterns when category=patterns', async () => {
      const result = await tools.get_codebase_context.execute(
        { category: 'patterns' },
        { toolCallId: 'test' }
      )

      expect(result.type).toBe('patterns')
      expect(result.patterns).toHaveLength(2)
    })

    it('returns search results when query provided', async () => {
      const result = await tools.get_codebase_context.execute(
        { query: 'editor' },
        { toolCallId: 'test' }
      )

      expect(result.type).toBe('search')
      expect(result.results).toBeDefined()
      expect(result.results.length).toBeGreaterThan(0)
    })

    it('respects limit parameter', async () => {
      const result = await tools.get_codebase_context.execute(
        { query: 'editor', limit: 2 },
        { toolCallId: 'test' }
      )

      expect(result.type).toBe('search')
      expect(result.results.length).toBeLessThanOrEqual(2)
    })
  })

  describe('get_pattern_for_task', () => {
    it('returns recommended patterns for task', async () => {
      const result = await tools.get_pattern_for_task.execute(
        { task: 'implement state management for search results' },
        { toolCallId: 'test' }
      )

      expect(result).toHaveProperty('recommendedPatterns')
      expect(result).toHaveProperty('relevantServices')
      expect(result).toHaveProperty('relevantSchemas')
    })

    it('filters by categories when specified', async () => {
      const result = await tools.get_pattern_for_task.execute(
        {
          task: 'create editor integration',
          categories: ['pattern', 'service'],
        },
        { toolCallId: 'test' }
      )

      // Should only include patterns and services, not schemas
      expect(result.recommendedPatterns).toBeDefined()
      expect(result.relevantServices).toBeDefined()
    })
  })

  describe('refresh_codebase_knowledge', () => {
    it('triggers reload and returns success', async () => {
      const result = await tools.refresh_codebase_knowledge.execute(
        {},
        { toolCallId: 'test' }
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('reloaded')
    })
  })
})

// -----------------------------------------------------------------------------
// Effect Helper Tests
// -----------------------------------------------------------------------------

describe('Knowledge Effect Helpers', () => {
  describe('searchKnowledge', () => {
    it.effect('searches with query and limit', () =>
      Effect.gen(function* () {
        const results = yield* searchKnowledge('editor', 5)
        expect(results.length).toBeGreaterThan(0)
        expect(results.length).toBeLessThanOrEqual(5)
      }).pipe(Effect.provide(TestKnowledgeLayer))
    )
  })

  describe('getAllSchemas', () => {
    it.effect('returns all schemas', () =>
      Effect.gen(function* () {
        const schemas = yield* getAllSchemas()
        expect(schemas).toHaveLength(2)
        expect(schemas[0].name).toBe('EditorId')
      }).pipe(Effect.provide(TestKnowledgeLayer))
    )
  })

  describe('getAllServices', () => {
    it.effect('returns all services', () =>
      Effect.gen(function* () {
        const services = yield* getAllServices()
        expect(services).toHaveLength(1)
        expect(services[0].name).toBe('EditorOperations')
      }).pipe(Effect.provide(TestKnowledgeLayer))
    )
  })

  describe('getAllPatterns', () => {
    it.effect('returns all patterns', () =>
      Effect.gen(function* () {
        const patterns = yield* getAllPatterns()
        expect(patterns).toHaveLength(2)
        expect(patterns[0].category).toBe('effect')
      }).pipe(Effect.provide(TestKnowledgeLayer))
    )
  })

  describe('loadFullContext', () => {
    it.effect('returns complete codebase knowledge', () =>
      Effect.gen(function* () {
        const context = yield* loadFullContext()

        expect(context.schemas).toHaveLength(2)
        expect(context.services).toHaveLength(1)
        expect(context.patterns).toHaveLength(2)
      }).pipe(Effect.provide(TestKnowledgeLayer))
    )
  })

  describe('reloadKnowledge', () => {
    it.effect('completes without error', () =>
      Effect.gen(function* () {
        yield* reloadKnowledge()
        // If we reach here, reload succeeded
        expect(true).toBe(true)
      }).pipe(Effect.provide(TestKnowledgeLayer))
    )
  })
})
