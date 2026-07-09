/**
 * Effect Atom-backed RCA data resources.
 *
 * Server responses are decoded in lib/api.ts, then stored in Effect v4 atoms.
 * There is no TanStack cache and no external atom package.
 */
import { useCallback, useEffect, useMemo } from 'react'
import { Atom } from 'effect/unstable/reactivity'
import { useAtomValue, useAtomSet } from './atoms.ts'
import {
  fetchSessions,
  fetchGraph,
  fetchEvidence,
  fetchQuestionnaires,
  fetchModelViews,
} from './api.ts'
import type {
  EvidenceList,
  GraphData,
  ModelViewList,
  QuestionnaireList,
  SessionList,
} from './schema.ts'

type ResourceState<T> = {
  readonly data: T | undefined
  readonly isLoading: boolean
  readonly error: Error | null
}

type ResourceResult<T> = ResourceState<T> & {
  readonly refetch: () => void
}

const idle = <T>(): ResourceState<T> => ({ data: undefined, isLoading: false, error: null })
const loading = <T>(): ResourceState<T> => ({ data: undefined, isLoading: true, error: null })

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}
const sessionsInitial: ResourceState<SessionList> = loading()
const graphInitial: ResourceState<GraphData> = loading()
const evidenceInitial: ResourceState<EvidenceList> = loading()
const questionnairesInitial: ResourceState<QuestionnaireList> = loading()
const modelViewsInitial: ResourceState<ModelViewList> = loading()


const sessionsAtom = Atom.make(sessionsInitial)
const graphAtom = Atom.family((_sessionId: string) => Atom.make(graphInitial))
const evidenceAtom = Atom.family((_sessionId: string) => Atom.make(evidenceInitial))
const questionnairesAtom = Atom.family((_sessionId: string) => Atom.make(questionnairesInitial))
const modelViewsAtom = Atom.family((_sessionId: string) => Atom.make(modelViewsInitial))

function useResource<T>(
  atom: Atom.Writable<ResourceState<T>, ResourceState<T>>,
  enabled: boolean,
  load: () => Promise<T>,
  intervalMs?: number,
): ResourceResult<T> {
  const state = useAtomValue(atom)
  const setState = useAtomSet(atom)

  const refetch = useCallback(() => {
    if (!enabled) {
      setState(idle<T>())
      return
    }

    setState((previous) => ({ ...previous, isLoading: true, error: null }))
    void load().then(
      (data) => setState({ data, isLoading: false, error: null }),
      (error) => setState((previous) => ({ ...previous, isLoading: false, error: toError(error) })),
    )
  }, [enabled, load, setState])

  useEffect(() => {
    refetch()
    if (!enabled || intervalMs === undefined) return
    const handle = window.setInterval(refetch, intervalMs)
    return () => window.clearInterval(handle)
  }, [enabled, intervalMs, refetch])

  return { ...state, refetch }
}

export function useSessionsQuery(): ResourceResult<SessionList> {
  const load = useCallback(() => fetchSessions(), [])
  return useResource(sessionsAtom, true, load, 15_000)
}

export function useGraphQuery(sessionId: string | null): ResourceResult<GraphData> {
  const atom = useMemo(() => graphAtom(sessionId ?? '__none__'), [sessionId])
  const load = useCallback(() => fetchGraph(sessionId ?? ''), [sessionId])
  return useResource(atom, sessionId !== null, load)
}

export function useEvidenceQuery(sessionId: string | null): ResourceResult<EvidenceList> {
  const atom = useMemo(() => evidenceAtom(sessionId ?? '__none__'), [sessionId])
  const load = useCallback(() => fetchEvidence(sessionId ?? ''), [sessionId])
  return useResource(atom, sessionId !== null, load, 10_000)
}

export function useQuestionnairesQuery(sessionId: string | null): ResourceResult<QuestionnaireList> {
  const atom = useMemo(() => questionnairesAtom(sessionId ?? '__none__'), [sessionId])
  const load = useCallback(() => fetchQuestionnaires(sessionId ?? ''), [sessionId])
  return useResource(atom, sessionId !== null, load)
}

export function useModelViewsQuery(sessionId: string | null): ResourceResult<ModelViewList> {
  const atom = useMemo(() => modelViewsAtom(sessionId ?? '__none__'), [sessionId])
  const load = useCallback(() => fetchModelViews(sessionId ?? ''), [sessionId])
  return useResource(atom, sessionId !== null, load)
}
