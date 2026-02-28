/**
 * Status banner types.
 *
 * @module morphchat/components/status-banner/types
 */

export type BannerTone = 'info' | 'warn' | 'error'

export interface StatusRowLike {
  readonly id: string
  readonly tone: BannerTone
  readonly text: string
  readonly code?: string
  readonly details?: unknown
  readonly source?: 'mock' | 'harness' | 'surface'
}
