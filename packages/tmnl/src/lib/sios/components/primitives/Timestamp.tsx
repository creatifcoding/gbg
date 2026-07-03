import type { CSSProperties } from 'react'
import { font, fontSize as fs, color } from '../tokens'

export interface TimestampProps {
  date: Date
  variant?: 'time' | 'date' | 'relative' | 'datetime'
  mono?: boolean
}

function formatTimestamp(d: Date, variant: string): string {
  switch (variant) {
    case 'time': return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    case 'date': return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case 'datetime': return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}`
    case 'relative': {
      const diff = Date.now() - d.getTime()
      if (diff < 60000) return 'just now'
      if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
      return `${Math.floor(diff / 86400000)}d ago`
    }
    default: return d.toISOString()
  }
}

export function Timestamp({ date, variant = 'time', mono = true }: TimestampProps) {
  const style: CSSProperties = {
    fontFamily: mono ? font.mono : font.sans,
    fontSize: fs.sm,
    color: color.textDim,
    fontVariantNumeric: 'tabular-nums',
  }

  return <span style={style}>{formatTimestamp(date, variant)}</span>
}
