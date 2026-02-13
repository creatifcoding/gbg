export const RVN_CHAT_ROLE_ICON_SIZE = 16 as const
export const RVN_CHAT_UTILITY_ICON_SIZE = 12 as const
export const RVN_CHAT_ICON_STROKE_WIDTH = 2 as const

export interface RvnChatIconPrecision {
  readonly size: number
  readonly strokeWidth: number
}

export const RVN_CHAT_ICON_PRECISION: Readonly<{
  role: RvnChatIconPrecision
  utility: RvnChatIconPrecision
}> = {
  role: {
    size: RVN_CHAT_ROLE_ICON_SIZE,
    strokeWidth: RVN_CHAT_ICON_STROKE_WIDTH,
  },
  utility: {
    size: RVN_CHAT_UTILITY_ICON_SIZE,
    strokeWidth: RVN_CHAT_ICON_STROKE_WIDTH,
  },
}

export type RvnChatIconPrecisionKind = keyof typeof RVN_CHAT_ICON_PRECISION

export function getRvnChatIconPrecision(kind: RvnChatIconPrecisionKind): RvnChatIconPrecision {
  return RVN_CHAT_ICON_PRECISION[kind]
}
