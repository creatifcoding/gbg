/**
 * Block Commands for Telegram
 *
 * Commands for interacting with the decoupled block system via Telegram.
 * Uses durable-streams for real-time sync with TMNL web app.
 *
 * Commands:
 * - /blocks - List all blocks
 * - /block:create <type> - Create a new block
 * - /block:delete <id> - Delete a block
 * - /block:info <id> - Get block details
 * - /block:focus <id> - Focus on a block
 * - /block:sync - Force sync with remote
 */

import { Effect, pipe } from 'effect';
import { nanoid } from 'nanoid';
import type { Message } from 'node-telegram-bot-api';
import type { TelegramAgent } from '../services/TelegramAgent';
import {
  makeRemoteBlockRuntime,
  makeRemoteBlockOps,
  blockSnapshotAtom,
  blocksMapAtom,
  blockIdsAtom,
  blockStateAtom,
  focusedBlockIdAtom,
  isFocusModeAtom,
  type RemoteBlockStreamConfig,
} from '../../blocks';

// ============================================================================
// Configuration
// ============================================================================

const STREAM_SERVER_URL = process.env.DURABLE_STREAM_URL ?? 'http://localhost:4437';

/**
 * Get stream URL for a chat
 */
const getStreamUrl = (chatId: number) =>
  `${STREAM_SERVER_URL}/v1/stream/telegram-blocks-${chatId}`;

// ============================================================================
// Per-Chat Runtime Cache
// ============================================================================

type BlockRuntime = ReturnType<typeof makeRemoteBlockRuntime>;
type BlockOps = ReturnType<typeof makeRemoteBlockOps>;

const runtimeCache = new Map<number, { runtime: BlockRuntime; ops: BlockOps }>();

/**
 * Get or create block runtime for a chat
 */
const getBlockRuntime = (chatId: number): { runtime: BlockRuntime; ops: BlockOps } => {
  const cached = runtimeCache.get(chatId);
  if (cached) return cached;

  const config: RemoteBlockStreamConfig = {
    url: getStreamUrl(chatId),
  };

  const runtime = makeRemoteBlockRuntime(config);
  const ops = makeRemoteBlockOps(runtime);

  runtimeCache.set(chatId, { runtime, ops });
  return { runtime, ops };
};

// ============================================================================
// Command Handlers
// ============================================================================

/**
 * /blocks - List all blocks
 */
export const handleBlocksList = async (
  msg: Message,
  agent: typeof TelegramAgent.Service
) => {
  const chatId = msg.chat.id;
  const { ops } = getBlockRuntime(chatId);

  try {
    // Sync first
    await ops.syncSnapshot();

    // Get blocks from snapshot
    const snapshot = await Effect.runPromise(
      Effect.sync(() => {
        // Access atom state directly (simplified for now)
        return { blocks: {}, sequence: 0 } as { blocks: Record<string, unknown>; sequence: number };
      })
    );

    const blockIds = Object.keys(snapshot.blocks);

    if (blockIds.length === 0) {
      await Effect.runPromise(
        agent.sendMessage(
          chatId,
          `📦 *Blocks*\n\nNo blocks yet. Create one with:\n\`/block:create <type>\`\n\nAvailable types: text, map, scene3d, data-grid`,
          { parseMode: 'Markdown' }
        )
      );
      return;
    }

    const blockList = blockIds
      .map((id, i) => {
        const block = snapshot.blocks[id] as { blockTypeName: string; createdAt: number };
        return `${i + 1}. \`${id.substring(0, 8)}\` - ${block.blockTypeName}`;
      })
      .join('\n');

    await Effect.runPromise(
      agent.sendMessage(
        chatId,
        `📦 *Blocks* (${blockIds.length})\n\n${blockList}\n\n_Sequence: ${snapshot.sequence}_`,
        { parseMode: 'Markdown' }
      )
    );
  } catch (error) {
    await Effect.runPromise(
      agent.sendMessage(chatId, `❌ Failed to list blocks: ${(error as Error).message}`)
    );
  }
};

/**
 * /block:create <type> - Create a new block
 */
export const handleBlockCreate = async (
  msg: Message,
  agent: typeof TelegramAgent.Service,
  args: string
) => {
  const chatId = msg.chat.id;
  const blockTypeName = args.trim() || 'text';

  // Validate block type
  const validTypes = ['text', 'map', 'scene3d', 'data-grid', 'code', 'image'];
  if (!validTypes.includes(blockTypeName)) {
    await Effect.runPromise(
      agent.sendMessage(
        chatId,
        `❌ Invalid block type: \`${blockTypeName}\`\n\nValid types: ${validTypes.join(', ')}`,
        { parseMode: 'Markdown' }
      )
    );
    return;
  }

  const { ops } = getBlockRuntime(chatId);
  const blockId = nanoid(12);

  try {
    await ops.createBlock({
      blockId,
      blockTypeName,
      attributes: {
        createdBy: msg.from?.username ?? 'telegram',
        createdAt: Date.now(),
      },
    });

    await Effect.runPromise(
      agent.sendMessage(
        chatId,
        `✅ *Block Created*\n\nID: \`${blockId}\`\nType: ${blockTypeName}\n\nView in TMNL or use \`/block:info ${blockId}\``,
        { parseMode: 'Markdown' }
      )
    );
  } catch (error) {
    await Effect.runPromise(
      agent.sendMessage(chatId, `❌ Failed to create block: ${(error as Error).message}`)
    );
  }
};

