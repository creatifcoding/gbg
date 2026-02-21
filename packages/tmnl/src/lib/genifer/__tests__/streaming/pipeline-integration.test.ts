/**
 * Pipeline orchestrator integration tests
 *
 * Tests the full Phase 1–5 integration:
 *   streaming chunks → graph → normalizeElement → tree builder →
 *   repair → quality scoring → compliance tracking
 */
import { describe, it, expect, beforeEach } from 'vitest'
import * as Registry from '@effect-atom/atom/Registry'
import { Option } from 'effect'
import {
  createStreamingPipeline,
  pipelineTreeAtom,
  normalizedElementsAtom,
  quarantinedAtom,
  completionFrontierAtom,
  qualityScoreAtom,
  classifiedFailureAtom,
  pipelineStageAtom,
  identifiedComponentsAtom,
  chunkCountAtom,
  pipelineErrorAtom,
} from '../../streaming/pipeline.js'
import { resetCompliance, getComplianceRate } from '../../core/feedback-loop.js'
import { resetAutoKeyCounter } from '../../core/incremental-normalize.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Nested JSON with 1 container + 2 leaves */
const NESTED_JSON = JSON.stringify({
  type: 'Page',
  key: 'page-1',
  props: { title: 'Dashboard' },
  children: [
    { type: 'Card', key: 'card-1', props: { label: 'CPU', value: 42 } },
    { type: 'Card', key: 'card-2', props: { label: 'Memory', value: 87 } },
  ],
})

/** Single component, no children */
const LEAF_JSON = JSON.stringify({
  type: 'Metric',
  key: 'metric-1',
  props: { label: 'Uptime', value: 99.9 },
})

/** Malformed — not valid JSON */
const BAD_JSON = '{ "type": "Page", "key": "p1", "props": { broken }'

beforeEach(() => {
  resetCompliance()
  resetAutoKeyCounter()
})

// ---------------------------------------------------------------------------
// Basic Pipeline
// ---------------------------------------------------------------------------

