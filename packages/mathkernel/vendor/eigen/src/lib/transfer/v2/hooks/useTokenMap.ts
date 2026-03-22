/**
 * useTokenMap — Derives a Map<taskId, TransferToken> from tasks + surface config.
 *
 * Recalculates when tasks array identity changes.
 *
 * @since v2
 */
import { useMemo } from 'react'
import { makeTaskToken, makeClusterToken } from '../factory'
import type { TransferToken, TransferSurfaceConfig } from '../factory'

interface TokenMapInput {
  readonly tasks: ReadonlyArray<{ readonly id: string; readonly label?: string; readonly status?: string }>
  readonly surface: TransferSurfaceConfig
  readonly clusterLabel?: string
}

export function useTokenMap({ tasks, surface, clusterLabel }: TokenMapInput) {
  const tokenMap = useMemo(() => {
    const map = new Map<string, TransferToken>()
    for (const task of tasks) {
      map.set(
        task.id,
        makeTaskToken(surface, {
          taskId: task.id,
          label: task.label,
          status: task.status,
        }),
      )
    }
    return map
  }, [tasks, surface])

  const clusterToken = useMemo(
    () =>
      makeClusterToken(surface, {
        label: clusterLabel ?? `${tasks.length} tasks`,
        taskIds: tasks.map((t) => t.id),
      }),
    [tasks, surface, clusterLabel],
  )

  return { tokenMap, clusterToken }
}
