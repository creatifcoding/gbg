/**
 * Phase 5 tests — Feedback Loop
 *
 * Tests: quality scoring, error classification, compliance tracking,
 * retry budget, and full pipeline integration.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, Option, HashMap } from 'effect'
import {
  scoreResult,
  classifyFailure,
  recordAttempt,
  getComplianceRate,
  resetCompliance,
  createRetryBudget,
  type QualityScore,
} from '../core/feedback-loop.js'
import { UIElement, UITree } from '../core/schemas.js'
import { NormalizeError } from '../core/normalize.js'
import type { RepairResult, RepairAction } from '../core/repair.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function mkTree(elements: Record<string, { type: string; children?: string[] }>, root: string): UITree {
  let map = HashMap.empty<string, UIElement>()
  for (const [key, val] of Object.entries(elements)) {
    map = HashMap.set(map, key, new UIElement({
      key,
      type: val.type,
      props: {},
      children: val.children ?? [],
    }))
  }
  return new UITree({ root, elements: map })
}

function mkRepairResult(repairs: RepairAction[] = []): RepairResult {
  return {
    tree: UITree.empty(),
    repairs,
    quarantined: [] as any,
  }
}

// ---------------------------------------------------------------------------
// Quality Scoring (#1899)
// ---------------------------------------------------------------------------

describe('scoreResult', () => {
  it('scores a perfect tree as 1.0', () => {
    const tree = mkTree({
      p1: { type: 'Page', children: ['c1', 'c2'] },
      c1: { type: 'Card' },
      c2: { type: 'Card' },
    }, 'p1')

    const score = scoreResult(tree, mkRepairResult(), {
      expectedElements: 3,
      expectedDepth: 2,
    })

    expect(score.acceptedRatio).toBe(1)
    expect(score.depthRatio).toBe(1)
    expect(score.overall).toBe(1)
    expect(score.passed).toBe(true)
  })

  it('scores partial tree below threshold', () => {
    const tree = mkTree({ c1: { type: 'Card' } }, 'c1')

    const score = scoreResult(tree, mkRepairResult(), {
      expectedElements: 5,
      expectedDepth: 3,
      threshold: 0.5,
    })

    expect(score.acceptedRatio).toBeCloseTo(0.2)
    expect(score.depthRatio).toBeCloseTo(1 / 3)
    expect(score.passed).toBe(false)
  })

  it('counts repairs', () => {
    const repairs: RepairAction[] = [
      { action: 'assignKey', elementKey: 'auto-1', before: '', after: 'auto-1' },
      { action: 'assignKey', elementKey: 'auto-2', before: '', after: 'auto-1' },
    ]
    const score = scoreResult(
      mkTree({ p1: { type: 'Page' } }, 'p1'),
      mkRepairResult(repairs),
    )
    expect(score.repairCount).toBe(2)
  })

  it('caps ratios at 1.0 when tree exceeds expectations', () => {
    const tree = mkTree({
      p1: { type: 'Page', children: ['c1', 'c2', 'c3', 'c4', 'c5'] },
      c1: { type: 'Card' }, c2: { type: 'Card' }, c3: { type: 'Card' },
      c4: { type: 'Card' }, c5: { type: 'Card' },
    }, 'p1')

    const score = scoreResult(tree, mkRepairResult(), {
      expectedElements: 3,
      expectedDepth: 1,
    })

    expect(score.acceptedRatio).toBe(1)
    expect(score.depthRatio).toBe(1)
  })

  it('handles empty tree', () => {
    const score = scoreResult(UITree.empty(), mkRepairResult(), {
      expectedElements: 5,
    })
    expect(score.acceptedRatio).toBe(0)
    expect(score.overall).toBe(0)
    expect(score.passed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Error Classification (#1900)
// ---------------------------------------------------------------------------

describe('classifyFailure', () => {
  it('classifies extract/empty as empty_response', () => {
    const err = new NormalizeError({ stage: 'extract', message: 'No JSON object found' })
    const result = classifyFailure(err)
    expect(result.failureClass).toBe('empty_response')
    expect(result.retryHint).toContain('did not contain any JSON')
  })

  it('classifies parse error', () => {
    const err = new NormalizeError({ stage: 'parse', message: 'Unterminated string' })
    const result = classifyFailure(err)
    expect(result.failureClass).toBe('parse_error')
    expect(result.retryHint).toContain('Unterminated string')
  })

  it('classifies detect error as wrong_format', () => {
    const err = new NormalizeError({ stage: 'detect', message: 'No type field' })
    const result = classifyFailure(err)
    expect(result.failureClass).toBe('wrong_format')
  })

  it('classifies convert error as missing_key', () => {
    const err = new NormalizeError({ stage: 'convert', message: 'No componentType' })
    const result = classifyFailure(err)
    expect(result.failureClass).toBe('missing_key')
  })

  it('classifies low score as partial_tree', () => {
    const score: QualityScore = {
      acceptedRatio: 0.3,
      depthRatio: 0.5,
      overall: 0.15,
      repairCount: 0,
      passed: false,
    }
    const result = classifyFailure(undefined, score)
    expect(result.failureClass).toBe('partial_tree')
    expect(result.retryHint).toContain('30%')
  })

  it('classifies key repairs', () => {
    const repairs: RepairAction[] = [
      { action: 'assignKey', elementKey: 'auto-1', before: '', after: 'auto-1' },
    ]
    const result = classifyFailure(undefined, undefined, mkRepairResult(repairs))
    expect(result.failureClass).toBe('missing_key')
  })

  it('returns unknown when no signals', () => {
    const result = classifyFailure()
    expect(result.failureClass).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// Compliance Tracking (#1901)
// ---------------------------------------------------------------------------

describe('compliance tracking', () => {
  beforeEach(() => resetCompliance())

  it('tracks successes and failures per model', () => {
    recordAttempt('gpt-4o', { success: true })
    recordAttempt('gpt-4o', { success: true })
    recordAttempt('gpt-4o', { success: false, parseError: true })

    expect(getComplianceRate('gpt-4o')).toBeCloseTo(2 / 3)
  })

  it('returns null for unknown models', () => {
    expect(getComplianceRate('never-seen')).toBeNull()
  })

  it('tracks multiple models independently', () => {
    recordAttempt('gpt-4o', { success: true })
    recordAttempt('claude-3', { success: false, formatError: true })

    expect(getComplianceRate('gpt-4o')).toBe(1)
    expect(getComplianceRate('claude-3')).toBe(0)
  })

  it('resets all compliance data', () => {
    recordAttempt('gpt-4o', { success: true })
    resetCompliance()
    expect(getComplianceRate('gpt-4o')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Retry Budget (#1902)
// ---------------------------------------------------------------------------

describe('createRetryBudget', () => {
  it('allows retries up to maxRetries', () => {
    const budget = createRetryBudget({ maxRetries: 2 })
    const failure = classifyFailure(new NormalizeError({ stage: 'parse', message: 'bad json' }))

    const canRetry1 = budget.recordFailure(failure)
    expect(canRetry1).toBe(true)
    expect(budget.state.attempt).toBe(1)
    expect(budget.state.exhausted).toBe(false)

    const canRetry2 = budget.recordFailure(failure)
    expect(canRetry2).toBe(false)
    expect(budget.state.attempt).toBe(2)
    expect(budget.state.exhausted).toBe(true)
  })

  it('fire-and-forget mode with maxRetries=0', () => {
    const budget = createRetryBudget({ maxRetries: 0 })
    const failure = classifyFailure()

    const canRetry = budget.recordFailure(failure)
    expect(canRetry).toBe(false)
    expect(budget.state.exhausted).toBe(true)
  })

  it('generates retry prompt supplement with failure history', () => {
    const budget = createRetryBudget({ maxRetries: 3 })

    budget.recordFailure(classifyFailure(new NormalizeError({ stage: 'parse', message: 'bad' })))
    budget.recordFailure(classifyFailure(new NormalizeError({ stage: 'detect', message: 'no type' })))

    const supplement = budget.retryPromptSupplement()
    expect(supplement).not.toBeNull()
    expect(supplement).toContain('Previous Attempt Feedback')
    expect(supplement).toContain('Attempt 1 failed')
    expect(supplement).toContain('Attempt 2 failed')
  })

  it('returns null supplement when no failures', () => {
    const budget = createRetryBudget()
    expect(budget.retryPromptSupplement()).toBeNull()
  })

  it('returns null supplement when hints disabled', () => {
    const budget = createRetryBudget({ useRetryHints: false })
    budget.recordFailure(classifyFailure(new NormalizeError({ stage: 'parse', message: 'x' })))
    expect(budget.retryPromptSupplement()).toBeNull()
  })

  it('resets for new request', () => {
    const budget = createRetryBudget({ maxRetries: 1 })
    budget.recordFailure(classifyFailure())
    expect(budget.state.exhausted).toBe(true)

    budget.reset()
    expect(budget.state.attempt).toBe(0)
    expect(budget.state.exhausted).toBe(false)
    expect(budget.state.failures).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Integration: scoring → classify → retry → compliance
// ---------------------------------------------------------------------------

describe('Phase 5 Integration', () => {
  beforeEach(() => resetCompliance())

  it('full feedback loop: score → classify → retry → track', () => {
    const model = 'gpt-4o-mini'
    const budget = createRetryBudget({ maxRetries: 2 })

    // Attempt 1: parse error
    const err1 = new NormalizeError({ stage: 'parse', message: 'Unterminated string' })
    const failure1 = classifyFailure(err1)
    expect(failure1.failureClass).toBe('parse_error')

    const canRetry = budget.recordFailure(failure1)
    expect(canRetry).toBe(true)
    recordAttempt(model, { success: false, parseError: true })

    // Attempt 2: success but low quality
    const tree = mkTree({
      p1: { type: 'Page', children: ['c1'] },
      c1: { type: 'Card' },
    }, 'p1')
    const repairResult = mkRepairResult([
      { action: 'assignKey', elementKey: 'c1', before: '', after: 'c1' },
    ])
    const score = scoreResult(tree, repairResult, { expectedElements: 5, threshold: 0.5 })
    expect(score.passed).toBe(false)

    const failure2 = classifyFailure(undefined, score, repairResult)
    expect(failure2.failureClass).toBe('missing_key') // key repair detected first

    budget.recordFailure(failure2)
    expect(budget.state.exhausted).toBe(true)
    recordAttempt(model, { success: false, repairsNeeded: true })

    // Check compliance
    expect(getComplianceRate(model)).toBe(0)

    // Check retry supplement has both failures
    const supplement = budget.retryPromptSupplement()
    expect(supplement).toContain('Attempt 1')
    expect(supplement).toContain('Attempt 2')
  })
})
