import type { ConductorChatMessage } from './ConductorAgentChatService'
import type { ChatExpansionLevel } from './chat-surface-types'
import type { RvnConductorChatMode } from './RvnConductorChat'

export type RvnHarnessChatMode = 'terminal' | 'ai'
export type RvnHarnessThinkingLevel = 'none' | 'low' | 'med' | 'high'

export type RvnHarnessConnectionState =
  | 'offline'
  | 'connecting'
  | 'online'
  | 'reconnecting'
  | 'resyncing'

export type RvnHarnessMessageLifecycleState =
  | 'idle'
  | 'typing'
  | 'send_accepted'
  | 'assistant_streaming'
  | 'assistant_finalized'
  | 'error'

export interface RvnHarnessChatAgentOption {
  id: string
  name: string
  role: string
  model: string
  status: string
}

export interface RvnHarnessSlashCommand {
  id: string
  command: string
  description: string
}

export interface RvnHarnessMentionEntity {
  id: string
  label: string
  subtitle: string
}

export interface RvnHarnessChatStatusRow {
  id: string
  tone: 'info' | 'warn' | 'error'
  text: string
}

export interface RvnHarnessChatSubmit {
  text: string
  mode: RvnHarnessChatMode
  thinkingLevel: RvnHarnessThinkingLevel
  targetAgentId: string
  mentions: ReadonlyArray<string>
  voiceOriginated: boolean
}

export interface RvnHarnessChatSurfaceProps {
  nodeId: string
  title: string
  agents: ReadonlyArray<RvnHarnessChatAgentOption>
  activeAgentId: string
  onActiveAgentChange: (agentId: string) => void
  messages: ReadonlyArray<ConductorChatMessage>
  slashCommands?: ReadonlyArray<RvnHarnessSlashCommand>
  mentionEntities?: ReadonlyArray<RvnHarnessMentionEntity>
  statusRows?: ReadonlyArray<RvnHarnessChatStatusRow>
  streamingMessageId?: string | null
  draft?: string
  onDraftChange?: (next: string) => void
  threadScrollTop?: number
  onThreadScrollTopChange?: (next: number) => void
  expansionLevel?: ChatExpansionLevel
  onToggleExpansion?: (next: ChatExpansionLevel, targetAgentId: string) => void
  connectionState?: RvnHarnessConnectionState
  messageState?: RvnHarnessMessageLifecycleState
  sessionLabel?: string
  quickActions?: ReadonlyArray<string>
  disabled?: boolean
  onSend: (payload: RvnHarnessChatSubmit) => void | Promise<void>
  onPause?: (targetAgentId: string) => void | Promise<void>
  onReconnect?: (targetAgentId: string) => void | Promise<void>
  onResetSession?: (targetAgentId: string) => void | Promise<void>
  onExitChat?: (targetAgentId: string) => void | Promise<void>
  onBreakout?: (message: ConductorChatMessage) => void
}

export const DEFAULT_RVN_HARNESS_SLASH_COMMANDS: ReadonlyArray<RvnHarnessSlashCommand> = [
  { id: 'status', command: '/status', description: 'System status overview' },
  { id: 'status-wo', command: '/status:wo', description: 'Work order status summary' },
  { id: 'alarm', command: '/alarm', description: 'Active alarms list' },
  { id: 'escalate', command: '/escalate', description: 'Escalate work order' },
  { id: 'navigate', command: '/navigate', description: 'Navigate to location' },
]

export const DEFAULT_RVN_HARNESS_QUICK_ACTIONS = ['/status', '/alarm', '@WO-4821']

export interface RvnHarnessSuggestionViewModel {
  key: string
  title: string
  subtitle: string
  replacement: string
  kind: 'slash' | 'mention'
}

export interface RvnHarnessMessageViewModel {
  id: string
  role: ConductorChatMessage['role']
  atLabel: string
  text: string
  streaming: boolean
}

