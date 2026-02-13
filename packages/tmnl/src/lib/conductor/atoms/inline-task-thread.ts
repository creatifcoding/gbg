import { Atom } from '@effect-atom/atom'
import { Effect, Subscribable } from 'effect'
import type { InlineHarnessTaskEvent, InlineTaskStatus } from '../schemas'

export interface InlineTaskLogEntry {
  readonly at: string
  readonly message: string
  readonly seq: number
}

export interface InlineTaskThreadTask {
  readonly threadId: string
  readonly messageAnchorId?: string
  readonly taskId: string
  readonly title: string
  readonly status: InlineTaskStatus
  readonly progress: number | null
  readonly seq: number
  readonly at: string
  readonly message?: string
  readonly logs: ReadonlyArray<InlineTaskLogEntry>
}

export interface InlineTaskThreadState {
  readonly tasks: ReadonlyArray<InlineTaskThreadTask>
  readonly eventCount: number
  readonly lastSeq: number
}

export interface InlineTaskUiState {
  readonly expanded: boolean
  readonly virtualOffset: number
  readonly viewportHeight: number
}

const DEFAULT_INLINE_TASK_UI_STATE: InlineTaskUiState = {
  expanded: false,
  virtualOffset: 0,
  viewportHeight: 0,
}

export const inlineTaskEventsByThreadAtom = Atom.family((threadId: string) =>
  Atom.make<ReadonlyArray<InlineHarnessTaskEvent>>([]).pipe(Atom.keepAlive),
)

export const inlineTaskEventsSubscribableByThreadAtom = Atom.family((threadId: string) =>
  Atom.subscribable((get) =>
    Subscribable.make({
      get: Effect.succeed(get(inlineTaskEventsByThreadAtom(threadId))),
      changes: get.stream(inlineTaskEventsByThreadAtom(threadId), { withoutInitialValue: true }),
    }),
  ).pipe(Atom.keepAlive),
)

export function toInlineTaskUiStateKey(threadId: string, messageAnchorId?: string | null): string {
  const anchor = messageAnchorId?.trim()
  return anchor && anchor.length > 0 ? `${threadId}::${anchor}` : threadId
}

export const inlineTaskUiStateByScopeAtom = Atom.family((scopeKey: string) =>
  Atom.make<InlineTaskUiState>(DEFAULT_INLINE_TASK_UI_STATE).pipe(Atom.keepAlive),
)

function fromInlineTaskUiStateKey(scopeKey: string): {
  readonly threadId: string
  readonly messageAnchorId: string | null
} {
  const separator = scopeKey.indexOf('::')
  if (separator < 0) {
    return {
      threadId: scopeKey,
      messageAnchorId: null,
    }
  }

  return {
    threadId: scopeKey.slice(0, separator),
    messageAnchorId: scopeKey.slice(separator + 2),
  }
}

/** Back-compat thread-scoped UI state (no message anchor dimension) */
export const inlineTaskUiStateAtom = Atom.family((threadId: string) =>
  inlineTaskUiStateByScopeAtom(toInlineTaskUiStateKey(threadId)),
)

function reduceInlineTaskEvents(
  events: ReadonlyArray<InlineHarnessTaskEvent>,
): InlineTaskThreadState {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const byTask = new Map<string, InlineTaskThreadTask>()

  for (const event of sorted) {
    const current = byTask.get(event.taskId)

    const next: InlineTaskThreadTask = {
      threadId: event.threadId,
      messageAnchorId: event.messageAnchorId,
      taskId: event.taskId,
      title: event.title,
      status: event.status,
      progress: event.progress,
      seq: event.seq,
      at: event.at,
      message: event.message,
      logs:
        event._tag === 'InlineHarnessTaskLogAppended' && event.message
          ? [
              ...(current?.logs ?? []),
              {
                at: event.at,
                seq: event.seq,
                message: event.message,
              },
            ]
          : (current?.logs ?? []),
    }

    byTask.set(event.taskId, next)
  }

  const tasks = [...byTask.values()].sort((a, b) => a.seq - b.seq)

  return {
    tasks,
    eventCount: sorted.length,
    lastSeq: sorted.at(-1)?.seq ?? 0,
  }
}