/**
 * /block:delete <id> - Delete a block
 */
export const handleBlockDelete = async (
  msg: Message,
  agent: typeof TelegramAgent.Service,
  args: string
) => {
  const chatId = msg.chat.id;
  const blockId = args.trim();

  if (!blockId) {
    await Effect.runPromise(
      agent.sendMessage(chatId, '❌ Usage: `/block:delete <block-id>`', {
        parseMode: 'Markdown',
      })
    );
    return;
  }

  const { ops } = getBlockRuntime(chatId);

  try {
    await ops.deleteBlock({ blockId });

    await Effect.runPromise(
      agent.sendMessage(chatId, `🗑️ Block \`${blockId}\` deleted.`, {
        parseMode: 'Markdown',
      })
    );
  } catch (error) {
    await Effect.runPromise(
      agent.sendMessage(chatId, `❌ Failed to delete block: ${(error as Error).message}`)
    );
  }
};

/**
 * /block:info <id> - Get block details
 */
export const handleBlockInfo = async (
  msg: Message,
  agent: typeof TelegramAgent.Service,
  args: string
) => {
  const chatId = msg.chat.id;
  const blockId = args.trim();

  if (!blockId) {
    await Effect.runPromise(
      agent.sendMessage(chatId, '❌ Usage: `/block:info <block-id>`', {
        parseMode: 'Markdown',
      })
    );
    return;
  }

  const { ops } = getBlockRuntime(chatId);

  try {
    // Sync first
    await ops.syncSnapshot();

    // TODO: Get specific block state from snapshot
    // For now, show placeholder
    await Effect.runPromise(
      agent.sendMessage(
        chatId,
        `📋 *Block Info*\n\nID: \`${blockId}\`\n\n_View in TMNL for full details._`,
        { parseMode: 'Markdown' }
      )
    );
  } catch (error) {
    await Effect.runPromise(
      agent.sendMessage(chatId, `❌ Failed to get block info: ${(error as Error).message}`)
    );
  }
};

/**
 * /block:focus <id> - Focus on a block
 */
export const handleBlockFocus = async (
  msg: Message,
  agent: typeof TelegramAgent.Service,
  args: string
) => {
  const chatId = msg.chat.id;
  const blockId = args.trim() || null;

  const { ops } = getBlockRuntime(chatId);

  try {
    await ops.setFocusMode({
      blockId,
      isFocusMode: blockId !== null,
    });

    if (blockId) {
      await Effect.runPromise(
        agent.sendMessage(chatId, `🎯 Focused on block \`${blockId}\``, {
          parseMode: 'Markdown',
        })
      );
    } else {
      await Effect.runPromise(
        agent.sendMessage(chatId, '🔓 Focus mode cleared.')
      );
    }
  } catch (error) {
    await Effect.runPromise(
      agent.sendMessage(chatId, `❌ Failed to set focus: ${(error as Error).message}`)
    );
  }
};

/**
 * /block:sync - Force sync with remote
 */
export const handleBlockSync = async (
  msg: Message,
  agent: typeof TelegramAgent.Service
) => {
  const chatId = msg.chat.id;
  const { ops } = getBlockRuntime(chatId);

  try {
    await ops.syncSnapshot();

    await Effect.runPromise(
      agent.sendMessage(chatId, '🔄 Synced with block stream.')
    );
  } catch (error) {
    await Effect.runPromise(
      agent.sendMessage(chatId, `❌ Sync failed: ${(error as Error).message}`)
    );
  }
};

// ============================================================================
// Command Registration Helper
// ============================================================================

/**
 * Register all block commands with the agent
 */
export const registerBlockCommands = (agent: typeof TelegramAgent.Service) =>
  Effect.gen(function* () {
    // /blocks - list all blocks
    yield* agent.onCommand('blocks', (msg) =>
      Effect.tryPromise(() => handleBlocksList(msg, agent))
    );

    // Handle block subcommands via message parsing (Telegram doesn't support : in commands)
    // These will be handled by the message handler checking for patterns
  });

/**
 * Parse block commands from message text
 * Returns command and args if matched, null otherwise
 */
export const parseBlockCommand = (
  text: string
): { command: string; args: string } | null => {
  // Match /block:<subcommand> <args>
  const match = text.match(/^\/block:(\w+)(?:\s+(.*))?$/);
  if (!match) return null;

  return {
    command: match[1]!,
    args: match[2]?.trim() ?? '',
  };
};

/**
 * Handle block subcommand
 */
export const handleBlockSubcommand = async (
  msg: Message,
  agent: typeof TelegramAgent.Service,
  command: string,
  args: string
): Promise<boolean> => {
  switch (command) {
    case 'create':
      await handleBlockCreate(msg, agent, args);
      return true;
    case 'delete':
      await handleBlockDelete(msg, agent, args);
      return true;
    case 'info':
      await handleBlockInfo(msg, agent, args);
      return true;
    case 'focus':
      await handleBlockFocus(msg, agent, args);
      return true;
    case 'sync':
      await handleBlockSync(msg, agent);
      return true;
    default:
      await Effect.runPromise(
        agent.sendMessage(
          msg.chat.id,
          `❌ Unknown block command: \`${command}\`\n\nAvailable: create, delete, info, focus, sync`,
          { parseMode: 'Markdown' }
        )
      );
      return true;
  }
};
