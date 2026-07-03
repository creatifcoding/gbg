import type { CSSProperties } from 'react'
import { color, space, type Space, type SemanticColor, semanticColorValue } from '../tokens'

export interface DividerProps {
  vertical?: boolean
  color?: 'border' | 'borderBright' | SemanticColor
  spacing?: Space
  accent?: boolean
}

const colorMap: Record<string, string> = { border: color.border, borderBright: color.borderBright }

export function Divider({ vertical, color: colorProp = 'border', spacing, accent }: DividerProps) {
  const resolvedColor = colorMap[colorProp] ?? semanticColorValue[colorProp as SemanticColor] ?? color.border

  if (accent) {
    const style: CSSProperties = {
      width: '80px',
      height: '2px',
      background: resolvedColor,
      margin: spacing !== undefined ? `${space[spacing]} auto` : '0 auto',
      border: 'none',
    }
    return <hr style={style} />
  }

  const style: CSSProperties = vertical
    ? { width: '1px', alignSelf: 'stretch', background: resolvedColor, border: 'none', margin: spacing !== undefined ? `0 ${space[spacing]}` : undefined }
    : { height: '1px', width: '100%', background: resolvedColor, border: 'none', margin: spacing !== undefined ? `${space[spacing]} 0` : undefined }

  return <hr style={style} />
}
