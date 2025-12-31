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
import { join, dirname } from 'path';

// import.meta.dir points to script directory when run via `bun run scripts/x.ts`
// But we may also be run from cwd directly, so try both paths
const scriptDir = dirname(import.meta.path);
const envPathFromScript = join(scriptDir, '../docker/.env');
const envPathFromCwd = join(process.cwd(), 'docker/.env');
const envPath = existsSync(envPathFromScript) ? envPathFromScript : envPathFromCwd;

// Load env BEFORE importing server (imports are hoisted, so use dynamic import)
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

// Dynamic import AFTER env is loaded (static imports are hoisted before top-level await)
await import('../src/lib/telegram/server');
