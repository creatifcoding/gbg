#!/usr/bin/env bun
/**
 * Telegram Agent Server Entry Point
 *
 * Usage: bun run scripts/telegram-agent.ts
 *
 * Required environment variables:
 *   TELEGRAM_BOT_TOKEN - Bot token from @BotFather
 *
 * Optional:
 *   Set up via docker/.env and source it:
 *   source docker/.env && bun run scripts/telegram-agent.ts
 */

// Load environment from docker/.env if it exists
import { existsSync } from 'fs';
import { join } from 'path';

const envPath = join(import.meta.dir, '../docker/.env');
if (existsSync(envPath)) {
  const envContent = await Bun.file(envPath).text();
  for (const line of envContent.split('\n')) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=');
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
  console.log('📁 Loaded environment from docker/.env');
}

// Start the server
import '../src/lib/telegram/server';
