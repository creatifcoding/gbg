/**
 * Feedback Loop — Quality scoring, error-aware retry, compliance tracking
 *
 * The final stage of the normalization pipeline. After normalize → repair
 * produces a UITree, the feedback loop:
 *  1. Scores the result (accepted/total × depth/requested)
 *  2. Classifies failures for targeted retry prompts
 *  3. Tracks format compliance per model for adaptive profiles
 *  4. Manages retry budget (configurable, default 2)
 *
 * @module genifer/core/feedback-loop
 */
import { Effect } from 'effect'
import type { UITree } from './schemas.js'
import type { NormalizeError } from './normalize.js'
import type { RepairResult } from './repair.js'
import type { ModelFamily } from './prompt-engineering.js'

// =============================================================================
// Quality Scoring (#1899)
// =============================================================================

export type QualityScore = {
  /** Ratio of accepted elements to total requested (0–1) */
  readonly acceptedRatio: number
  /** Ratio of achieved depth to requested depth (0–1, capped at 1) */
  readonly depthRatio: number
  /** Combined score: acceptedRatio × depthRatio (0–1) */
  readonly overall: number
  /** Number of repairs applied */
  readonly repairCount: number
  /** Whether the result passes the minimum quality threshold */
  readonly passed: boolean
}

export type ScoreOptions = {
  /** Expected number of elements (from prompt/catalog heuristic) */
  readonly expectedElements?: number
  /** Expected tree depth */
  readonly expectedDepth?: number
  /** Minimum overall score to pass (0–1, default 0.5) */
  readonly threshold?: number
}

/**
 * Score a normalize+repair result.
 *
 * - acceptedRatio: actual elements / expected elements (capped at 1)
 * - depthRatio: actual depth / expected depth (capped at 1)
 * - overall: acceptedRatio × depthRatio
 * - passed: overall >= threshold
 */
export function scoreResult(
  tree: UITree,
  repairResult: RepairResult,
  opts: ScoreOptions = {},
): QualityScore {
  const expectedElements = opts.expectedElements ?? Math.max(tree.size, 1)
  const expectedDepth = opts.expectedDepth ?? 3
  const threshold = opts.threshold ?? 0.5

  const acceptedRatio = Math.min(tree.size / Math.max(expectedElements, 1), 1)
  const actualDepth = computeTreeDepth(tree)
  const depthRatio = Math.min(actualDepth / Math.max(expectedDepth, 1), 1)
  const overall = acceptedRatio * depthRatio
  const repairCount = repairResult.repairs.length

  return {
    acceptedRatio,
    depthRatio,
    overall,
    repairCount,
    passed: overall >= threshold,
  }
}

/** Compute the max depth of a UITree */
function computeTreeDepth(tree: UITree): number {
  if (tree.size === 0) return 0

  function depth(key: string, visited: Set<string>): number {
    if (visited.has(key)) return 0
    visited.add(key)

    const el = tree.getElement(key)
    if (el._tag === 'None') return 1

    const children = el.value.children
    if (children.length === 0) return 1

    let max = 0
    for (const childKey of children) {
      max = Math.max(max, depth(childKey, visited))
    }
    return 1 + max
  }

  return depth(tree.root, new Set())
}

// =============================================================================
// Error Classification (#1900)
// =============================================================================

export type FailureClass =
  | 'parse_error'     // JSON parse failure → add format example to retry
  | 'bfta_reject'     // BFTA grammar violation → add constraint reminder
  | 'missing_key'     // Components without keys → emphasize key requirement
  | 'wrong_format'    // Flat when nested expected, etc → specify format
  | 'empty_response'  // No content → rephrase prompt
  | 'partial_tree'    // Score too low → request more detail
  | 'unknown'

export type ClassifiedFailure = {
  readonly failureClass: FailureClass
  /** Targeted retry instruction for this failure class */
  readonly retryHint: string
  /** Original error if available */
  readonly error?: NormalizeError
}

/**
 * Classify a normalize/repair failure for targeted retry.
 */
