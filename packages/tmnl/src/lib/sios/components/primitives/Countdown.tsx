import { useEffect, useState, type CSSProperties } from 'react'
import { font, fontSize as fs, fontWeight as fw, type FontSize, type SemanticColor, semanticColorValue, color } from '../tokens'

export interface CountdownThreshold {
  remainingMs: number
  color: SemanticColor
}

export interface CountdownProps {
  deadline: Date
  thresholds?: CountdownThreshold[]
  onExpire?: () => void
  format?: 'hms' | 'dhms'
  size?: FontSize
  expired?: { label: string; color: SemanticColor }
}

const defaultThresholds: CountdownThreshold[] = [
  { remainingMs: 7200000, color: 'green' },   // > 2h green
  { remainingMs: 3600000, color: 'amber' },    // 1-2h amber
  { remainingMs: 0, color: 'red' },             // < 1h red
]

function formatTime(ms: number, fmt: 'hms' | 'dhms'): string {
  if (ms <= 0) return '00:00:00'
  const s = Math.floor(ms / 1000) % 60
  const m = Math.floor(ms / 60000) % 60
  const h = Math.floor(ms / 3600000)
  if (fmt === 'dhms' && h >= 24) {
    const d = Math.floor(h / 24)
    return `${d}d ${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function resolveColor(remainingMs: number, thresholds: CountdownThreshold[]): SemanticColor {
  const sorted = [...thresholds].sort((a, b) => b.remainingMs - a.remainingMs)
  for (const t of sorted) {
    if (remainingMs >= t.remainingMs) return t.color
  }
  return sorted[sorted.length - 1]?.color ?? 'red'
}

export function Countdown({
  deadline,
  thresholds = defaultThresholds,
  onExpire,
  format = 'hms',
  size = 'xl',
  expired = { label: 'OVERDUE', color: 'red' },
}: CountdownProps) {
  const [remaining, setRemaining] = useState(() => deadline.getTime() - Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      const r = deadline.getTime() - Date.now()
      setRemaining(r)
      if (r <= 0) {
        clearInterval(id)
        onExpire?.()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [deadline, onExpire])

  const isExpired = remaining <= 0
  const activeColor = isExpired ? expired.color : resolveColor(remaining, thresholds)

  const style: CSSProperties = {
    fontFamily: font.mono,
    fontSize: fs[size],
    fontWeight: fw.bold,
    color: semanticColorValue[activeColor],
    fontVariantNumeric: 'tabular-nums',
  }

  if (isExpired) {
    return <span style={{ ...style, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{expired.label}</span>
  }

  return <span style={style}>{formatTime(remaining, format)}</span>
}
