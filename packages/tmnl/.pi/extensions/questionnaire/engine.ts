/**
 * Questionnaire engine — branching logic, navigation, answer collection.
 *
 * All state mutations go through registry-backed atoms.
 * Registry is NEVER reset during a run — only at the end (cleanup).
 */

import { Schema } from 'effect'
import {
  stateAtom,
  initialState,
  get,
  set,
  type QuestionnaireState,
  type RuntimeMutationFrame,
} from './atoms.ts'
import {
  Answer,
  DynamicMutationTrace,
  Question,
  QuestionnaireResult,
  type DynamicNextHook,
  type Questionnaire,
} from './schema.ts'

// =============================================================================
// Dynamic hook runtime contract
// =============================================================================

export interface DynamicHookInvocation {
  spec: Questionnaire
  currentQuestion: Question
  currentAnswers: Answer[]
  answerValues: string[]
  allAnswers: Record<string, Answer[]>
  history: string[]
  staticNextId: string | null
  staticNextQuestion: Question | null
  hook: DynamicNextHook
}

export interface DynamicHookDecision {
  mode?: 'inject' | 'modify' | 'none'
  /** Raw question payload for inject mode */
  question?: unknown
  /** Optional target override for modify mode */
  targetId?: string
  /** Raw patch payload for modify mode */
  patch?: unknown
  note?: string
  audit?: unknown
}

export interface DynamicHookControls {
  signal?: AbortSignal
}

export type DynamicHookResolver = (
  input: DynamicHookInvocation,
  controls?: DynamicHookControls,
) => Promise<DynamicHookDecision | null>

export interface StartOptions {
  dynamicResolver?: DynamicHookResolver
}

let _dynamicResolver: DynamicHookResolver | null = null

interface PendingDynamicRun {
  fromQuestionId: string
  staticNextId: string | null
  controller: AbortController
}

let _pendingDynamicRun: PendingDynamicRun | null = null

// =============================================================================
// Start — does NOT reset registry (subscriptions must survive)
// =============================================================================

function getQuestionById(s: QuestionnaireState, id: string): Question | null {
  if (!s.spec) return null
  return s.runtimeQuestions.get(id) ?? s.spec.questionMap.get(id) ?? null
}

function toAnswerRecord(answers: Map<string, Answer[]>): Record<string, Answer[]> {
  const out: Record<string, Answer[]> = {}
  for (const [k, v] of answers.entries()) out[k] = v
  return out
}

function matchesHookWhen(hook: DynamicNextHook, answerValues: readonly string[]): boolean {
  const when = hook.when ?? '*'
  if (when === '*') return true
  if (typeof when === 'string') return answerValues.includes(when)
  if (Array.isArray(when)) return answerValues.some((v) => when.includes(v))
  return false
}

function uniqueQuestionId(baseId: string, s: QuestionnaireState): string {
  const safeBase = baseId.trim().length > 0 ? baseId.trim() : `dyn_${Date.now()}`
  let id = safeBase
  let n = 1
  while ((s.spec?.questionMap.has(id) ?? false) || s.runtimeQuestions.has(id)) {
    id = `${safeBase}_${n}`
    n += 1
  }
  return id
}

function decodeQuestionOrThrow(raw: unknown): Question {
  return Schema.decodeUnknownSync(Question)(raw)
}

function recordTrace(s: QuestionnaireState, trace: DynamicMutationTrace): QuestionnaireState {
  return { ...s, dynamicTrace: [...s.dynamicTrace, trace] }
}

export function start(spec: Questionnaire, options?: StartOptions): void {
  const first = spec.questionMap.get(spec.startId)
  if (!first) throw new Error(`Start question "${spec.startId}" not found`)

  _dynamicResolver = options?.dynamicResolver ?? null
  _pendingDynamicRun = null

  set(stateAtom, {
    ...initialState,
    spec,
    current: first,
    answers: new Map(),
    history: [],
    status: 'active',
    runtimeQuestions: new Map(),
    mutationLog: [],
    dynamicTrace: [],
    dynamicPending: false,
    dynamicPendingSinceMs: null,
    dynamicInterruptRequested: false,
  })
}

// =============================================================================
// Answer + Advance
// =============================================================================

