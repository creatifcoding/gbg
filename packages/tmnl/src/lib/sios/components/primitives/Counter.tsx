import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { font, fontSize as fs, fontWeight as fw, type FontSize, type SemanticColor, semanticColorValue, color } from '../tokens'

export interface CounterProps {
  value: number
  prefix?: string
  suffix?: string
  format?: 'integer' | 'decimal' | 'currency'
  decimals?: number
  duration?: number
  color?: SemanticColor | 'text'
  size?: FontSize
  mono?: boolean
}

function formatValue(v: number, format: string, decimals: number): string {
  switch (format) {
    case 'currency': return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    case 'decimal': return v.toFixed(decimals)
    default: return Math.round(v).toLocaleString()
  }
}

export function Counter({
  value,
  prefix = '',
  suffix = '',
  format = 'integer',
  decimals = 2,
  duration: dur = 600,
  color: colorProp = 'text',
  size = '2xl',
  mono = true,
}: CounterProps) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const start = prevRef.current
    const end = value
    prevRef.current = value
    if (start === end) return

    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / dur, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(start + (end - start) * eased)
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, dur])

  const c = colorProp === 'text' ? color.text : semanticColorValue[colorProp]

  const style: CSSProperties = {
    fontFamily: mono ? font.mono : font.sans,
    fontSize: fs[size],
    fontWeight: fw.bold,
    color: c,
    tabularNums: 'tabular-nums' as any,
    fontVariantNumeric: 'tabular-nums',
  }

  return <span style={style}>{prefix}{formatValue(display, format, decimals)}{suffix}</span>
}
