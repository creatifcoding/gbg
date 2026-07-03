/**
 * NetworkStatus — Throughput sparkline + signal indicator.
 *
 * Rolling SVG area chart with phosphor fill gradient.
 * Animated bars + smooth path transitions via motion.dev.
 * Vantablack: content emerges from pure void.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'motion/react'
import { V } from './BarLayout'

// ─── Rolling Sample Buffer ──────────────────────────────────────────────────

function useThroughputSamples(maxSamples = 20) {
  const [samples, setSamples] = useState<number[]>(() =>
    Array(maxSamples).fill(0)
  )

  useEffect(() => {
    const id = setInterval(() => {
      setSamples((prev) => {
        const next = [...prev.slice(1)]
        // Organic throughput simulation — bursts + baseline
        const base = 0.2 + Math.random() * 0.35
        const burst = Math.random() > 0.82 ? Math.random() * 0.45 : 0
        next.push(Math.min(1, base + burst))
        return next
      })
    }, 700)
    return () => clearInterval(id)
  }, [maxSamples])

  return samples
}

// ─── SVG Area Sparkline ─────────────────────────────────────────────────────

function AreaSparkline({ samples }: { samples: number[] }) {
  const w = 32
  const h = 24
  const pad = 1

  // Build smooth SVG path from samples
  const { linePath, areaPath } = useMemo(() => {
    const n = samples.length
    if (n < 2) return { linePath: '', areaPath: '' }

    const xStep = (w - pad * 2) / (n - 1)
    const points = samples.map((v, i) => ({
      x: pad + i * xStep,
      y: pad + (1 - v) * (h - pad * 2),
    }))

    // Catmull-Rom to cubic bezier for smooth curves
    const lineSegments: string[] = [`M ${points[0].x} ${points[0].y}`]
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(points.length - 1, i + 2)]

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      lineSegments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`)
    }

    const line = lineSegments.join(' ')
    const area = `${line} L ${points[n - 1].x} ${h} L ${points[0].x} ${h} Z`

    return { linePath: line, areaPath: area }
  }, [samples, w, h])

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ overflow: 'hidden' }}
    >
      <defs>
        {/* Phosphor gradient fill — fades to void at bottom */}
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={V.phosphor} stopOpacity={0.18} />
          <stop offset="60%" stopColor={V.phosphor} stopOpacity={0.06} />
          <stop offset="100%" stopColor={V.phosphor} stopOpacity={0} />
        </linearGradient>
        {/* Glow gradient for the stroke */}
        <linearGradient id="spark-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={V.phosphorDim} stopOpacity={0.3} />
          <stop offset="70%" stopColor={V.phosphor} stopOpacity={0.7} />
          <stop offset="100%" stopColor={V.phosphor} stopOpacity={1} />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <motion.path
        d={areaPath}
        fill="url(#spark-fill)"
        initial={false}
        animate={{ d: areaPath }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {/* Stroke line */}
      <motion.path
        d={linePath}
        fill="none"
        stroke="url(#spark-stroke)"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ d: linePath }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {/* Leading dot — the live point */}
      {samples.length > 1 && (() => {
        const xStep = (w - 2) / (samples.length - 1)
        const lastX = 1 + (samples.length - 1) * xStep
        const lastY = 1 + (1 - samples[samples.length - 1]) * (h - 2)
        return (
          <motion.circle
            cx={lastX}
            cy={lastY}
            r={1.5}
            fill={V.phosphor}
            initial={false}
            animate={{ cx: lastX, cy: lastY }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* Pulse on the live point */}
            <animate
              attributeName="r"
              values={`${1.5};${2.5};${1.5}`}
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="1;0.5;1"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </motion.circle>
        )
      })()}
    </svg>
  )
}

// ─── Signal Bars ────────────────────────────────────────────────────────────

function SignalBars({ strength }: { strength: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 1.5,
      height: 12,
    }}>
      {[0.25, 0.5, 0.75, 1].map((threshold, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{
            delay: 0.35 + i * 0.07,
            type: 'spring',
            stiffness: 450,
            damping: 22,
          }}
          style={{
            width: 2.5,
            height: 3 + i * 2.5,
            borderRadius: 0.8,
            background: strength >= threshold ? V.phosphor : V.inkFaint,
            transformOrigin: 'bottom',
            transition: 'background 0.4s ease',
          }}
        />
      ))}
    </div>
  )
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function NetworkStatus() {
  const samples = useThroughputSamples(20)
  const [strength] = useState(0.85)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.45, duration: 0.5 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <SignalBars strength={strength} />
      <AreaSparkline samples={samples} />

      <span style={{
        fontSize: V.xs,
        fontWeight: 600,
        color: V.inkFaint,
        letterSpacing: '0.15em',
        lineHeight: 1,
      }}>
        LNK
      </span>
    </motion.div>
  )
}
