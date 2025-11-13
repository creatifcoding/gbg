#!/usr/bin/env node
/**
 * List all tasks
 * 
 * Usage: node list-tasks.js [phaseName]
 * Example: node list-tasks.js foundation
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load } from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = join(__dirname, '../..');
const tasksRoot = join(workspaceRoot, 'packages/cms/tasks');

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  
  try {
    return load(match[1]);
  } catch (e) {
    return null;
  }
}

function getAllTaskFiles(phaseName = null) {
  const tasks = [];
  const tasksDir = tasksRoot;
  
  if (!existsSync(tasksDir)) {
    return tasks;
  }

  const entries = readdirSync(tasksDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('phase-')) {
      const phaseDirName = entry.name.replace(/^phase-\d+-/, '');
      
      // Filter by phase name if provided
      if (phaseName && phaseDirName !== phaseName) {
        continue;
      }
      
      const phasePath = join(tasksDir, entry.name);
      const files = readdirSync(phasePath);
      
      for (const file of files) {
        if (file.endsWith('.md') && file.match(/^\d{2}-\d{3}/)) {
          const filePath = join(phasePath, file);
          const content = readFileSync(filePath, 'utf-8');
          const frontMatter = parseFrontMatter(content);
          
          if (frontMatter) {
            tasks.push({
              path: filePath,
              filename: file,
              ...frontMatter
            });
          }
        }
      }
    }
  }
  
  return tasks.sort((a, b) => a.id.localeCompare(b.id));
}

function formatTask(task) {
  const statusEmoji = {
    pending: '⏳',
    in_progress: '🔄',
    completed: '✅',
    blocked: '🚫',
    cancelled: '❌'
  };
  
  const priorityEmoji = {
    low: '🔵',
    medium: '🟡',
    high: '🟠',
    critical: '🔴'
  };
  
  const emoji = statusEmoji[task.status] || '❓';
  const priority = priorityEmoji[task.priority] || '';
  
  return `${emoji} ${priority} ${task.id.padEnd(12)} ${task.status.padEnd(12)} ${task.title}`;
}

// Parse arguments
const [phaseName] = process.argv.slice(2);

const tasks = getAllTaskFiles(phaseName || null);

if (tasks.length === 0) {
  console.log('No tasks found.');
  process.exit(0);
}

console.log(`\nFound ${tasks.length} task(s):\n`);
console.log('ID           Status       Title');
console.log('─'.repeat(80));

for (const task of tasks) {
  console.log(formatTask(task));
}

console.log('\n');