async function commitAnswer(
  s: QuestionnaireState,
  value: string,
  label: string,
  wasCustom = false,
  note?: string,
): Promise<void> {
  if (!s.spec || !s.current) return

  const ans = new Answer({ questionId: s.current.id, value, label, wasCustom, note })
  const newAnswers = new Map(s.answers)
  newAnswers.set(s.current.id, [ans])

  await advance(s, newAnswers, [value], [ans])
}

async function maybeApplyDynamicHook(
  s: QuestionnaireState,
  answers: Map<string, Answer[]>,
  answerValues: string[],
  latestAnswers: Answer[],
  staticNextId: string | null,
  frame: RuntimeMutationFrame,
): Promise<{
  nextId: string | null
  runtimeQuestions: Map<string, Question>
  trace?: DynamicMutationTrace
}> {
  const hook = s.current?.nextHook
  if (!s.spec || !s.current || !hook) {
    return { nextId: staticNextId, runtimeQuestions: new Map(s.runtimeQuestions) }
  }

  const matchedWhen = matchesHookWhen(hook, answerValues)
  if (!matchedWhen) {
    const trace = new DynamicMutationTrace({
      timestamp: new Date().toISOString(),
      hookId: hook.hookId,
      toolName: hook.toolName,
      fromQuestionId: s.current.id,
      answerValues,
      matchedWhen,
      policyMode: hook.mode ?? 'inject',
      appliedMode: 'none',
      baseNextId: staticNextId ?? undefined,
      selectedNextId: staticNextId ?? undefined,
      note: 'Hook skipped: branch condition did not match',
    })
    return {
      nextId: staticNextId,
      runtimeQuestions: new Map(s.runtimeQuestions),
      trace,
    }
  }

  if (!_dynamicResolver) {
    const trace = new DynamicMutationTrace({
      timestamp: new Date().toISOString(),
      hookId: hook.hookId,
      toolName: hook.toolName,
      fromQuestionId: s.current.id,
      answerValues,
      matchedWhen,
      policyMode: hook.mode ?? 'inject',
      appliedMode: 'none',
      baseNextId: staticNextId ?? undefined,
      selectedNextId: staticNextId ?? undefined,
      note: 'Hook skipped: no dynamic resolver configured',
    })
    return {
      nextId: staticNextId,
      runtimeQuestions: new Map(s.runtimeQuestions),
      trace,
    }
  }

  const controller = new AbortController()
  _pendingDynamicRun = {
    fromQuestionId: s.current.id,
    staticNextId,
    controller,
  }

  // mark pending before async microagent execution
  set(stateAtom, {
    ...s,
    dynamicPending: true,
    dynamicPendingSinceMs: Date.now(),
    dynamicInterruptRequested: false,
  })

  const staticNextQuestion = staticNextId ? getQuestionById(s, staticNextId) : null
  const invocation: DynamicHookInvocation = {
    spec: s.spec,
    currentQuestion: s.current,
    currentAnswers: latestAnswers,
    answerValues,
    allAnswers: toAnswerRecord(answers),
    history: s.history,
    staticNextId,
    staticNextQuestion,
    hook,
  }

  let decision: DynamicHookDecision | null = null
  let decisionError: string | undefined

  try {
    decision = await _dynamicResolver(invocation, { signal: controller.signal })
  } catch (e) {
    decisionError = e instanceof Error ? e.message : String(e)
  } finally {
    if (_pendingDynamicRun?.controller === controller) {
      _pendingDynamicRun = null
    }
  }

  const live = get(stateAtom)
  if (live.status !== 'active' || live.current?.id !== s.current.id) {
    // user navigated/cancelled while awaiting dynamic hook
    return {
      nextId: staticNextId,
      runtimeQuestions: new Map(live.runtimeQuestions),
    }
  }

  const runtimeQuestions = new Map(live.runtimeQuestions)

  if (decisionError) {
    const interrupted = live.dynamicInterruptRequested || controller.signal.aborted
    const trace = new DynamicMutationTrace({
      timestamp: new Date().toISOString(),
      hookId: hook.hookId,
      toolName: hook.toolName,
      fromQuestionId: s.current.id,
      answerValues,
      matchedWhen,
      policyMode: hook.mode ?? 'inject',
      appliedMode: 'none',
      baseNextId: staticNextId ?? undefined,
      selectedNextId: staticNextId ?? undefined,
      note: interrupted ? 'Dynamic hook interrupted by operator; falling back to static branch' : undefined,
      error: decisionError,
      request: invocation,
    })
    return { nextId: staticNextId, runtimeQuestions, trace }
  }

  if (!decision || decision.mode === 'none') {
    const trace = new DynamicMutationTrace({
      timestamp: new Date().toISOString(),
      hookId: hook.hookId,
      toolName: hook.toolName,
      fromQuestionId: s.current.id,
      answerValues,
      matchedWhen,
      policyMode: hook.mode ?? 'inject',
      appliedMode: 'none',
      baseNextId: staticNextId ?? undefined,
      selectedNextId: staticNextId ?? undefined,
      note: decision?.note ?? 'Hook returned no mutation',
      request: invocation,
      response: decision ?? undefined,
    })
    return { nextId: staticNextId, runtimeQuestions, trace }
  }

  const policy = hook.mode ?? 'inject'
  const requestedMode = decision.mode ?? (policy === 'either' ? 'inject' : policy)
  const appliedMode = policy === 'either' ? requestedMode : policy

  if (appliedMode === 'inject') {
    try {
      const raw = (typeof decision.question === 'object' && decision.question)
        ? decision.question as Record<string, unknown>
        : {}

      const proposedId = typeof raw.id === 'string' ? raw.id : `dyn_${s.current.id}_${Date.now()}`
      const id = uniqueQuestionId(proposedId, live)
      const injected = decodeQuestionOrThrow({ ...raw, id })

      runtimeQuestions.set(id, injected)
      frame.injectedIds.push(id)

      const trace = new DynamicMutationTrace({
        timestamp: new Date().toISOString(),
        hookId: hook.hookId,
        toolName: hook.toolName,
        fromQuestionId: s.current.id,
        answerValues,
        matchedWhen,
        policyMode: policy,
        appliedMode: 'inject',
        baseNextId: staticNextId ?? undefined,
        selectedNextId: id,
        injectedQuestionId: id,
        note: decision.note,
        request: invocation,
        response: decision,
      })

      return { nextId: id, runtimeQuestions, trace }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const trace = new DynamicMutationTrace({
        timestamp: new Date().toISOString(),
        hookId: hook.hookId,
        toolName: hook.toolName,
        fromQuestionId: s.current.id,
        answerValues,
        matchedWhen,
        policyMode: policy,
        appliedMode: 'none',
        baseNextId: staticNextId ?? undefined,
        selectedNextId: staticNextId ?? undefined,
        error: `Inject decode failed: ${msg}`,
        request: invocation,
        response: decision,
      })
      return { nextId: staticNextId, runtimeQuestions, trace }
    }
  }

  if (appliedMode === 'modify') {
    const targetId = decision.targetId ?? hook.targetId ?? staticNextId
    if (!targetId) {
      const trace = new DynamicMutationTrace({
        timestamp: new Date().toISOString(),
        hookId: hook.hookId,
        toolName: hook.toolName,
        fromQuestionId: s.current.id,
        answerValues,
        matchedWhen,
        policyMode: policy,
        appliedMode: 'none',
        baseNextId: staticNextId ?? undefined,
        selectedNextId: staticNextId ?? undefined,
        error: 'Modify mode without targetId and no static next',
        request: invocation,
        response: decision,
      })
      return { nextId: staticNextId, runtimeQuestions, trace }
    }

    const base = getQuestionById(live, targetId)
    if (!base) {
      const trace = new DynamicMutationTrace({
        timestamp: new Date().toISOString(),
        hookId: hook.hookId,
        toolName: hook.toolName,
        fromQuestionId: s.current.id,
        answerValues,
        matchedWhen,
        policyMode: policy,
        appliedMode: 'none',
        baseNextId: staticNextId ?? undefined,
        selectedNextId: staticNextId ?? undefined,
        targetId,
        error: `Modify target not found: ${targetId}`,
        request: invocation,
        response: decision,
      })
      return { nextId: staticNextId, runtimeQuestions, trace }
    }

    const patch = (typeof decision.patch === 'object' && decision.patch && !Array.isArray(decision.patch))
      ? decision.patch as Record<string, unknown>
      : {}

    try {
      const previous = runtimeQuestions.get(targetId) ?? null
      const merged = decodeQuestionOrThrow({ ...base, ...patch, id: targetId })

      frame.modified.push({ id: targetId, previous })
      runtimeQuestions.set(targetId, merged)

      const trace = new DynamicMutationTrace({
        timestamp: new Date().toISOString(),
        hookId: hook.hookId,
        toolName: hook.toolName,
        fromQuestionId: s.current.id,
        answerValues,
        matchedWhen,
        policyMode: policy,
        appliedMode: 'modify',
        baseNextId: staticNextId ?? undefined,
        selectedNextId: targetId,
        targetId,
        note: decision.note,
        request: invocation,
        response: decision,
      })

      return { nextId: targetId, runtimeQuestions, trace }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const trace = new DynamicMutationTrace({
        timestamp: new Date().toISOString(),
        hookId: hook.hookId,
        toolName: hook.toolName,
        fromQuestionId: s.current.id,
        answerValues,
        matchedWhen,
        policyMode: policy,
        appliedMode: 'none',
        baseNextId: staticNextId ?? undefined,
        selectedNextId: staticNextId ?? undefined,
        targetId,
        error: `Modify decode failed: ${msg}`,
        request: invocation,
        response: decision,
      })
      return { nextId: staticNextId, runtimeQuestions, trace }
    }
  }

  const trace = new DynamicMutationTrace({
    timestamp: new Date().toISOString(),
    hookId: hook.hookId,
    toolName: hook.toolName,
    fromQuestionId: s.current.id,
    answerValues,
    matchedWhen,
    policyMode: policy,
    appliedMode: 'none',
    baseNextId: staticNextId ?? undefined,
    selectedNextId: staticNextId ?? undefined,
    error: `Unsupported mode: ${String(appliedMode)}`,
    request: invocation,
    response: decision,
  })
  return { nextId: staticNextId, runtimeQuestions, trace }
}