export const inlineTaskThreadStateAtom = Atom.family((threadId: string) =>
  Atom.make((get) =>
    reduceInlineTaskEvents(get(inlineTaskEventsSubscribableByThreadAtom(threadId))),
  ),
)

export const inlineTaskTasksByScopeAtom = Atom.family((scopeKey: string) =>
  Atom.make((get) => {
    const { threadId, messageAnchorId } = fromInlineTaskUiStateKey(scopeKey)
    const tasks = get(inlineTaskThreadStateAtom(threadId)).tasks

    if (!messageAnchorId) {
      return tasks
    }

    return tasks.filter((task) => task.messageAnchorId === messageAnchorId)
  }),
)

export const inlineTaskPreviewTasksByScopeAtom = Atom.family((scopeKey: string) =>
  Atom.make((get) => get(inlineTaskTasksByScopeAtom(scopeKey)).slice(0, 3)),
)

export const inlineTaskExpandedTasksByScopeAtom = Atom.family((scopeKey: string) =>
  Atom.make((get) => get(inlineTaskTasksByScopeAtom(scopeKey))),
)

export const inlineTaskPreviewTasksAtom = Atom.family((threadId: string) =>
  inlineTaskPreviewTasksByScopeAtom(toInlineTaskUiStateKey(threadId)),
)

export const inlineTaskExpandedTasksAtom = Atom.family((threadId: string) =>
  inlineTaskExpandedTasksByScopeAtom(toInlineTaskUiStateKey(threadId)),
)

function nextSeqFrom(get: any, threadId: string): number {
  return get(inlineTaskThreadStateAtom(threadId)).lastSeq + 1
}

function appendEventWithSeqGuardFrom(get: any, event: InlineHarnessTaskEvent): void {
  const state = get(inlineTaskThreadStateAtom(event.threadId))
  if (event.seq <= state.lastSeq) {
    return
  }

  const events = get(inlineTaskEventsByThreadAtom(event.threadId))
  get.set(inlineTaskEventsByThreadAtom(event.threadId), [...events, event])
}

function snapshotTaskFrom(get: any, threadId: string, taskId: string): InlineTaskThreadTask | null {
  const tasks = get(inlineTaskThreadStateAtom(threadId)).tasks
  return tasks.find((task) => task.taskId === taskId) ?? null
}

export interface InlineTaskUpsertInput {
  readonly taskId: string
  readonly title: string
  readonly status: InlineTaskStatus
  readonly progress?: number | null
  readonly message?: string
  readonly messageAnchorId?: string
}

export const inlineTaskUpsertOpFamily = Atom.family((threadId: string) =>
  Atom.fn((input: InlineTaskUpsertInput, get) =>
    Effect.sync(() => {
      const seq = nextSeqFrom(get, threadId)
      appendEventWithSeqGuardFrom(get, {
        _tag: 'InlineHarnessTaskUpserted',
        threadId,
        messageAnchorId: input.messageAnchorId,
        taskId: input.taskId,
        title: input.title,
        status: input.status,
        progress: input.progress ?? null,
        seq,
        at: new Date().toISOString(),
        message: input.message,
      })
    }),
  ),
)

export interface InlineTaskStatusInput {
  readonly taskId: string
  readonly status: InlineTaskStatus
  readonly message?: string
}

