import { BreakdownRequest } from './schema.ts'

export interface QuestionnaireAnswerLike {
  questionId: string
  value: string
  label: string
}

export interface QuestionnaireSpecLike {
  id: string
  title: string
  description: string
  startId: string
  persist: boolean
  tags: string[]
  questions: Array<{
    id: string
    prompt: string
    type: 'input' | 'select'
    allowOther?: boolean
    next?: string
    options?: Array<{ value: string; label: string }>
  }>
}

export const buildBreakdownQuestionnaireSpec = (): QuestionnaireSpecLike => ({
  id: 'component-breakdown-v1',
  title: 'Component Breakdown Intake',
  description: 'Collect minimal inputs to generate UI breakdown templates.',
  startId: 'component',
  persist: false,
  tags: ['ui', 'breakdown', 'templates'],
  questions: [
    {
      id: 'component',
      prompt: 'Component name?',
      type: 'input',
      next: 'context',
    },
    {
      id: 'context',
      prompt: 'Context (optional, one line)?',
      type: 'input',
      allowOther: true,
      next: 'mode',
    },
    {
      id: 'mode',
      prompt: 'State diagram density?',
      type: 'select',
      options: [
        { value: 'compact', label: 'Compact only' },
        { value: 'expanded', label: 'Expanded only' },
        { value: 'both', label: 'Both' },
      ],
      next: 'interactions',
    },
    {
      id: 'interactions',
      prompt: 'Interaction modes (comma-separated)',
      type: 'input',
    },
  ],
})

const answerValue = (answers: ReadonlyArray<QuestionnaireAnswerLike>, questionId: string): string => {
  const match = answers.find((a) => a.questionId === questionId)
  return match?.value?.trim() ?? ''
}

export const toBreakdownRequest = (answers: ReadonlyArray<QuestionnaireAnswerLike>) => {
  const componentName = answerValue(answers, 'component') || 'UnnamedComponent'
  const context = answerValue(answers, 'context')
  const mode = answerValue(answers, 'mode')
  const interactionRaw = answerValue(answers, 'interactions')

  const interactionModes = interactionRaw
    ? interactionRaw.split(',').map((part) => part.trim()).filter(Boolean)
    : undefined

  return new BreakdownRequest({
    componentName,
    context: context || undefined,
    diagramMode: mode === 'compact' || mode === 'expanded' || mode === 'both' ? mode : 'both',
    interactionModes,
  })
}
