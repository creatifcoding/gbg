import type { CSSProperties } from 'react'
import { type SemanticColor, semanticColorValue } from '../tokens'

export interface DotProps {
  color: SemanticColor
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
}

const sizeMap = { sm: 6, md: 8, lg: 10 } as const

export function Dot({ color: colorProp, size = 'md', pulse }: DotProps) {
  const px = sizeMap[size]
  const c = semanticColorValue[colorProp]

  const style: CSSProperties = {
    width: px,
    height: px,
    borderRadius: '50%',
    backgroundColor: c,
    flexShrink: 0,
    display: 'inline-block',
    animation: pulse ? 'sios-dot-pulse 2s ease-in-out infinite' : undefined,
  }

  return (
    <>
      {pulse && (
        <style>{`
          @keyframes sios-dot-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.4); opacity: 0.6; }
          }
        `}</style>
      )}
      <span style={style} />
    </>
  )
}
