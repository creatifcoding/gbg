import type { CSSProperties, ReactNode } from 'react'
import { space, type Space } from '../tokens'

export interface GridProps {
  children: ReactNode
  cols: number
  gap?: Space
  colGap?: Space
  rowGap?: Space
  className?: string
  style?: CSSProperties
}

export function Grid({ children, cols, gap, colGap, rowGap, className, style: styleProp }: GridProps) {
  const style: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: gap !== undefined ? space[gap] : undefined,
    columnGap: colGap !== undefined ? space[colGap] : undefined,
    rowGap: rowGap !== undefined ? space[rowGap] : undefined,
    ...styleProp,
  }

  return <div className={className} style={style}>{children}</div>
}
