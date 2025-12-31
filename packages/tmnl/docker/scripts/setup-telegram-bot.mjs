#!/usr/bin/env node
/**
 * Playwright script to create a Telegram bot via @BotFather.
 * Launches browser in headed mode for user interaction.
 *
 * Usage: node docker/scripts/setup-telegram-bot.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '.env');

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

async function main() {
  console.log('🤖 Telegram Bot Setup Assistant');
  console.log('================================\n');
  console.log('This script will help you create a Telegram bot and get your credentials.\n');

  // Check if credentials already exist
  if (existsSync(ENV_PATH)) {
    const envContent = readFileSync(ENV_PATH, 'utf-8');
    if (envContent.includes('TELEGRAM_BOT_TOKEN=') && !envContent.includes('your_telegram_bot_token_here')) {
      console.log('⚠️  Telegram credentials already exist in .env');
      const overwrite = await question('Do you want to overwrite them? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Exiting...');
        rl.close();
        return;
      }
    }
  }

  console.log('\n📋 Steps we\'ll follow:');
  console.log('   1. Open Telegram Web and navigate to @BotFather');
  console.log('   2. Create a new bot (you\'ll provide name and username)');
  console.log('   3. Copy the bot token');
  console.log('   4. Get your chat ID\n');

  const ready = await question('Press Enter to launch browser (or Ctrl+C to cancel)...');

  console.log('\n🚀 Launching browser...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to Telegram Web
    console.log('📱 Opening Telegram Web...');
    await page.goto('https://web.telegram.org/k/');

    // Wait for user to log in
    console.log('\n🔐 Please log in to Telegram Web if needed.');
    console.log('   Then search for @BotFather and start a chat with it.\n');

    const step1 = await question('Press Enter once you\'re chatting with @BotFather...');

    console.log('\n📝 Instructions:');
    console.log('   1. Send: /newbot');
    console.log('   2. Enter a name for your bot (e.g., "TMNL Tunnel Bot")');
    console.log('   3. Enter a username (must end in "bot", e.g., "tmnl_tunnel_bot")');
    console.log('   4. BotFather will give you an API token\n');

    const token = await question('Paste the bot token here: ');

    if (!token || token.length < 30) {
      console.log('❌ Invalid token format. Token should be like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
      await browser.close();
      rl.close();
      return;
    }

    console.log(`\n✅ Token saved: ${token.substring(0, 10)}...`);

    // Get chat ID
    console.log('\n📨 Now we need your chat ID.');
    console.log('   1. Send any message to your new bot (search for it in Telegram)');
    console.log('   2. Then I\'ll fetch your chat ID automatically\n');

    const step2 = await question('Press Enter after you\'ve sent a message to the bot...');

    // Fetch updates to get chat ID
    console.log('🔍 Fetching chat ID...');

    const updatesPage = await context.newPage();
    await updatesPage.goto(`https://api.telegram.org/bot${token}/getUpdates`);
    const content = await updatesPage.textContent('body');
    await updatesPage.close();

    let chatId = null;
    try {
      const data = JSON.parse(content);
      if (data.ok && data.result && data.result.length > 0) {
        chatId = data.result[0].message?.chat?.id?.toString();
      }
    } catch (e) {
      console.log('⚠️  Could not parse response');
    }

    if (!chatId) {
      console.log('❌ Could not automatically fetch chat ID.');
      chatId = await question('Please enter your chat ID manually (or press Enter to skip): ');
    }

    if (chatId) {
      console.log(`✅ Chat ID: ${chatId}`);
    }

    // Write to .env
    console.log('\n📝 Writing credentials to .env...');

    let envContent = '';
    if (existsSync(ENV_PATH)) {
      envContent = readFileSync(ENV_PATH, 'utf-8');
    } else {
      envContent = '# TMNL Docker Stack Environment Variables\n\n';
    }

    // Update or add TELEGRAM_BOT_TOKEN
    if (envContent.includes('TELEGRAM_BOT_TOKEN=')) {
      envContent = envContent.replace(/TELEGRAM_BOT_TOKEN=.*/g, `TELEGRAM_BOT_TOKEN=${token}`);
    } else {
      envContent += `\nTELEGRAM_BOT_TOKEN=${token}`;
    }

    // Update or add TELEGRAM_CHAT_ID
    if (chatId) {
      if (envContent.includes('TELEGRAM_CHAT_ID=')) {
        envContent = envContent.replace(/TELEGRAM_CHAT_ID=.*/g, `TELEGRAM_CHAT_ID=${chatId}`);
      } else {
        envContent += `\nTELEGRAM_CHAT_ID=${chatId}`;
      }
    }

    writeFileSync(ENV_PATH, envContent);
    console.log(`✅ Written to ${ENV_PATH}`);

    // Test the bot
    console.log('\n🧪 Testing bot...');
    const testPage = await context.newPage();
    const testMessage = encodeURIComponent('🎉 TMNL Tunnel Bot is configured!');
    await testPage.goto(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${testMessage}`);
    const testContent = await testPage.textContent('body');
    await testPage.close();

    try {
      const testData = JSON.parse(testContent);
      if (testData.ok) {
        console.log('✅ Test message sent successfully! Check your Telegram.');
      } else {
        console.log('⚠️  Test message failed:', testData.description);
      }
    } catch (e) {
      console.log('⚠️  Could not verify test message');
    }

    console.log('\n🎉 Telegram bot setup complete!');
    console.log('\nCredentials saved:');
    console.log(`   TELEGRAM_BOT_TOKEN=${token.substring(0, 10)}...`);
    if (chatId) {
      console.log(`   TELEGRAM_CHAT_ID=${chatId}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\nPress Enter to close browser...');
    await question('');
    await browser.close();
    rl.close();
  }
}

main().catch(console.error);