export const inlineTaskStatusUpdateOpFamily = Atom.family((threadId: string) =>
  Atom.fn((input: InlineTaskStatusInput, get) =>
    Effect.sync(() => {
      const current = snapshotTaskFrom(get, threadId, input.taskId)
      const seq = nextSeqFrom(get, threadId)

      appendEventWithSeqGuardFrom(get, {
        _tag: 'InlineHarnessTaskStatusChanged',
        threadId,
        messageAnchorId: current?.messageAnchorId,
        taskId: input.taskId,
        title: current?.title ?? input.taskId,
        status: input.status,
        previousStatus: current?.status,
        progress: current?.progress ?? null,
        seq,
        at: new Date().toISOString(),
        message: input.message,
      })
    }),
  ),
)

export interface InlineTaskProgressInput {
  readonly taskId: string
  readonly progress: number | null
  readonly message?: string
}

export const inlineTaskProgressUpdateOpFamily = Atom.family((threadId: string) =>
  Atom.fn((input: InlineTaskProgressInput, get) =>
    Effect.sync(() => {
      const current = snapshotTaskFrom(get, threadId, input.taskId)
      const seq = nextSeqFrom(get, threadId)

      appendEventWithSeqGuardFrom(get, {
        _tag: 'InlineHarnessTaskProgressChanged',
        threadId,
        messageAnchorId: current?.messageAnchorId,
        taskId: input.taskId,
        title: current?.title ?? input.taskId,
        status: current?.status ?? 'queued',
        progress: input.progress,
        seq,
        at: new Date().toISOString(),
        message: input.message,
      })
    }),
  ),
)

export interface InlineTaskLogInput {
  readonly taskId: string
  readonly message: string
}

export const inlineTaskLogAppendOpFamily = Atom.family((threadId: string) =>
  Atom.fn((input: InlineTaskLogInput, get) =>
    Effect.sync(() => {
      const current = snapshotTaskFrom(get, threadId, input.taskId)
      const seq = nextSeqFrom(get, threadId)

      appendEventWithSeqGuardFrom(get, {
        _tag: 'InlineHarnessTaskLogAppended',
        threadId,
        messageAnchorId: current?.messageAnchorId,
        taskId: input.taskId,
        title: current?.title ?? input.taskId,
        status: current?.status ?? 'queued',
        progress: current?.progress ?? null,
        seq,
        at: new Date().toISOString(),
        message: input.message,
      })
    }),
  ),
)

export const inlineTaskAppendEventOp = Atom.fn((event: InlineHarnessTaskEvent, get) =>
  Effect.sync(() => {
    appendEventWithSeqGuardFrom(get, event)
  }),
)

export const inlineTaskSetExpandedByScopeOpFamily = Atom.family((scopeKey: string) =>
  Atom.fn((expanded: boolean, get) =>
    Effect.sync(() => {
      const state = get(inlineTaskUiStateByScopeAtom(scopeKey))
      get.set(inlineTaskUiStateByScopeAtom(scopeKey), {
        ...state,
        expanded,
      })
    }),
  ),
)

export const inlineTaskSetVirtualOffsetByScopeOpFamily = Atom.family((scopeKey: string) =>
  Atom.fn((virtualOffset: number, get) =>
    Effect.sync(() => {
      const state = get(inlineTaskUiStateByScopeAtom(scopeKey))
      get.set(inlineTaskUiStateByScopeAtom(scopeKey), {
        ...state,
        virtualOffset,
      })
    }),
  ),
)

export const inlineTaskSetViewportHeightByScopeOpFamily = Atom.family((scopeKey: string) =>
  Atom.fn((viewportHeight: number, get) =>
    Effect.sync(() => {
      const state = get(inlineTaskUiStateByScopeAtom(scopeKey))
      get.set(inlineTaskUiStateByScopeAtom(scopeKey), {
        ...state,
        viewportHeight,
      })
    }),
  ),
)

/** Back-compat thread-scoped expanded state setter */
export const inlineTaskSetExpandedOpFamily = Atom.family((threadId: string) =>
  inlineTaskSetExpandedByScopeOpFamily(toInlineTaskUiStateKey(threadId)),
)