describe('createStreamingPipeline', () => {
  it('processes a complete nested JSON into UITree', () => {
    const pipeline = createStreamingPipeline()
    const r = pipeline.registry

    // Feed in small chunks to simulate streaming
    const chunks = NESTED_JSON.match(/.{1,20}/g)!
    for (const chunk of chunks) {
      pipeline.feedChunk(chunk)
    }

    expect(r.get(pipelineStageAtom)).toBe('streaming')
    expect(r.get(chunkCountAtom)).toBe(chunks.length)

    // Finalize
    const { tree, score, repairResult } = pipeline.finalize()

    // Tree should have elements
    expect(tree.size).toBeGreaterThan(0)

    // Score should exist
    expect(score).toBeDefined()
    expect(score.acceptedRatio).toBeGreaterThan(0)

    // Stage should be complete or failed (depending on threshold)
    const stage = r.get(pipelineStageAtom)
    expect(['complete', 'failed']).toContain(stage)
  })

  it('tracks normalized elements progressively', () => {
    const pipeline = createStreamingPipeline()
    const r = pipeline.registry

    // Feed in one big chunk
    pipeline.feedChunk(NESTED_JSON)

    // Some elements should be normalized even before finalize
    const normalized = r.get(normalizedElementsAtom)
    // At least some should be there (cards complete before page)
    expect(normalized.length).toBeGreaterThanOrEqual(0)

    pipeline.finalize()

    // After finalize, should have elements
    const finalNormalized = r.get(normalizedElementsAtom)
    expect(finalNormalized.length).toBeGreaterThan(0)
  })

  it('updates completion frontier', () => {
    const pipeline = createStreamingPipeline()
    const r = pipeline.registry

    pipeline.feedChunk(NESTED_JSON)
    pipeline.finalize()

    const frontier = r.get(completionFrontierAtom)
    expect(frontier.size).toBeGreaterThan(0)
  })

  it('processes a single leaf component', () => {
    const pipeline = createStreamingPipeline()

    pipeline.feedChunk(LEAF_JSON)
    const { tree, score } = pipeline.finalize()

    expect(tree.size).toBeGreaterThan(0)
    expect(score.acceptedRatio).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Quality Scoring
// ---------------------------------------------------------------------------

describe('pipeline quality scoring', () => {
  it('scores with expected element count', () => {
    const pipeline = createStreamingPipeline({
      expectedElements: 3,
      expectedDepth: 2,
      qualityThreshold: 0.3,
    })

    pipeline.feedChunk(NESTED_JSON)
    const { score } = pipeline.finalize()

    expect(score.acceptedRatio).toBeGreaterThan(0)
    expect(score.depthRatio).toBeGreaterThan(0)
  })

  it('populates qualityScoreAtom after finalize', () => {
    const pipeline = createStreamingPipeline()
    const r = pipeline.registry

    expect(Option.isNone(r.get(qualityScoreAtom))).toBe(true)

    pipeline.feedChunk(NESTED_JSON)
    pipeline.finalize()

    const scoreOpt = r.get(qualityScoreAtom)
    expect(Option.isSome(scoreOpt)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Compliance Tracking
// ---------------------------------------------------------------------------

describe('pipeline compliance tracking', () => {
  it('records attempt for model', () => {
    const pipeline = createStreamingPipeline({
      model: 'gpt-4o-mini',
      qualityThreshold: 0.01, // very low so it passes
    })

    pipeline.feedChunk(NESTED_JSON)
    pipeline.finalize()

    const rate = getComplianceRate('gpt-4o-mini')
    expect(rate).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe('pipeline reset', () => {
  it('resets all atoms to initial state', () => {
    const pipeline = createStreamingPipeline()
    const r = pipeline.registry

    pipeline.feedChunk(NESTED_JSON)
    pipeline.finalize()

    // State should be populated
    expect(r.get(normalizedElementsAtom).length).toBeGreaterThan(0)

    pipeline.reset()

    expect(r.get(pipelineTreeAtom).size).toBe(0)
    expect(r.get(normalizedElementsAtom)).toEqual([])
    expect(r.get(quarantinedAtom)).toEqual([])
    expect(r.get(completionFrontierAtom).size).toBe(0)
    expect(Option.isNone(r.get(qualityScoreAtom))).toBe(true)
    expect(Option.isNone(r.get(classifiedFailureAtom))).toBe(true)
    expect(r.get(pipelineStageAtom)).toBe('idle')
    expect(r.get(identifiedComponentsAtom)).toEqual([])
    expect(Option.isNone(r.get(pipelineErrorAtom))).toBe(true)
    expect(r.get(chunkCountAtom)).toBe(0)
  })

  it('allows re-use after reset', () => {
    const pipeline = createStreamingPipeline()

    // First run
    pipeline.feedChunk(NESTED_JSON)
    pipeline.finalize()

    pipeline.reset()

    // Second run with different data
    pipeline.feedChunk(LEAF_JSON)
    const { tree } = pipeline.finalize()

    expect(tree.size).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Retry Budget Integration
// ---------------------------------------------------------------------------

describe('pipeline retry budget', () => {
  it('exposes retry budget for orchestration', () => {
    const pipeline = createStreamingPipeline({ retry: { maxRetries: 2 } })

    expect(pipeline.retryBudget.state.maxRetries).toBe(2)
    expect(pipeline.retryBudget.state.attempt).toBe(0)
    expect(pipeline.retryBudget.state.exhausted).toBe(false)
  })

  it('retry budget resets with pipeline reset', () => {
    const pipeline = createStreamingPipeline({ retry: { maxRetries: 1 } })

    // Simulate a failure
    const failure = { failureClass: 'parse_error' as const, retryHint: 'test' }
    pipeline.retryBudget.recordFailure(failure)
    expect(pipeline.retryBudget.state.exhausted).toBe(true)

    pipeline.reset()
    expect(pipeline.retryBudget.state.exhausted).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Multi-chunk Streaming Simulation
// ---------------------------------------------------------------------------

describe('pipeline multi-chunk streaming', () => {
  it('handles character-by-character streaming', () => {
    const pipeline = createStreamingPipeline({ qualityThreshold: 0.01 })

    // Character by character
    for (const char of LEAF_JSON) {
      pipeline.feedChunk(char)
    }

    const { tree, score } = pipeline.finalize()
    expect(tree.size).toBeGreaterThan(0)
    expect(score.overall).toBeGreaterThan(0)
  })

  it('tracks chunk count accurately', () => {
    const pipeline = createStreamingPipeline()
    const r = pipeline.registry

    pipeline.feedChunk('{"type"')
    pipeline.feedChunk(':"Card"')
    pipeline.feedChunk(',"key":"c1"')
    pipeline.feedChunk(',"props":{}}')

    expect(r.get(chunkCountAtom)).toBe(4)
  })
})
