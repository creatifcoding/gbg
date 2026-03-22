/**
 * Status banner types.
 *
 * @module morphchat/components/status-banner/types
 */

import type { HarnessErrorCode, ErrorSeverity } from '@/lib/harness/error-codes'

/** Banner tone — the visible subset of ErrorSeverity (excludes 'silent'). */
export type BannerTone = Exclude<ErrorSeverity, 'silent'>

export interface StatusRowLike {
  readonly id: string
  readonly tone: BannerTone
  readonly text: string
  readonly code?: HarnessErrorCode | (string & {})
  readonly details?: unknown
  readonly source?: 'mock' | 'harness' | 'surface'
}
