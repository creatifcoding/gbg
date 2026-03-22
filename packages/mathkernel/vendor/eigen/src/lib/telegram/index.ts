/**
 * Telegram Agent Module
 *
 * Interactive AI agent via Telegram, following cursor architecture patterns.
 *
 * @example
 * ```typescript
 * // Start the server
 * bun run scripts/telegram-agent.ts
 *
 * // Or import components
 * import { TelegramAgent, telegramOps, telegramActorOps } from '@/lib/telegram'
 * ```
 */

// Schemas
export * from './schemas/message';

// Machines
export {
  telegramMachine,
  telegramActor,
  getTelegramState,
  isTelegramConnected,
  getTelegramError,
  getChatStatus,
  type TelegramMachineSnapshot,
  type TelegramMachineContext,
} from './machines/telegram-machine';

// Services
export {
  TelegramAgent,
  TelegramAgentLive,
  TelegramAgentDefault,
  TelegramAgentConfigTag,
  type TelegramAgentShape,
  type TelegramAgentConfig,
} from './services/TelegramAgent';

// Atoms
export {
  // Registry
  telegramRegistry,
  // Snapshot (stx bridge)
  telegramSnapshotAtom,
  // Derived atoms
  connectionStateAtom,
  isConnectedAtom,
  errorMessageAtom,
  activeChatIdsAtom,
  // Message atoms
  messagesByChatAtom,
  chatStatesByChatAtom,
  botStatusByChatAtom,
  // Utility atoms
  messagesForChatAtom,
  botStatusForChatAtom,
  chatStatusFromMachineAtom,
  // Operations
  telegramOps,
  telegramActorOps,
} from './atoms';