export interface RvnHarnessChatViewModel {
  rvnMode: RvnConductorChatMode
  shouldShowQuickActions: boolean
  shouldShowReconnectAction: boolean
  activeAgent: RvnHarnessChatAgentOption | null
  suggestions: ReadonlyArray<RvnHarnessSuggestionViewModel>
  messages: ReadonlyArray<RvnHarnessMessageViewModel>
}

export function mapExpansionLevelToRvnMode(expansionLevel: ChatExpansionLevel): RvnConductorChatMode {
  return expansionLevel === 'l3' ? 'chat_full' : 'expanded'
}

export function mapRvnModeToExpansionLevel(mode: RvnConductorChatMode): ChatExpansionLevel {
  return mode === 'chat_full' ? 'l3' : 'l2'
}

export function extractMentions(text: string): ReadonlyArray<string> {
  const matches = text.match(/@[A-Za-z0-9:_-]+/g)
  if (!matches) return []
  return matches.map((token) => token.slice(1))
}

export function resolveChatSuggestions(params: {
  draft: string
  slashCommands: ReadonlyArray<RvnHarnessSlashCommand>
  mentionEntities: ReadonlyArray<RvnHarnessMentionEntity>
}): ReadonlyArray<RvnHarnessSuggestionViewModel> {
  const { draft, slashCommands, mentionEntities } = params
  const trimmed = draft.trim()

  if (trimmed.startsWith('/')) {
    const slashQuery = trimmed.slice(1).toLowerCase()
    const slashResults = slashQuery.length === 0
      ? slashCommands.slice(0, 6)
      : slashCommands
          .filter((entry) => {
            return (
              entry.command.toLowerCase().includes(slashQuery) ||
              entry.description.toLowerCase().includes(slashQuery)
            )
          })
          .slice(0, 8)

    return slashResults.map((entry) => ({
      key: entry.id,
      title: entry.command,
      subtitle: entry.description,
      replacement: `${entry.command} `,
      kind: 'slash',
    }))
  }

  const mentionMatch = draft.match(/@([A-Za-z0-9:_-]*)$/)
  if (!mentionMatch) {
    return []
  }

  const mentionQuery = mentionMatch[1].toLowerCase()
  const mentionResults = mentionQuery.length === 0
    ? mentionEntities.slice(0, 6)
    : mentionEntities
        .filter((entity) => {
          return (
            entity.id.toLowerCase().includes(mentionQuery) ||
            entity.label.toLowerCase().includes(mentionQuery)
          )
        })
        .slice(0, 8)

  return mentionResults.map((entity) => ({
    key: entity.id,
    title: `@${entity.id}`,
    subtitle: entity.subtitle,
    replacement: draft.replace(/@[A-Za-z0-9:_-]*$/, `@${entity.id} `),
    kind: 'mention',
  }))
}

export function toRvnHarnessChatViewModel(params: {
  expansionLevel: ChatExpansionLevel
  draft: string
  statusRows: ReadonlyArray<RvnHarnessChatStatusRow>
  agents: ReadonlyArray<RvnHarnessChatAgentOption>
  activeAgentId: string
  messages: ReadonlyArray<ConductorChatMessage>
  streamingMessageId: string | null
  slashCommands: ReadonlyArray<RvnHarnessSlashCommand>
  mentionEntities: ReadonlyArray<RvnHarnessMentionEntity>
}): RvnHarnessChatViewModel {
  const {
    expansionLevel,
    draft,
    statusRows,
    agents,
    activeAgentId,
    messages,
    streamingMessageId,
    slashCommands,
    mentionEntities,
  } = params

  const activeAgent = agents.find((agent) => agent.id === activeAgentId) ?? agents[0] ?? null

  return {
    rvnMode: mapExpansionLevelToRvnMode(expansionLevel),
    shouldShowQuickActions: draft.trim().length === 0,
    shouldShowReconnectAction: statusRows.some((row) => row.tone === 'warn' || row.tone === 'error'),
    activeAgent,
    suggestions: resolveChatSuggestions({ draft, slashCommands, mentionEntities }),
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      atLabel: new Date(message.at).toLocaleTimeString(),
      text: message.text,
      streaming: message.role === 'assistant' && streamingMessageId === message.id,
    })),
  }
}
