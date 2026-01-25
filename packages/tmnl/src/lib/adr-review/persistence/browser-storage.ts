/**
 * ADR Review Browser Storage
 *
 * localStorage-based persistence for browser environment.
 * Simple key-value storage for review state.
 */
import type { ReviewStatus, Comment } from '../schemas/status'

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_PREFIX = 'tmnl:adr-review:'
const UNIT_STATUSES_KEY = `${STORAGE_PREFIX}unit-statuses`
const COMMENTS_KEY = `${STORAGE_PREFIX}comments`

// =============================================================================
// Types
// =============================================================================

interface StoredUnitStatus {
  adrId: string
  unitPath: string
  status: ReviewStatus
  reviewedAt: string | null
  reviewedBy: string | null
}

interface StoredComment {
  id: string
  adrId: string
  unitPath: string
  author: string
  content: string
  createdAt: string
  replyTo: string | null
}

export interface HydratedState {
  unitStatuses: Map<string, ReviewStatus>
  unitComments: Map<string, Comment[]>
}

// =============================================================================
// Storage Helpers
// =============================================================================

function getStoredStatuses(): StoredUnitStatus[] {
  try {
    const raw = localStorage.getItem(UNIT_STATUSES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setStoredStatuses(statuses: StoredUnitStatus[]): void {
  try {
    localStorage.setItem(UNIT_STATUSES_KEY, JSON.stringify(statuses))
  } catch (e) {
    console.error('[adr-review] Failed to persist statuses:', e)
  }
}

function getStoredComments(): StoredComment[] {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setStoredComments(comments: StoredComment[]): void {
  try {
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments))
  } catch (e) {
    console.error('[adr-review] Failed to persist comments:', e)
  }
}

// =============================================================================
// Hydration
// =============================================================================

/**
 * Hydrate review state from localStorage for a specific ADR.
 */
export function hydrateADR(adrId: string): HydratedState {
  const allStatuses = getStoredStatuses()
  const allComments = getStoredComments()

  // Filter to this ADR
  const adrStatuses = allStatuses.filter((s) => s.adrId === adrId)
  const adrComments = allComments.filter((c) => c.adrId === adrId)

  // Build maps
  const unitStatuses = new Map<string, ReviewStatus>()
  for (const s of adrStatuses) {
    const key = `${s.adrId}:${s.unitPath}`
    unitStatuses.set(key, s.status)
  }

  const unitComments = new Map<string, Comment[]>()
  for (const c of adrComments) {
    const key = `${c.adrId}:${c.unitPath}`
    const existing = unitComments.get(key) || []
    existing.push({
      id: c.id,
      path: c.unitPath,
      author: c.author,
      content: c.content,
      timestamp: c.createdAt,
      replyTo: c.replyTo ?? undefined,
    })
    unitComments.set(key, existing)
  }

  console.log(
    `[adr-review] Hydrated ${unitStatuses.size} statuses, ${adrComments.length} comments for ${adrId}`
  )

  return { unitStatuses, unitComments }
}

/**
 * Hydrate all review state from localStorage.
 */
export function hydrateAll(): HydratedState {
  const allStatuses = getStoredStatuses()
  const allComments = getStoredComments()

  const unitStatuses = new Map<string, ReviewStatus>()
  for (const s of allStatuses) {
    const key = `${s.adrId}:${s.unitPath}`
    unitStatuses.set(key, s.status)
  }

  const unitComments = new Map<string, Comment[]>()
  for (const c of allComments) {
    const key = `${c.adrId}:${c.unitPath}`
    const existing = unitComments.get(key) || []
    existing.push({
      id: c.id,
      path: c.unitPath,
      author: c.author,
      content: c.content,
      timestamp: c.createdAt,
      replyTo: c.replyTo ?? undefined,
    })
    unitComments.set(key, existing)
  }

  console.log(
    `[adr-review] Hydrated ${unitStatuses.size} total statuses, ${unitComments.size} comment threads`
  )

  return { unitStatuses, unitComments }
}

// =============================================================================
// Persist Operations
// =============================================================================

/**
 * Persist unit status change.
 */
export function persistUnitStatus(
  adrId: string,
  unitPath: string,
  status: ReviewStatus,
  reviewedBy?: string
): void {
  const statuses = getStoredStatuses()

  // Find existing or create new
  const idx = statuses.findIndex((s) => s.adrId === adrId && s.unitPath === unitPath)
  const entry: StoredUnitStatus = {
    adrId,
    unitPath,
    status,
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewedBy ?? null,
  }

  if (idx >= 0) {
    statuses[idx] = entry
  } else {
    statuses.push(entry)
  }

  setStoredStatuses(statuses)
  console.log(`[adr-review] Persisted status: ${adrId}:${unitPath} = ${status}`)
}

/**
 * Persist comment.
 */
export function persistComment(adrId: string, unitPath: string, comment: Comment): void {
  const comments = getStoredComments()

  comments.push({
    id: comment.id,
    adrId,
    unitPath,
    author: comment.author,
    content: comment.content,
    createdAt: typeof comment.timestamp === 'string' ? comment.timestamp : new Date().toISOString(),
    replyTo: comment.replyTo ?? null,
  })

  setStoredComments(comments)
  console.log(`[adr-review] Persisted comment: ${comment.id}`)
}

/**
 * Delete a comment.
 */
export function deleteComment(commentId: string): void {
  const comments = getStoredComments()
  const filtered = comments.filter((c) => c.id !== commentId)
  setStoredComments(filtered)
  console.log(`[adr-review] Deleted comment: ${commentId}`)
}

// =============================================================================
// Debug / Export
// =============================================================================

/**
 * Get all stored data for debugging.
 */
export function getStoredData(): { statuses: StoredUnitStatus[]; comments: StoredComment[] } {
  return {
    statuses: getStoredStatuses(),
    comments: getStoredComments(),
  }
}

/**
 * Clear all stored data.
 */
export function clearStoredData(): void {
  localStorage.removeItem(UNIT_STATUSES_KEY)
  localStorage.removeItem(COMMENTS_KEY)
  console.log('[adr-review] Cleared all stored data')
}
