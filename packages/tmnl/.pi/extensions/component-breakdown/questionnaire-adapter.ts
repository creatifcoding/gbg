import {
  buildBreakdownQuestionnaireSpec,
  toBreakdownRequest,
  type QuestionnaireAnswerLike,
} from './questionnaire.ts'
import type { BreakdownRequest } from './schema.ts'

export interface QuestionnaireResultLike {
  cancelled: boolean
  answers: ReadonlyArray<QuestionnaireAnswerLike>
}

export interface QuestionnaireRuntime {
  runQuestionnaire: (ctx: unknown, spec: unknown) => Promise<QuestionnaireResultLike>
  Questionnaire: new (raw: unknown) => unknown
}

export async function loadQuestionnaireRuntime(): Promise<QuestionnaireRuntime> {
  try {
    const [{ runQuestionnaire }, schemaModule] = await Promise.all([
      import('../questionnaire/index.ts'),
      import('../questionnaire/schema.ts'),
    ])

    const Questionnaire = (schemaModule as { Questionnaire: new (raw: unknown) => unknown }).Questionnaire

    if (typeof runQuestionnaire !== 'function' || typeof Questionnaire !== 'function') {
      throw new Error('questionnaire runtime did not export expected symbols')
    }

    return { runQuestionnaire, Questionnaire }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Questionnaire intake unavailable. Ensure .pi/extensions/questionnaire is present and dependencies are installed (bun install). Original error: ${message}`,
    )
  }
}

export async function runBreakdownQuestionnaireIntake(ctx: { hasUI: boolean }): Promise<BreakdownRequest> {
  if (!ctx.hasUI) {
    throw new Error('Interactive questionnaire requires UI')
  }

  const runtime = await loadQuestionnaireRuntime()
  const spec = new runtime.Questionnaire(buildBreakdownQuestionnaireSpec())
  const result = await runtime.runQuestionnaire(ctx, spec)

  if (result.cancelled) {
    throw new Error('Cancelled by user')
  }

  return toBreakdownRequest(result.answers)
}
