/**
 * Telegram Agent Server
 *
 * Standalone Bun server for the Telegram bot agent.
 * Connects to Claude Code for AI responses following cursor architecture.
 *
 * Usage: bun run scripts/telegram-agent.ts
 *
 * Features:
 * - Telegram Bot API integration
 * - Claude Code (AI SDK 6) for responses
 * - XState lifecycle management
 * - effect-atom state (Atom-as-State)
 * - Commands: /start, /help, /reset, /status
 */

import { Effect, Layer, pipe } from 'effect';
import { streamText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';
import { nanoid } from 'nanoid';
import type { Message } from 'node-telegram-bot-api';
import {
  TelegramAgent,
  TelegramAgentLive,
  TelegramAgentConfigTag,
} from './services/TelegramAgent';
import {
  telegramOps,
  telegramActorOps,
  telegramRegistry,
  messagesByChatAtom,
} from './atoms';
import type { TelegramMessage } from './schemas/message';
import {
  RagProvider,
  LeannBackendLive,
  SearchPayload,
  hasIndex as ragHasIndex,
  getContext,
} from '../rag';
import {
  registerBlockCommands,
  parseBlockCommand,
  handleBlockSubcommand,
  handleBlocksList,
} from './commands/blocks';

// ============================================================================
// Configuration
// ============================================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PROJECT_ROOT = process.cwd();
const LEANN_ENABLED = process.env.LEANN_ENABLED !== 'false'; // Enable by default

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
  process.exit(1);
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are Val, the TMNL (Terminal & Multi-Modal Navigation Layer) assistant.
You are communicating via Telegram with the Prime (your developer).

Your personality:
- Sharp, elegant, and technically precise
- A hint of sass and confident wit
- Amused but professional
- Never vague — you shape chaos into concrete answers

Your capabilities:
- Answer questions about the TMNL codebase
- Help with Effect-TS patterns, React architecture, and TypeScript
- Provide technical guidance on Effect services, atoms, and state management
- Assist with debugging and problem-solving

Keep responses concise (Telegram has message limits).
Use Markdown formatting sparingly (Telegram supports a subset).
If code is needed, keep snippets short or suggest viewing in the full environment.

Current context: TMNL development environment running on WSL2.`;

// ============================================================================
// AI Provider (Claude Code via AI SDK)
// ============================================================================

const model = claudeCode('sonnet', { cwd: PROJECT_ROOT });

// ============================================================================
// Message Handlers
// ============================================================================

const handleMessage = async (msg: Message, agent: typeof TelegramAgent.Service) => {
  const chatId = msg.chat.id;
  const text = msg.text ?? '';
  const username = msg.from?.username ?? msg.from?.first_name ?? 'Unknown';

  // Handle block subcommands (e.g., /block:create)
  const blockCmd = parseBlockCommand(text);
  if (blockCmd) {
    await handleBlockSubcommand(msg, agent, blockCmd.command, blockCmd.args);
    return;
  }

  // Skip other commands (handled separately)
  if (text.startsWith('/')) return;

  console.log(`📩 [${chatId}] ${username}: ${text}`);

  // Update state
  telegramActorOps.messageReceived(chatId);
  telegramOps.addMessage({
    id: nanoid(),
    chatId,
    role: 'user',
    content: text,
    timestamp: Date.now(),
  });

  // Send typing indicator
  telegramActorOps.aiThinking(chatId);
  telegramOps.setBotStatus(chatId, 'thinking');
  await Effect.runPromise(agent.sendTypingAction(chatId));

  try {
    // Get conversation history - include current message explicitly
    // (atom update may not have settled yet)
    const storedMessages = telegramRegistry.get(messagesByChatAtom)[chatId] ?? [];
    const currentMessage = { role: 'user' as const, content: text };

    // Build conversation history, ensuring current message is included
    const conversationHistory = [
      ...storedMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Add current message if not already in history (timing-safe)
    const hasCurrentMessage = conversationHistory.some(
      (m) => m.role === 'user' && m.content === text
    );
    if (!hasCurrentMessage) {
      conversationHistory.push(currentMessage);
    }

    // RAG: Search codebase for context using Effect-native pattern
    let ragContext = '';
    if (LEANN_ENABLED) {
      const ragProgram = pipe(
        getContext(text, 3),
        Effect.tap((ctx) =>
          ctx ? Effect.log(`🔍 [${chatId}] RAG: Found context`) : Effect.void
        ),
        Effect.catchAll((err) => {
          console.warn(`⚠️ [${chatId}] RAG search failed:`, err);
          return Effect.succeed('');
        }),
        Effect.provide(LeannBackendLive)
      );
      ragContext = await Effect.runPromise(ragProgram);
    }

    // Build system prompt with RAG context
    const systemWithContext = ragContext
      ? `${SYSTEM_PROMPT}${ragContext}`
      : SYSTEM_PROMPT;

    // Get AI response
    telegramActorOps.aiStreaming(chatId);
    telegramOps.setBotStatus(chatId, 'streaming');

    const result = streamText({
      model,
      system: systemWithContext,
      messages: conversationHistory,
    });

    // Collect full response (Telegram doesn't support streaming edits well)
    let fullResponse = '';
    for await (const chunk of result.textStream) {
      fullResponse += chunk;
      // Keep typing indicator active
      await Effect.runPromise(agent.sendTypingAction(chatId)).catch(() => {});
    }

    // Send response
    if (fullResponse.trim()) {
      // Telegram has 4096 char limit, split if needed
      const chunks = splitMessage(fullResponse, 4000);
      for (const chunk of chunks) {
        await Effect.runPromise(
          agent.sendMessage(chatId, chunk, { parseMode: 'Markdown' })
        ).catch(async () => {
          // If Markdown fails, send as plain text
          await Effect.runPromise(agent.sendMessage(chatId, chunk));
        });
      }

      // Save assistant response
      telegramOps.addMessage({
        id: nanoid(),
        chatId,
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      });
    }

    telegramActorOps.aiComplete(chatId);
    telegramOps.setBotStatus(chatId, 'idle');
    console.log(`📤 [${chatId}] Val: ${fullResponse.substring(0, 100)}...`);
  } catch (error) {
    console.error(`❌ [${chatId}] Error:`, error);
    telegramActorOps.aiComplete(chatId);
    telegramOps.setBotStatus(chatId, 'error');

    await Effect.runPromise(
      agent.sendMessage(
        chatId,
        '❌ Sorry, I encountered an error processing your request. Please try again.'
      )
    );
  }
};

// ============================================================================
// Command Handlers
// ============================================================================

const handleStart = async (msg: Message, agent: typeof TelegramAgent.Service) => {
  const chatId = msg.chat.id;
  const name = msg.from?.first_name ?? 'Prime';

  await Effect.runPromise(
    agent.sendMessage(
      chatId,
      `🤖 *Val online.*

Hello ${name}. I'm your TMNL architectural conscience — here to help with Effect-TS patterns, React architecture, and keeping the codebase clean.

*Commands:*
/help — Show available commands
/reset — Clear conversation history
/status — Show bot status

What can I help you with?`,
      { parseMode: 'Markdown' }
    )
  );

  telegramOps.updateChatState(chatId, {
    chatId,
    username: msg.from?.username,
    firstName: msg.from?.first_name,
    messages: [],
    lastActivity: Date.now(),
  });
};

const handleHelp = async (msg: Message, agent: typeof TelegramAgent.Service) => {
  await Effect.runPromise(
    agent.sendMessage(
      msg.chat.id,
      `📋 *Available Commands*

*General:*
/start — Initialize conversation
/help — Show this help message
/reset — Clear conversation history
/status — Show bot and connection status

*Blocks (Real-time Sync):*
/blocks — List all blocks
/block:create <type> — Create block (text, map, scene3d, data-grid)
/block:delete <id> — Delete a block
/block:info <id> — Get block details
/block:focus <id> — Focus on a block
/block:sync — Force sync with stream

*Tips:*
• Blocks sync in real-time with TMNL web app
• Use focus mode to highlight blocks across devices`,
      { parseMode: 'Markdown' }
    )
  );
};

const handleReset = async (msg: Message, agent: typeof TelegramAgent.Service) => {
  const chatId = msg.chat.id;
  telegramOps.clearChat(chatId);

  await Effect.runPromise(
    agent.sendMessage(
      chatId,
      '🔄 Conversation history cleared. Fresh start!',
      { parseMode: 'Markdown' }
    )
  );
};

const handleStatus = async (msg: Message, agent: typeof TelegramAgent.Service) => {
  const chatId = msg.chat.id;
  const messages = telegramRegistry.get(messagesByChatAtom)[chatId] ?? [];
  const botInfo = await Effect.runPromise(agent.getMe);

  // Check LEANN index status using Effect-native pattern
  let leannStatus = '❌ Disabled';
  if (LEANN_ENABLED) {
    const checkProgram = pipe(
      ragHasIndex('tmnl-codebase'),
      Effect.map((exists) => exists ? '✅ Active (tmnl-codebase)' : '⚠️ No index found'),
      Effect.catchAll(() => Effect.succeed('⚠️ Error checking index')),
      Effect.provide(LeannBackendLive)
    );
    leannStatus = await Effect.runPromise(checkProgram);
  }

  await Effect.runPromise(
    agent.sendMessage(
      chatId,
      `📊 *Bot Status*

🤖 Bot: @${botInfo.username}
💬 Messages in chat: ${messages.length}
🔗 Connection: Active
🔍 RAG (LEANN): ${leannStatus}
🕐 Server time: ${new Date().toISOString()}`,
      { parseMode: 'Markdown' }
    )
  );
};

// ============================================================================
// Utilities
// ============================================================================

const splitMessage = (text: string, maxLength: number): string[] => {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // Try to split at a space
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // Force split
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
};

// ============================================================================
// Main Server
// ============================================================================

const main = Effect.gen(function* () {
  console.log('🚀 Starting Telegram Agent...');

  const agent = yield* TelegramAgent;

  // Get bot info
  const botInfo = yield* agent.getMe;
  console.log(`🤖 Bot: @${botInfo.username} (${botInfo.id})`);

  // Register command handlers
  yield* agent.onCommand('start', (msg) =>
    Effect.tryPromise(() => handleStart(msg, agent))
  );
  yield* agent.onCommand('help', (msg) =>
    Effect.tryPromise(() => handleHelp(msg, agent))
  );
  yield* agent.onCommand('reset', (msg) =>
    Effect.tryPromise(() => handleReset(msg, agent))
  );
  yield* agent.onCommand('status', (msg) =>
    Effect.tryPromise(() => handleStatus(msg, agent))
  );

  // Register block commands
  yield* agent.onCommand('blocks', (msg) =>
    Effect.tryPromise(() => handleBlocksList(msg, agent))
  );

  // Register message handler
  yield* agent.onMessage((msg) =>
    Effect.tryPromise(() => handleMessage(msg, agent))
  );

  // Update state machine
  telegramActorOps.connect();

  // Start polling
  yield* agent.start;
  telegramActorOps.connectionEstablished();

  console.log('✅ Telegram Agent started and polling for messages');
  console.log(`📱 Send a message to @${botInfo.username} to interact`);

  // Keep process alive (never resolves)
  yield* Effect.never;
});

// ============================================================================
// Run
// ============================================================================

const ConfigLayer = Layer.succeed(TelegramAgentConfigTag, {
  token: TELEGRAM_BOT_TOKEN!,
  polling: true,
});

const MainLayer = pipe(TelegramAgentLive, Layer.provide(ConfigLayer));

Effect.runPromise(pipe(main, Effect.provide(MainLayer))).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
