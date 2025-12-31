/**
 * XState Machine for Telegram Bot Lifecycle
 *
 * States:
 * - disconnected: Bot not running
 * - connecting: Bot starting up
 * - connected: Bot active and listening
 * - processing: Handling incoming message
 * - error: Error state with recovery
 *
 * Following cursor-machine.ts patterns (stx bridge)
 */

import { setup, createActor, type SnapshotFrom } from 'xstate';

// ============================================================================
// Context Type
// ============================================================================

export interface TelegramMachineContext {
  /** Active chat sessions by chatId */
  activeChatIds: number[];
  /** Current error message if any */
  errorMessage: string | null;
  /** Bot status per chat */
  chatStatuses: Record<number, 'idle' | 'thinking' | 'streaming'>;
  /** Message counts per chat */
  messageCounts: Record<number, number>;
}

// ============================================================================
// Event Types
// ============================================================================

type TelegramMachineEvent =
  | { type: 'CONNECT' }
  | { type: 'DISCONNECT' }
  | { type: 'CONNECTION_ESTABLISHED' }
  | { type: 'CONNECTION_FAILED'; error: string }
  | { type: 'MESSAGE_RECEIVED'; chatId: number }
  | { type: 'AI_THINKING'; chatId: number }
  | { type: 'AI_STREAMING'; chatId: number }
  | { type: 'AI_COMPLETE'; chatId: number }
  | { type: 'ERROR'; error: string }
  | { type: 'RETRY' }
  | { type: 'CLEAR_ERROR' };

// ============================================================================
// Machine Definition
// ============================================================================

export const telegramMachine = setup({
  types: {
    context: {} as TelegramMachineContext,
    events: {} as TelegramMachineEvent,
  },
  actions: {
    addChat: ({ context }, params: { chatId: number }) => {
      if (!context.activeChatIds.includes(params.chatId)) {
        context.activeChatIds.push(params.chatId);
      }
    },
    setChatThinking: ({ context }, params: { chatId: number }) => {
      context.chatStatuses[params.chatId] = 'thinking';
    },
    setChatStreaming: ({ context }, params: { chatId: number }) => {
      context.chatStatuses[params.chatId] = 'streaming';
    },
    setChatIdle: ({ context }, params: { chatId: number }) => {
      context.chatStatuses[params.chatId] = 'idle';
    },
    incrementMessageCount: ({ context }, params: { chatId: number }) => {
      context.messageCounts[params.chatId] =
        (context.messageCounts[params.chatId] || 0) + 1;
    },
    setError: ({ context }, params: { error: string }) => {
      context.errorMessage = params.error;
    },
    clearError: ({ context }) => {
      context.errorMessage = null;
    },
  },
  guards: {
    hasActiveChats: ({ context }) => context.activeChatIds.length > 0,
  },
}).createMachine({
  id: 'telegramBot',
  initial: 'disconnected',
  context: {
    activeChatIds: [],
    errorMessage: null,
    chatStatuses: {},
    messageCounts: {},
  },
  states: {
    disconnected: {
      on: {
        CONNECT: { target: 'connecting' },
      },
    },
    connecting: {
      on: {
        CONNECTION_ESTABLISHED: { target: 'connected' },
        CONNECTION_FAILED: {
          target: 'error',
          actions: [{ type: 'setError', params: ({ event }) => ({ error: event.error }) }],
        },
      },
      after: {
        10000: {
          target: 'error',
          actions: [{ type: 'setError', params: { error: 'Connection timeout' } }],
        },
      },
    },
    connected: {
      on: {
        DISCONNECT: { target: 'disconnected' },
        MESSAGE_RECEIVED: {
          actions: [
            { type: 'addChat', params: ({ event }) => ({ chatId: event.chatId }) },
            { type: 'incrementMessageCount', params: ({ event }) => ({ chatId: event.chatId }) },
          ],
        },
        AI_THINKING: {
          actions: [{ type: 'setChatThinking', params: ({ event }) => ({ chatId: event.chatId }) }],
        },
        AI_STREAMING: {
          actions: [{ type: 'setChatStreaming', params: ({ event }) => ({ chatId: event.chatId }) }],
        },
        AI_COMPLETE: {
          actions: [{ type: 'setChatIdle', params: ({ event }) => ({ chatId: event.chatId }) }],
        },
        ERROR: {
          target: 'error',
          actions: [{ type: 'setError', params: ({ event }) => ({ error: event.error }) }],
        },
      },
    },
    error: {
      on: {
        RETRY: { target: 'connecting' },
        CLEAR_ERROR: {
          target: 'disconnected',
          actions: ['clearError'],
        },
        DISCONNECT: {
          target: 'disconnected',
          actions: ['clearError'],
        },
      },
    },
  },
});

// ============================================================================
// Actor (Module-Level Singleton)
// ============================================================================

export const telegramActor = createActor(telegramMachine);

// ============================================================================
// Types & Helpers
// ============================================================================

export type TelegramMachineSnapshot = SnapshotFrom<typeof telegramMachine>;

export const getTelegramState = (
  snapshot: TelegramMachineSnapshot
): 'disconnected' | 'connecting' | 'connected' | 'error' => {
  if (snapshot.matches('disconnected')) return 'disconnected';
  if (snapshot.matches('connecting')) return 'connecting';
  if (snapshot.matches('connected')) return 'connected';
  if (snapshot.matches('error')) return 'error';
  return 'disconnected';
};

export const isTelegramConnected = (snapshot: TelegramMachineSnapshot): boolean =>
  snapshot.matches('connected');

export const getTelegramError = (snapshot: TelegramMachineSnapshot): string | null =>
  snapshot.context.errorMessage;

export const getChatStatus = (
  snapshot: TelegramMachineSnapshot,
  chatId: number
): 'idle' | 'thinking' | 'streaming' =>
  snapshot.context.chatStatuses[chatId] || 'idle';
