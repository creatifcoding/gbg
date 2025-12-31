/**
 * TelegramAgent Effect.Service
 *
 * Provides Telegram Bot API integration following cursor architecture patterns.
 * Uses node-telegram-bot-api for transport, Effect.Service for DI.
 *
 * This service is stateless — all state lives in atoms (Atom-as-State doctrine).
 */

import { Context, Effect, Layer } from 'effect';
import type TelegramBot from 'node-telegram-bot-api';
import type { Message } from 'node-telegram-bot-api';

// ============================================================================
// Service Interface
// ============================================================================

export interface TelegramAgentShape {
  /**
   * Start the bot (begin polling for messages)
   */
  readonly start: Effect.Effect<void, Error>;

  /**
   * Stop the bot (stop polling)
   */
  readonly stop: Effect.Effect<void, Error>;

  /**
   * Send a text message to a chat
   */
  readonly sendMessage: (
    chatId: number,
    text: string,
    options?: { parseMode?: 'Markdown' | 'HTML' }
  ) => Effect.Effect<Message, Error>;

  /**
   * Send typing indicator ("bot is typing...")
   */
  readonly sendTypingAction: (chatId: number) => Effect.Effect<void, Error>;

  /**
   * Register a message handler
   */
  readonly onMessage: (
    handler: (msg: Message) => Effect.Effect<void, Error>
  ) => Effect.Effect<void, Error>;

  /**
   * Register a command handler (e.g., /start, /help)
   */
  readonly onCommand: (
    command: string,
    handler: (msg: Message, args: string[]) => Effect.Effect<void, Error>
  ) => Effect.Effect<void, Error>;

  /**
   * Get bot info
   */
  readonly getMe: Effect.Effect<TelegramBot.User, Error>;

  /**
   * Check if bot is currently polling
   */
  readonly isPolling: Effect.Effect<boolean, Error>;
}

// ============================================================================
// Service Tag
// ============================================================================

export class TelegramAgent extends Context.Tag('tmnl/telegram/TelegramAgent')<
  TelegramAgent,
  TelegramAgentShape
>() {}

// ============================================================================
// Configuration
// ============================================================================

export interface TelegramAgentConfig {
  readonly token: string;
  readonly polling?: boolean;
}

export class TelegramAgentConfigTag extends Context.Tag('tmnl/telegram/TelegramAgentConfig')<
  TelegramAgentConfigTag,
  TelegramAgentConfig
>() {}

// ============================================================================
// Live Implementation
// ============================================================================

export const TelegramAgentLive = Layer.effect(
  TelegramAgent,
  Effect.gen(function* () {
    const config = yield* TelegramAgentConfigTag;

    // node-telegram-bot-api is CommonJS, use require
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TelegramBotClass = require('node-telegram-bot-api') as typeof TelegramBot;
    const bot: TelegramBot = new TelegramBotClass(config.token, {
      polling: false, // We'll start manually
    });

    // Track handlers for cleanup
    const messageHandlers: Array<(msg: Message) => void> = [];

    return {
      start: Effect.tryPromise({
        try: async () => {
          await bot.startPolling();
        },
        catch: (e) => new Error(`Failed to start polling: ${e}`),
      }),

      stop: Effect.tryPromise({
        try: async () => {
          await bot.stopPolling();
        },
        catch: (e) => new Error(`Failed to stop polling: ${e}`),
      }),

      sendMessage: (chatId, text, options) =>
        Effect.tryPromise({
          try: async () => {
            return await bot.sendMessage(chatId, text, {
              parse_mode: options?.parseMode,
            });
          },
          catch: (e) => new Error(`Failed to send message: ${e}`),
        }),

      sendTypingAction: (chatId) =>
        Effect.tryPromise({
          try: async () => {
            await bot.sendChatAction(chatId, 'typing');
          },
          catch: (e) => new Error(`Failed to send typing action: ${e}`),
        }),

      onMessage: (handler) =>
        Effect.sync(() => {
          const wrappedHandler = (msg: Message) => {
            // Run the Effect handler (fire and forget for simplicity)
            Effect.runPromise(handler(msg)).catch(console.error);
          };
          messageHandlers.push(wrappedHandler);
          bot.on('message', wrappedHandler);
        }),

      onCommand: (command, handler) =>
        Effect.sync(() => {
          bot.onText(new RegExp(`^/${command}(?:\\s+(.*))?$`), (msg, match) => {
            const args = match?.[1]?.split(/\s+/).filter(Boolean) ?? [];
            Effect.runPromise(handler(msg, args)).catch(console.error);
          });
        }),

      getMe: Effect.tryPromise({
        try: async () => {
          return await bot.getMe();
        },
        catch: (e) => new Error(`Failed to get bot info: ${e}`),
      }),

      isPolling: Effect.sync(() => bot.isPolling()),
    };
  })
);

// ============================================================================
// Default Layer (uses environment variable)
// ============================================================================

export const TelegramAgentConfigFromEnv = Layer.effect(
  TelegramAgentConfigTag,
  Effect.sync(() => ({
    token: process.env.TELEGRAM_BOT_TOKEN ?? '',
    polling: true,
  }))
);

export const TelegramAgentDefault = TelegramAgentLive.pipe(
  Layer.provide(TelegramAgentConfigFromEnv)
);
