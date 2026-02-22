/**
 * Effect Schema definitions for questionnaire specifications.
 *
 * JSON-serializable — models can generate these inline.
 * Branching is a map of answer values → next question IDs.
 */

import { Schema } from 'effect'

// =============================================================================
// Option — a single selectable choice
// =============================================================================

export class QuestionOption extends Schema.Class<QuestionOption>('QuestionOption')({
  value: Schema.String,
  label: Schema.String,
  description: Schema.optional(Schema.String),
}) {}

// =============================================================================
// Branch — conditional next-question routing
//
// String                   → always go to that question
// Record<string, string>   → map answer value to question ID ("*" = default)
// undefined                → end of questionnaire
// =============================================================================

export const Branch = Schema.Union(
  Schema.String,
  Schema.Record({ key: Schema.String, value: Schema.String }),
)
export type Branch = typeof Branch.Type

// =============================================================================
// Dynamic next-question hook (optional)
// =============================================================================

export const DynamicHookWhen = Schema.Union(
  Schema.Literal('*'),
  Schema.String,
  Schema.Array(Schema.String),
)
export type DynamicHookWhen = typeof DynamicHookWhen.Type

export const DynamicHookMode = Schema.Literal('inject', 'modify', 'either')
export type DynamicHookMode = typeof DynamicHookMode.Type

export class DynamicNextHook extends Schema.Class<DynamicNextHook>('DynamicNextHook')({
  /** Stable identifier for audit trails */
  hookId: Schema.String,
  /** Dynamic resolver namespace (currently: "pi-agent.dynamic-next") */
  toolName: Schema.Literal('pi-agent.dynamic-next'),
  /** Branch discriminator for whether hook executes */
  when: Schema.optionalWith(DynamicHookWhen, { default: () => '*' }),
  /** Mutation policy */
  mode: Schema.optionalWith(DynamicHookMode, { default: () => 'inject' as const }),
  /** Target for modify mode (defaults to resolved static next) */
  targetId: Schema.optional(Schema.String),
  /** Additional instructions for the microagent */
  metaPrompt: Schema.optional(Schema.String),
  /** Optional model override */
  model: Schema.optional(Schema.String),
  /** Optional sampling override */
  temperature: Schema.optional(Schema.Number),
  /** Arbitrary extension payload forwarded to microagent */
  payload: Schema.optional(Schema.Unknown),
}) {}

// =============================================================================
// Question — a single step in the questionnaire
// =============================================================================

export const QuestionType = Schema.Literal('select', 'input', 'confirm', 'multi-select')
export type QuestionType = typeof QuestionType.Type

export class Question extends Schema.Class<Question>('Question')({
  id: Schema.String,
  prompt: Schema.String,
  type: QuestionType,
  options: Schema.optional(Schema.Array(QuestionOption)),
  allowOther: Schema.optional(Schema.Boolean),
  manualEntry: Schema.optional(Schema.Boolean),
  required: Schema.optional(Schema.Boolean),
  placeholder: Schema.optional(Schema.String),
  elaboration: Schema.optional(Schema.Boolean),
  elaborationPrompt: Schema.optional(Schema.String),
  next: Schema.optional(Branch),
  /** Optional dynamic branch hook for runtime injection/modification */
  nextHook: Schema.optional(DynamicNextHook),
}) {}

// =============================================================================
// Questionnaire — the full spec
// =============================================================================

export const ManualEntryMode = Schema.Literal('always', 'allowOther', 'never')
export type ManualEntryMode = typeof ManualEntryMode.Type

export class Questionnaire extends Schema.Class<Questionnaire>('Questionnaire')({
  id: Schema.String,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  questions: Schema.Array(Question),
  startId: Schema.String,
  manualEntry: Schema.optional(ManualEntryMode),
  defaultElaborationPrompt: Schema.optional(Schema.String),
  /** Whether to persist result on completion. Defaults to true (auto-save). */
  persist: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Tags for categorization, query, and filtering of persisted results */
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
}) {
  /** Build a lookup map for O(1) question access. */
  get questionMap(): Map<string, Question> {
    return new Map(this.questions.map(q => [q.id, q]))
  }

  /** Resolve next question ID given current question and answer(s). */
  resolveNext(questionId: string, answerValue: string | string[]): string | null {
    const q = this.questionMap.get(questionId)
    if (!q || !q.next) return null

    if (typeof q.next === 'string') return q.next

    // Record branch: check exact match, then "*" default
    const record = q.next as Record<string, string>
    const values = Array.isArray(answerValue) ? answerValue : [answerValue]

    for (const value of values) {
      const match = record[value]
      if (match) return match
    }

    return record['*'] ?? null
  }
}

// =============================================================================
// Answer — a single response
// =============================================================================

export class Answer extends Schema.Class<Answer>('Answer')({
  questionId: Schema.String,
  value: Schema.String,
  label: Schema.String,
  wasCustom: Schema.optional(Schema.Boolean),
  note: Schema.optional(Schema.String),
}) {}

// =============================================================================
// Runtime mutation audit trace
// =============================================================================

export class DynamicMutationTrace extends Schema.Class<DynamicMutationTrace>('DynamicMutationTrace')({
  timestamp: Schema.String,
  hookId: Schema.String,
  toolName: Schema.String,
  fromQuestionId: Schema.String,
  answerValues: Schema.Array(Schema.String),
  matchedWhen: Schema.Boolean,
  policyMode: DynamicHookMode,
  appliedMode: Schema.optional(Schema.Literal('inject', 'modify', 'none')),
  baseNextId: Schema.optional(Schema.String),
  selectedNextId: Schema.optional(Schema.String),
  targetId: Schema.optional(Schema.String),
  injectedQuestionId: Schema.optional(Schema.String),
  note: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
  request: Schema.optional(Schema.Unknown),
  response: Schema.optional(Schema.Unknown),
}) {}

// =============================================================================
// QuestionnaireResult — the complete output
// =============================================================================

export class QuestionnaireResult extends Schema.Class<QuestionnaireResult>('QuestionnaireResult')({
  questionnaireId: Schema.String,
  answers: Schema.Array(Answer),
  cancelled: Schema.Boolean,
  completedAt: Schema.optional(Schema.String),
  /** Tags propagated from the spec (+ any runtime additions) */
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** Whether this result should be persisted */
  persist: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Dynamic branch mutation audit trail for replay/debug */
  dynamicTrace: Schema.optionalWith(Schema.Array(DynamicMutationTrace), { default: () => [] }),
}) {}
