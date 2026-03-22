import {
  Bot,
  CircleUser,
  Hammer,
  Terminal,
  type LucideIcon,
} from 'lucide-react'

export type ChatSemanticRole = 'operator' | 'agent' | 'system' | 'tool'
export type ChatRawRole = ChatSemanticRole | 'user' | 'assistant'

const RAW_TO_SEMANTIC: Record<ChatRawRole, ChatSemanticRole> = {
  operator: 'operator',
  agent: 'agent',
  system: 'system',
  tool: 'tool',
  user: 'operator',
  assistant: 'agent',
}

const ROLE_TO_ICON: Record<ChatSemanticRole, LucideIcon> = {
  operator: CircleUser,
  agent: Bot,
  system: Terminal,
  tool: Hammer,
}

export function normalizeChatRole(role: ChatRawRole): ChatSemanticRole {
  return RAW_TO_SEMANTIC[role]
}

export function getChatRoleIcon(role: ChatRawRole): LucideIcon {
  return ROLE_TO_ICON[normalizeChatRole(role)]
}

export const CHAT_ROLE_ICON_MAP = ROLE_TO_ICON
