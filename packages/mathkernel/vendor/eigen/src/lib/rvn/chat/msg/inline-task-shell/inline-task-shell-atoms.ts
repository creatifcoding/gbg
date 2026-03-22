import { Atom } from '@effect-atom/atom'
import { HashMap } from 'effect'
import type { RvnChatInlineTaskItem } from '../inline-task-types'

/**
 * Per-thread task list source atom.
 * Kept alive so lookup state survives temporary unmount/remount cycles.
 */
export const inlineTaskShellTasksFamily = Atom.family((threadId: string) =>
  Atom.make<ReadonlyArray<RvnChatInlineTaskItem>>([]).pipe(Atom.keepAlive),
)

/**
 * Per-thread task lookup derived atom.
 * Canonical lookup structure for row dependency resolution.
 */
export const inlineTaskShellTaskLookupFamily = Atom.family((threadId: string) =>
  Atom.readable((get) => {
    const tasks = get(inlineTaskShellTasksFamily(threadId))
    return HashMap.fromIterable(tasks.map((t) => [t.taskId, t] as const))
  }).pipe(Atom.keepAlive),
)
