import {
  Bot,
  CircleUser,
  Hammer,
  Terminal,
  type LucideIcon,
} from 'lucide-react'

export type RvnChatSemanticRole = 'operator' | 'agent' | 'system' | 'tool'
export type RvnChatRawRole = RvnChatSemanticRole | 'user' | 'assistant'

const RAW_TO_SEMANTIC: Record<RvnChatRawRole, RvnChatSemanticRole> = {
  operator: 'operator',
  agent: 'agent',
  system: 'system',
  tool: 'tool',
  user: 'operator',
  assistant: 'agent',
}

const ROLE_TO_ICON: Record<RvnChatSemanticRole, LucideIcon> = {
  operator: CircleUser,
  agent: Bot,
  system: Terminal,
  tool: Hammer,
}

export function normalizeRvnChatRole(role: RvnChatRawRole): RvnChatSemanticRole {
  return RAW_TO_SEMANTIC[role]
}

export function getRvnChatRoleIcon(role: RvnChatRawRole): LucideIcon {
  return ROLE_TO_ICON[normalizeRvnChatRole(role)]
}

export const RVN_CHAT_ROLE_ICON_MAP = ROLE_TO_ICON
