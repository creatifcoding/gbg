import type { CSSProperties, ReactNode } from 'react'
import { space, type Space } from '../tokens'

export interface FlexProps {
  children: ReactNode
  direction?: 'row' | 'column'
  gap?: Space
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
  wrap?: boolean
  inline?: boolean
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: CSSProperties
}

const justifyMap = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around' } as const
const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline' } as const

export function Flex({
  children,
  direction = 'column',
  gap,
  align,
  justify,
  wrap,
  inline,
  as: Tag = 'div',
  className,
  style: styleProp,
}: FlexProps) {
  const style: CSSProperties = {
    display: inline ? 'inline-flex' : 'flex',
    flexDirection: direction,
    gap: gap !== undefined ? space[gap] : undefined,
    alignItems: align ? alignMap[align] : undefined,
    justifyContent: justify ? justifyMap[justify] : undefined,
    flexWrap: wrap ? 'wrap' : undefined,
    ...styleProp,
  }

  return <Tag className={className} style={style}>{children}</Tag>
}