async function advance(
  s: QuestionnaireState,
  answers: Map<string, Answer[]>,
  answerValues: string[],
  latestAnswers: Answer[],
): Promise<void> {
  if (!s.spec || !s.current) return

  // Persist answer selection immediately so an interrupted dynamic hook still retains user input.
  set(stateAtom, {
    ...s,
    answers,
  })

  const staticNextId = s.spec.resolveNext(s.current.id, answerValues)
  const frame: RuntimeMutationFrame = {
    fromQuestionId: s.current.id,
    injectedIds: [],
    modified: [],
  }

  const hookResult = await maybeApplyDynamicHook(s, answers, answerValues, latestAnswers, staticNextId, frame)

  const live = get(stateAtom)
  if (live.status !== 'active' || live.current?.id !== s.current.id) return

  const next = hookResult.nextId ? (hookResult.runtimeQuestions.get(hookResult.nextId) ?? s.spec.questionMap.get(hookResult.nextId) ?? null) : null

  let nextState: QuestionnaireState = {
    ...live,
    answers,
    history: [...live.history, s.current.id],
    current: next,
    status: next ? 'active' : 'complete',
    optionIndex: 0,
    inputText: '',
    inputMode: false,
    inputKind: null,
    inputTarget: null,
    pendingAnswer: null,
    runtimeQuestions: hookResult.runtimeQuestions,
    mutationLog: [...live.mutationLog, frame],
    dynamicPending: false,
    dynamicPendingSinceMs: null,
    dynamicInterruptRequested: false,
  }

  if (hookResult.trace) {
    nextState = recordTrace(nextState, hookResult.trace)
  }

  set(stateAtom, nextState)
}

