/**
 * useUnit Hook
 *
 * Access unit context and operations.
 */
import { useCallback } from 'react'
import { useAtomValue } from 'effect-atom'
import { unitStatusFamily, unitCommentsFamily, makeUnitKey } from '../atoms'
import { setUnitStatus, addComment, getComments } from '../atoms/operations'
import type { ReviewStatus } from '../schemas/status'

export interface UseUnitOptions {
  adrId: string
  path: string
}

export interface UseUnitReturn {
  status: ReviewStatus
  comments: ReturnType<typeof getComments>
  setStatus: (status: ReviewStatus) => void
  addComment: (content: string, author?: string) => void
}

export function useUnit({ adrId, path }: UseUnitOptions): UseUnitReturn {
  const key = makeUnitKey(adrId, path)

  const status = useAtomValue(unitStatusFamily(key))
  const comments = useAtomValue(unitCommentsFamily(key))

  const setStatusFn = useCallback(
    (newStatus: ReviewStatus) => {
      setUnitStatus(adrId, path, newStatus)
    },
    [adrId, path]
  )

  const addCommentFn = useCallback(
    (content: string, author = 'Val') => {
      addComment(adrId, path, {
        author,
        content,
        timestamp: new Date(),
      })
    },
    [adrId, path]
  )

  return {
    status,
    comments,
    setStatus: setStatusFn,
    addComment: addCommentFn,
  }
}