export function classifyFailure(
  error?: NormalizeError,
  score?: QualityScore,
  repairResult?: RepairResult,
): ClassifiedFailure {
  // Check error stage
  if (error) {
    switch (error.stage) {
      case 'extract':
        if (error.message.includes('No JSON')) {
          return {
            failureClass: 'empty_response',
            retryHint: 'Your response did not contain any JSON. Please return ONLY a JSON object with "type", "key", and "props" fields.',
            error,
          }
        }
        return {
          failureClass: 'parse_error',
          retryHint: 'Your response contained invalid JSON. Please ensure the response is a single valid JSON object with no markdown fences or explanation text.',
          error,
        }
      case 'parse':
        return {
          failureClass: 'parse_error',
          retryHint: `JSON parse error: ${error.message}. Please check for trailing commas, unclosed strings, or missing brackets.`,
          error,
        }
      case 'detect':
        return {
          failureClass: 'wrong_format',
          retryHint: 'The JSON structure was not recognized. Every component object must have a "type" field. Use nested format: {"type":"...", "key":"...", "props":{...}, "children":[...]}',
          error,
        }
      case 'convert':
        return {
          failureClass: 'missing_key',
          retryHint: 'Some components were missing required fields. Every component needs "type" and "key" fields.',
          error,
        }
    }
  }

  // Check repair results
  if (repairResult && repairResult.repairs.length > 0) {
    const hasKeyRepairs = repairResult.repairs.some(r => r.action === 'assignKey')
    if (hasKeyRepairs) {
      return {
        failureClass: 'missing_key',
        retryHint: 'Some components were missing "key" fields. Every component MUST have a unique "key" string.',
      }
    }
  }

  // Check score
  if (score && !score.passed) {
    return {
      failureClass: 'partial_tree',
      retryHint: `The response had only ${Math.round(score.acceptedRatio * 100)}% of expected elements. Please include more detail and ensure all requested components are present.`,
    }
  }

  return {
    failureClass: 'unknown',
    retryHint: 'Please try again with a complete JSON response following the format specification.',
  }
}

// =============================================================================
// Format Compliance Tracking (#1901)
// =============================================================================

export type ComplianceCounters = {
  readonly attempts: number
  readonly successes: number
  readonly parseErrors: number
  readonly formatErrors: number
  readonly repairsNeeded: number
}

const emptyCounters: ComplianceCounters = {
  attempts: 0,
  successes: 0,
  parseErrors: 0,
  formatErrors: 0,
  repairsNeeded: 0,
}

/**
 * Compliance store — tracks format compliance per model.
 *
 * Plain mutable state. For React consumption, expose via atom in the
 * react/ layer (Atom.make(() => getComplianceStore())).
 */
let _complianceStore: Record<string, ComplianceCounters> = {}

/** Get the raw compliance store (for atom bridging) */
export function getComplianceStore(): Readonly<Record<string, ComplianceCounters>> {
  return _complianceStore
}

/**
 * Record a pipeline attempt result.
 */
export function recordAttempt(
  model: string,
  outcome: { success: boolean; parseError?: boolean; formatError?: boolean; repairsNeeded?: boolean },
): void {
  const prev = _complianceStore[model] ?? emptyCounters

  _complianceStore = {
    ..._complianceStore,
    [model]: {
      attempts: prev.attempts + 1,
      successes: prev.successes + (outcome.success ? 1 : 0),
      parseErrors: prev.parseErrors + (outcome.parseError ? 1 : 0),
      formatErrors: prev.formatErrors + (outcome.formatError ? 1 : 0),
      repairsNeeded: prev.repairsNeeded + (outcome.repairsNeeded ? 1 : 0),
    },
  }
}

/**
 * Get compliance rate for a model (0–1, or null if no data).
 */
export function getComplianceRate(model: string): number | null {
  const counters = _complianceStore[model]
  if (!counters || counters.attempts === 0) return null
  return counters.successes / counters.attempts
}

/**
 * Reset compliance data (for testing).
 */
export function resetCompliance(): void {
  _complianceStore = {}
}

// =============================================================================
// Retry Budget (#1902)
// =============================================================================

export type RetryBudgetConfig = {
  /** Maximum retries. 0 = fire-and-forget, no retries. Default: 2. */
  readonly maxRetries: number
  /** Whether to include error-aware hints in retry prompts. Default: true. */
  readonly useRetryHints: boolean
}

export type RetryState = {
  readonly attempt: number
  readonly maxRetries: number
  readonly exhausted: boolean
  readonly failures: ClassifiedFailure[]
}

/**
 * Create a retry budget manager.
 *
 * Tracks attempts, accumulates failure classifications, and generates
 * retry prompts with targeted hints based on failure history.
 */
export function createRetryBudget(config: Partial<RetryBudgetConfig> = {}): {
  readonly state: RetryState
  /** Record a failure. Returns whether retry is allowed. */
  recordFailure: (failure: ClassifiedFailure) => boolean
  /** Generate a retry prompt supplement based on accumulated failures. */
  retryPromptSupplement: () => string | null
  /** Reset for new request. */
  reset: () => void
} {
  const maxRetries = config.maxRetries ?? 2
  const useRetryHints = config.useRetryHints ?? true

  let attempt = 0
  let failures: ClassifiedFailure[] = []

  return {
    get state(): RetryState {
      return {
        attempt,
        maxRetries,
        exhausted: attempt >= maxRetries,
        failures: [...failures],
      }
    },

    recordFailure(failure: ClassifiedFailure): boolean {
      attempt++
      failures.push(failure)
      return attempt < maxRetries
    },

    retryPromptSupplement(): string | null {
      if (!useRetryHints || failures.length === 0) return null

      const hints = failures.map((f, i) =>
        `Attempt ${i + 1} failed: ${f.retryHint}`
      )

      return [
        '# Previous Attempt Feedback',
        '',
        ...hints,
        '',
        'Please fix these issues in your next response.',
      ].join('\n')
    },

    reset() {
      attempt = 0
      failures = []
    },
  }
}