export async function selectOption(value: string, label: string, wasCustom = false): Promise<void> {
  const s = get(stateAtom)
  if (!s.spec || !s.current || s.status !== 'active' || s.dynamicPending) return

  if (s.current.elaboration) {
    set(stateAtom, {
      ...s,
      pendingAnswer: { value, label, wasCustom },
      inputMode: true,
      inputKind: 'note',
      inputText: '',
      inputTarget: { value, label },
    })
    return
  }

  await commitAnswer(s, value, label, wasCustom)
}

export async function submitMulti(): Promise<void> {
  const s = get(stateAtom)
  if (!s.spec || !s.current || s.current.type !== 'multi-select' || s.dynamicPending) return

  const selected = s.answers.get(s.current.id) ?? []
  const values = selected.map(a => a.value)
  const newAnswers = new Map(s.answers)

  await advance(s, newAnswers, values, selected)
}

export function toggleMulti(value: string, label: string): void {
  const s = get(stateAtom)
  if (!s.spec || !s.current || s.current.type !== 'multi-select' || s.dynamicPending) return

  const existing = s.answers.get(s.current.id) ?? []
  const index = existing.findIndex(a => a.value === value)
  let next = existing

  if (index >= 0) {
    next = [...existing.slice(0, index), ...existing.slice(index + 1)]
  } else {
    next = [...existing, new Answer({ questionId: s.current.id, value, label })]
  }

  const newAnswers = new Map(s.answers)
  if (next.length === 0) newAnswers.delete(s.current.id)
  else newAnswers.set(s.current.id, next)

  set(stateAtom, { ...s, answers: newAnswers })
}

