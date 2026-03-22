export const CHAT_ROLE_ICON_SIZE = 16 as const
export const CHAT_UTILITY_ICON_SIZE = 12 as const
export const CHAT_ICON_STROKE_WIDTH = 2 as const

export interface ChatIconPrecision {
  readonly size: number
  readonly strokeWidth: number
}

export const CHAT_ICON_PRECISION: Readonly<{
  role: ChatIconPrecision
  utility: ChatIconPrecision
}> = {
  role: {
    size: CHAT_ROLE_ICON_SIZE,
    strokeWidth: CHAT_ICON_STROKE_WIDTH,
  },
  utility: {
    size: CHAT_UTILITY_ICON_SIZE,
    strokeWidth: CHAT_ICON_STROKE_WIDTH,
  },
}

export type ChatIconPrecisionKind = keyof typeof CHAT_ICON_PRECISION

export function getChatIconPrecision(kind: ChatIconPrecisionKind): ChatIconPrecision {
  return CHAT_ICON_PRECISION[kind]
}
