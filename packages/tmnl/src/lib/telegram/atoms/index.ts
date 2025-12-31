/**
 * Telegram Agent Atoms
 *
 * Following cursor architecture patterns:
 * - Module-level atoms (stable references)
 * - stx pattern: XState actor → snapshotAtom → derived atoms
 * - Synchronous operations via registry.set()
 * - Atom-as-State doctrine (no Effect.Ref in services)
 */

import { Atom, Registry } from '@effect-atom/atom';
import {
  telegramActor,
  getTelegramState,
  isTelegramConnected,
  getTelegramError,
  getChatStatus,
  type TelegramMachineSnapshot,
} from '../machines/telegram-machine';
import type { TelegramMessage, TelegramChatState, BotStatus } from '../schemas/message';

// ============================================================================
// Registry (Module-Level Singleton)
// ============================================================================

export const telegramRegistry = Registry.make();

// ============================================================================
// XState Bridge (stx pattern)
// ============================================================================

/**
 * Bridge atom: XState snapshot → effect-atom
 * This is the SINGLE source of truth for machine state
 */
export const telegramSnapshotAtom = Atom.make<TelegramMachineSnapshot>(
  telegramActor.getSnapshot()
);

// Subscribe XState → Atom (runs once at module load)
telegramActor.subscribe((snapshot) => {
  telegramRegistry.set(telegramSnapshotAtom, snapshot);
});

// Start the actor
telegramActor.start();

// ============================================================================
// Derived Atoms (from snapshot)
// ============================================================================

/**
 * Current machine state as string
 */
export const connectionStateAtom = Atom.make((get) =>
  getTelegramState(get(telegramSnapshotAtom))
);

/**
 * Boolean: is bot connected?
 */
export const isConnectedAtom = Atom.make((get) =>
  isTelegramConnected(get(telegramSnapshotAtom))
);

/**
 * Current error message (if any)
 */
export const errorMessageAtom = Atom.make((get) =>
  getTelegramError(get(telegramSnapshotAtom))
);

/**
 * Active chat IDs from machine context
 */
export const activeChatIdsAtom = Atom.make((get) =>
  get(telegramSnapshotAtom).context.activeChatIds
);

// ============================================================================
// Message State Atoms
// ============================================================================

/**
 * All messages by chatId
 * Structure: Record<chatId, TelegramMessage[]>
 */
export const messagesByChatAtom = Atom.make<Record<number, TelegramMessage[]>>({});

/**
 * Chat state by chatId
 * Structure: Record<chatId, TelegramChatState>
 */
export const chatStatesByChatAtom = Atom.make<Record<number, TelegramChatState>>({});

/**
 * Bot status per chat
 */
export const botStatusByChatAtom = Atom.make<Record<number, BotStatus>>({});

// ============================================================================
// Utility Atoms (for specific chats)
// ============================================================================

/**
 * Get messages for a specific chat
 */
export const messagesForChatAtom = (chatId: number) =>
  Atom.make((get) => get(messagesByChatAtom)[chatId] ?? []);

/**
 * Get bot status for a specific chat
 */
export const botStatusForChatAtom = (chatId: number) =>
  Atom.make((get) => get(botStatusByChatAtom)[chatId] ?? ('idle' as BotStatus));

/**
 * Get chat status from XState
 */
export const chatStatusFromMachineAtom = (chatId: number) =>
  Atom.make((get) => getChatStatus(get(telegramSnapshotAtom), chatId));

// ============================================================================
// Operations (Synchronous Registry Mutations)
// ============================================================================

export const telegramOps = {
  /**
   * Add a message to a chat
   */
  addMessage: (message: TelegramMessage) => {
    const current = telegramRegistry.get(messagesByChatAtom);
    const chatMessages = current[message.chatId] ?? [];
    telegramRegistry.set(messagesByChatAtom, {
      ...current,
      [message.chatId]: [...chatMessages, message],
    });
  },

  /**
   * Clear messages for a chat
   */
  clearChat: (chatId: number) => {
    const current = telegramRegistry.get(messagesByChatAtom);
    telegramRegistry.set(messagesByChatAtom, {
      ...current,
      [chatId]: [],
    });
  },

  /**
   * Set bot status for a chat
   */
  setBotStatus: (chatId: number, status: BotStatus) => {
    const current = telegramRegistry.get(botStatusByChatAtom);
    telegramRegistry.set(botStatusByChatAtom, {
      ...current,
      [chatId]: status,
    });
  },

  /**
   * Update chat state
   */
  updateChatState: (chatId: number, state: Partial<TelegramChatState>) => {
    const current = telegramRegistry.get(chatStatesByChatAtom);
    const existing = current[chatId] ?? {
      chatId,
      messages: [],
      lastActivity: Date.now(),
    };
    telegramRegistry.set(chatStatesByChatAtom, {
      ...current,
      [chatId]: { ...existing, ...state, lastActivity: Date.now() },
    });
  },
};

// ============================================================================
// Actor Operations (Send XState Events)
// ============================================================================

export const telegramActorOps = {
  connect: () => telegramActor.send({ type: 'CONNECT' }),
  disconnect: () => telegramActor.send({ type: 'DISCONNECT' }),
  connectionEstablished: () => telegramActor.send({ type: 'CONNECTION_ESTABLISHED' }),
  connectionFailed: (error: string) =>
    telegramActor.send({ type: 'CONNECTION_FAILED', error }),
  messageReceived: (chatId: number) =>
    telegramActor.send({ type: 'MESSAGE_RECEIVED', chatId }),
  aiThinking: (chatId: number) => telegramActor.send({ type: 'AI_THINKING', chatId }),
  aiStreaming: (chatId: number) => telegramActor.send({ type: 'AI_STREAMING', chatId }),
  aiComplete: (chatId: number) => telegramActor.send({ type: 'AI_COMPLETE', chatId }),
  error: (error: string) => telegramActor.send({ type: 'ERROR', error }),
  retry: () => telegramActor.send({ type: 'RETRY' }),
  clearError: () => telegramActor.send({ type: 'CLEAR_ERROR' }),
};