export function editMultiNote(target: { value: string; label: string }): void {
  const s = get(stateAtom)
  if (!s.spec || !s.current || s.current.type !== 'multi-select' || s.dynamicPending) return

  const existing = s.answers.get(s.current.id) ?? []
  const note = existing.find(a => a.value === target.value)?.note ?? ''

  set(stateAtom, {
    ...s,
    inputMode: true,
    inputKind: 'note',
    inputText: note,
    inputTarget: target,
    pendingAnswer: null,
  })
}

// =============================================================================
// Input Mode
// =============================================================================

export function openInput(kind: 'answer' | 'note', seed = ''): void {
  const s = get(stateAtom)
  if (s.dynamicPending) return
  set(stateAtom, {
    ...s,
    inputMode: true,
    inputKind: kind,
    inputText: seed,
    inputTarget: null,
  })
}

export async function cancelInput(): Promise<void> {
  const s = get(stateAtom)

  if (s.inputKind === 'note' && s.pendingAnswer && s.spec && s.current) {
    await commitAnswer(s, s.pendingAnswer.value, s.pendingAnswer.label, s.pendingAnswer.wasCustom)
    return
  }

  set(stateAtom, {
    ...s,
    inputMode: false,
    inputKind: null,
    inputText: '',
    inputTarget: null,
    pendingAnswer: null,
  })
}

export async function submitInput(): Promise<void> {
  const s = get(stateAtom)
  if (!s.spec || !s.current || s.dynamicPending) return

  const text = s.inputText.trim() || '(no response)'
  const kind = s.inputKind ?? (s.current.type === 'input' ? 'answer' : null)

  if (kind === 'answer') {
    await selectOption(text, text, true)
    return
  }

  if (kind === 'note') {
    if (s.pendingAnswer) {
      await commitAnswer(s, s.pendingAnswer.value, s.pendingAnswer.label, s.pendingAnswer.wasCustom, text)
      return
    }

    if (s.current.type === 'multi-select' && s.inputTarget) {
      const existing = s.answers.get(s.current.id) ?? []
      const updated = existing.map(a =>
        a.value === s.inputTarget?.value
          ? new Answer({ ...a, note: text })
          : a,
      )
      const newAnswers = new Map(s.answers)
      newAnswers.set(s.current.id, updated)

      set(stateAtom, {
        ...s,
        answers: newAnswers,
        inputMode: false,
        inputKind: null,
        inputText: '',
        inputTarget: null,
        pendingAnswer: null,
      })
    }
  }
}

export function setInputText(text: string): void {
  const s = get(stateAtom)
  if (s.dynamicPending) return
  set(stateAtom, { ...s, inputText: text })
}

// =============================================================================
// Navigation
// =============================================================================

