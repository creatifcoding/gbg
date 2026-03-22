/**
 * TuftianSegment — Sparkline + latency + full stats.
 *
 * Reveals rightward via max-width when connected + sparkline/full mode.
 * Contains the blur defocus transition.
 *
 * @module connection-capsule/tuftian-segment
 */

import { memo } from 'react'
import { REVEAL_MS, REVEAL_EASE, BLUR_MS } from './constants'
import { LatencySparkline } from './latency-sparkline'
import type { ViewMode } from './view-modes'

interface TuftianSegmentProps {
  show: boolean
  blurring: boolean
  viewMode: ViewMode
  latencyHistory: readonly number[]
  latencyMs?: number
  smartColor: string
  endpoint: string | null
  uptime: string | null
}

export const TuftianSegment = memo(function TuftianSegment({
  show, blurring, viewMode, latencyHistory, latencyMs, smartColor, endpoint, uptime,
}: TuftianSegmentProps) {
  return (
    <div
      className="flex items-center overflow-hidden"
      style={{
        maxWidth: show ? 300 : 0,
        opacity: show ? 1 : 0,
        filter: blurring ? 'blur(3px)' : 'blur(0)',
        transition: [
          `max-width ${REVEAL_MS}ms ${REVEAL_EASE}`,
          `opacity ${blurring ? BLUR_MS : REVEAL_MS}ms ease-out`,
          `filter ${BLUR_MS}ms ease-out`,
        ].join(', '),
      }}
    >
      {/* Sparkline (modes sparkline + full) */}
      {latencyHistory.length >= 2 && (
        <LatencySparkline
          readings={latencyHistory}
          color={smartColor}
        />
      )}

      {/* Current latency */}
      {latencyMs != null && (
        <span
          className="font-mono ml-1.5 whitespace-nowrap"
          style={{ fontSize: '10px', color: '#525252' }}
        >
          {latencyMs}ms
        </span>
      )}

      {/* Full stats (mode full only) */}
      {viewMode === 'full' && (
        <>
          {endpoint && (
            <>
              <span style={{ fontSize: '10px', color: '#262626', margin: '0 3px' }}>·</span>
              <span className="font-mono whitespace-nowrap" style={{ fontSize: '10px', color: '#525252' }}>{endpoint}</span>
            </>
          )}
          {uptime && (
            <>
              <span style={{ fontSize: '10px', color: '#262626', margin: '0 3px' }}>·</span>
              <span className="font-mono whitespace-nowrap" style={{ fontSize: '10px', color: '#525252' }}>{uptime}</span>
            </>
          )}
        </>
      )}

      {/* Right padding */}
      <div className="w-2" />
    </div>
  )
})
