import type { CSSProperties } from 'react'
import { color, radius } from '../tokens'

export interface SkeletonProps {
  width?: string | number
  height?: string | number
  variant?: 'text' | 'rect' | 'circle'
  lines?: number
}

const shimmerKeyframes = `
  @keyframes sios-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`

export function Skeleton({ width, height, variant = 'rect', lines }: SkeletonProps) {
  if (variant === 'text' && lines && lines > 1) {
    return (
      <>
        <style>{shimmerKeyframes}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width }}>
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} variant="text" width={i === lines - 1 ? '70%' : '100%'} height={height} />
          ))}
        </div>
      </>
    )
  }

  const borderR = variant === 'circle' ? '50%' : variant === 'text' ? radius.sm : radius.md

  const style: CSSProperties = {
    width: width ?? (variant === 'circle' ? 32 : '100%'),
    height: height ?? (variant === 'text' ? 14 : variant === 'circle' ? 32 : 48),
    borderRadius: borderR,
    background: `linear-gradient(90deg, ${color.surfaceAlt} 25%, ${color.surfaceHover} 50%, ${color.surfaceAlt} 75%)`,
    backgroundSize: '200% 100%',
    animation: 'sios-shimmer 1.5s ease-in-out infinite',
  }

  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div style={style} />
    </>
  )
}