export function back(): void {
  const s = get(stateAtom)
  if (!s.spec || s.history.length === 0 || s.dynamicPending) return

  const prevId = s.history[s.history.length - 1]
  if (!prevId) return

  const prev = getQuestionById(s, prevId)
  if (!prev) return

  const newAnswers = new Map(s.answers)
  newAnswers.delete(prevId)

  const newRuntimeQuestions = new Map(s.runtimeQuestions)
  const newMutationLog = [...s.mutationLog]
  const frame = newMutationLog.pop()

  if (frame) {
    const prunedIds = new Set(frame.injectedIds)

    for (const id of frame.injectedIds) {
      newRuntimeQuestions.delete(id)
      newAnswers.delete(id)
    }

    for (const mod of [...frame.modified].reverse()) {
      if (mod.previous) newRuntimeQuestions.set(mod.id, mod.previous)
      else newRuntimeQuestions.delete(mod.id)
    }

    const trimmedHistory = s.history.slice(0, -1).filter((id) => !prunedIds.has(id))

    set(stateAtom, {
      ...s,
      current: prev,
      history: trimmedHistory,
      answers: newAnswers,
      optionIndex: 0,
      inputText: '',
      inputMode: false,
      inputKind: null,
      inputTarget: null,
      pendingAnswer: null,
      runtimeQuestions: newRuntimeQuestions,
      mutationLog: newMutationLog,
      dynamicPending: false,
      dynamicPendingSinceMs: null,
      dynamicInterruptRequested: false,
    })
    return
  }

  set(stateAtom, {
    ...s,
    current: prev,
    history: s.history.slice(0, -1),
    answers: newAnswers,
    optionIndex: 0,
    inputText: '',
    inputMode: false,
    inputKind: null,
    inputTarget: null,
    pendingAnswer: null,
    dynamicPending: false,
    dynamicPendingSinceMs: null,
    dynamicInterruptRequested: false,
  })
}

export function cancel(): void {
  const s = get(stateAtom)
  if (_pendingDynamicRun) {
    _pendingDynamicRun.controller.abort('cancelled')
    _pendingDynamicRun = null
  }
  set(stateAtom, {
    ...s,
    status: 'cancelled',
    dynamicPending: false,
    dynamicPendingSinceMs: null,
    dynamicInterruptRequested: false,
  })
}

export function interruptDynamicPending(): void {
  const s = get(stateAtom)
  if (!s.dynamicPending) return

  if (_pendingDynamicRun) {
    _pendingDynamicRun.controller.abort('operator_interrupt')
  }

  set(stateAtom, {
    ...s,
    dynamicInterruptRequested: true,
  })
}

// =============================================================================
// Option cursor
// =============================================================================

export function moveOption(delta: number): void {
  const s = get(stateAtom)
  if (!s.current || s.dynamicPending) return

  const opts = getOptions(s)
  const next = s.optionIndex + delta
  if (next >= 0 && next < opts.length) {
    set(stateAtom, { ...s, optionIndex: next })
  }
}

// =============================================================================
// Helpers
// =============================================================================

export interface RenderOption {
  value: string
  label: string
  description?: string
  isOther?: boolean
}

function allowManualEntry(s: QuestionnaireState): boolean {
  if (!s.spec || !s.current) return false

  if (s.current.manualEntry === true) return true
  if (s.current.manualEntry === false) return false

  const mode = s.spec.manualEntry ?? 'allowOther'
  if (mode === 'always') return true
  if (mode === 'never') return false
  return s.current.allowOther === true
}

export function getOptions(s: QuestionnaireState): RenderOption[] {
  if (!s.current) return []

  if (s.current.type === 'confirm') {
    return [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ]
  }

  const opts: RenderOption[] = (s.current.options ?? []).map(o => ({
    value: o.value,
    label: o.label,
    description: o.description,
  }))

  if (allowManualEntry(s)) {
    opts.push({ value: '__manual__', label: 'Type something...', isOther: true })
  }

  return opts
}

export function getCurrentAnswers(s: QuestionnaireState): Answer[] {
  if (!s.current) return []
  return s.answers.get(s.current.id) ?? []
}

// =============================================================================
// Result
// =============================================================================

export function getResult(): QuestionnaireResult {
  const s = get(stateAtom)

  const ordered: Answer[] = []
  const seen = new Set<string>()

  for (const qid of s.history) {
    if (seen.has(qid)) continue
    seen.add(qid)
    const entries = s.answers.get(qid)
    if (entries) ordered.push(...entries)
  }

  for (const [qid, entries] of s.answers.entries()) {
    if (seen.has(qid)) continue
    ordered.push(...entries)
  }

  return new QuestionnaireResult({
    questionnaireId: s.spec?.id ?? 'unknown',
    answers: ordered,
    cancelled: s.status === 'cancelled',
    completedAt: new Date().toISOString(),
    tags: s.spec?.tags ?? [],
    persist: s.spec?.persist ?? true,
    dynamicTrace: s.dynamicTrace,
  })
}
