/**
 * Multi-session ledger atoms.
 *
 * Atom-as-state MVP for blessing, annotating, grouping, and opening multiple
 * harness/pi sessions together. The ledger is local-first and intentionally
 * separate from pi JSONL files: grouping is UI/harness metadata, not a mutation
 * of the source session history.
 */

import { Atom } from '@effect-atom/atom-react'

import { sessionRegistry } from './atoms'
import {
  AsyncSessionSlot,
  MultiSessionGroup,
  MultiSessionLedgerSnapshot,
  SessionAnnotation,
  type MultiSessionMember,
  type SessionRef,
  sessionRefKey,
} from './pi-session-schemas'

const LEDGER_STORAGE_KEY = 'tmnl:harness:multi-session-ledger:v1'

export const multiSessionAnnotations$ = Atom.make<ReadonlyArray<SessionAnnotation>>([])
export const multiSessionGroups$ = Atom.make<ReadonlyArray<MultiSessionGroup>>([])
export const activeMultiSessionGroupId$ = Atom.make<string | null>(null)
export const asyncSessionSlots$ = Atom.make<ReadonlyArray<AsyncSessionSlot>>([])

const now = () => Date.now()

const makeId = (prefix: string): string => {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${prefix}-${uuid}`
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const getLocalStorage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function getMultiSessionLedgerSnapshot(): MultiSessionLedgerSnapshot {
  return {
    _tag: 'MultiSessionLedgerSnapshot',
    annotations: [...sessionRegistry.get(multiSessionAnnotations$)],
    groups: [...sessionRegistry.get(multiSessionGroups$)],
    activeGroupId: sessionRegistry.get(activeMultiSessionGroupId$),
    slots: [...sessionRegistry.get(asyncSessionSlots$)],
    updatedAt: now(),
  }
}

function persistLedger(): void {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    storage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(getMultiSessionLedgerSnapshot()))
  } catch {
    // Local persistence is a convenience layer; never block UI state.
  }
}

export function hydrateMultiSessionLedger(): void {
  const storage = getLocalStorage()
  if (!storage) return

  try {
    const raw = storage.getItem(LEDGER_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as MultiSessionLedgerSnapshot
    if (parsed?._tag !== 'MultiSessionLedgerSnapshot') return

    sessionRegistry.set(multiSessionAnnotations$, parsed.annotations ?? [])
    sessionRegistry.set(multiSessionGroups$, parsed.groups ?? [])
    sessionRegistry.set(activeMultiSessionGroupId$, parsed.activeGroupId ?? null)
    sessionRegistry.set(asyncSessionSlots$, parsed.slots ?? [])
  } catch {
    // Ignore corrupt local snapshots; user can rebuild groups.
  }
}

function upsertByRef<A extends { readonly ref: SessionRef }>(
  rows: ReadonlyArray<A>,
  row: A,
): ReadonlyArray<A> {
  const key = sessionRefKey(row.ref)
  const filtered = rows.filter((existing) => sessionRefKey(existing.ref) !== key)
  return [...filtered, row]
}

export function upsertSessionAnnotation(args: {
  readonly ref: SessionRef
  readonly name?: string
  readonly description?: string
  readonly summary?: SessionAnnotation['summary']
  readonly blessed?: boolean
  readonly tags?: ReadonlyArray<string>
}): SessionAnnotation {
  const key = sessionRefKey(args.ref)
  const existing = sessionRegistry
    .get(multiSessionAnnotations$)
    .find((entry) => sessionRefKey(entry.ref) === key)

  const next: SessionAnnotation = {
    _tag: 'SessionAnnotation',
    ref: args.ref,
    name: args.name ?? existing?.name,
    description: args.description ?? existing?.description,
    summary: args.summary ?? existing?.summary,
    blessed: args.blessed ?? existing?.blessed ?? false,
    tags: [...(args.tags ?? existing?.tags ?? [])],
    updatedAt: now(),
  }

  sessionRegistry.set(
    multiSessionAnnotations$,
    upsertByRef(sessionRegistry.get(multiSessionAnnotations$), next),
  )
  persistLedger()
  return next
}

export function blessSession(ref: SessionRef, patch?: {
  readonly name?: string
  readonly description?: string
  readonly tags?: ReadonlyArray<string>
}): SessionAnnotation {
  return upsertSessionAnnotation({
    ref,
    name: patch?.name,
    description: patch?.description,
    tags: patch?.tags,
    blessed: true,
  })
}

export function createMultiSessionGroup(args: {
  readonly name: string
  readonly description?: string
  readonly refs?: ReadonlyArray<SessionRef>
  readonly tags?: ReadonlyArray<string>
}): MultiSessionGroup {
  const timestamp = now()
  const members: MultiSessionMember[] = (args.refs ?? []).map((ref, index) => ({
    _tag: 'MultiSessionMember',
    ref,
    order: index,
    addedAt: timestamp,
    blessed: false,
  }))

  const group: MultiSessionGroup = {
    _tag: 'MultiSessionGroup',
    id: makeId('msg'),
    name: args.name,
    description: args.description,
    members,
    tags: [...(args.tags ?? [])],
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  sessionRegistry.set(multiSessionGroups$, [group, ...sessionRegistry.get(multiSessionGroups$)])
  sessionRegistry.set(activeMultiSessionGroupId$, group.id)
  persistLedger()
  return group
}

export function addSessionToGroup(
  groupId: string,
  ref: SessionRef,
  opts?: { readonly role?: string; readonly blessed?: boolean },
): MultiSessionGroup | null {
  let updated: MultiSessionGroup | null = null
  sessionRegistry.set(
    multiSessionGroups$,
    sessionRegistry.get(multiSessionGroups$).map((group) => {
      if (group.id !== groupId) return group

      const key = sessionRefKey(ref)
      const existing = group.members.find((member) => sessionRefKey(member.ref) === key)
      const members = existing
        ? group.members.map((member) =>
            sessionRefKey(member.ref) === key
              ? { ...member, role: opts?.role ?? member.role, blessed: opts?.blessed ?? member.blessed }
              : member,
          )
        : [
            ...group.members,
            {
              _tag: 'MultiSessionMember' as const,
              ref,
              order: group.members.length,
              addedAt: now(),
              role: opts?.role,
              blessed: opts?.blessed ?? false,
            },
          ]

      updated = { ...group, members, updatedAt: now() }
      return updated
    }),
  )
  persistLedger()
  return updated
}

export function removeSessionFromGroup(groupId: string, ref: SessionRef): MultiSessionGroup | null {
  const key = sessionRefKey(ref)
  let updated: MultiSessionGroup | null = null

  sessionRegistry.set(
    multiSessionGroups$,
    sessionRegistry.get(multiSessionGroups$).map((group) => {
      if (group.id !== groupId) return group
      const members = group.members
        .filter((member) => sessionRefKey(member.ref) !== key)
        .map((member, order) => ({ ...member, order }))
      updated = { ...group, members, updatedAt: now() }
      return updated
    }),
  )
  persistLedger()
  return updated
}

export function setActiveMultiSessionGroup(groupId: string | null): void {
  sessionRegistry.set(activeMultiSessionGroupId$, groupId)
  persistLedger()
}

export function openGroupAsAsyncSlots(groupId: string): ReadonlyArray<AsyncSessionSlot> {
  const group = sessionRegistry.get(multiSessionGroups$).find((entry) => entry.id === groupId)
  if (!group) return []

  const slots: AsyncSessionSlot[] = group.members
    .sort((a, b) => a.order - b.order)
    .map((member, index) => ({
      _tag: 'AsyncSessionSlot',
      id: `slot-${index}`,
      ref: member.ref,
      status: 'loading',
      lastActivatedAt: now(),
    }))

  sessionRegistry.set(asyncSessionSlots$, slots)
  sessionRegistry.set(activeMultiSessionGroupId$, groupId)
  persistLedger()
  return slots
}

export function markAsyncSessionSlot(
  slotId: string,
  patch: Partial<Omit<AsyncSessionSlot, '_tag' | 'id'>>,
): void {
  sessionRegistry.set(
    asyncSessionSlots$,
    sessionRegistry.get(asyncSessionSlots$).map((slot) =>
      slot.id === slotId ? { ...slot, ...patch } : slot,
    ),
  )
  persistLedger()
}

export function resetMultiSessionLedger(): void {
  sessionRegistry.set(multiSessionAnnotations$, [])
  sessionRegistry.set(multiSessionGroups$, [])
  sessionRegistry.set(activeMultiSessionGroupId$, null)
  sessionRegistry.set(asyncSessionSlots$, [])
  persistLedger()
}

hydrateMultiSessionLedger()
