#!/usr/bin/env node
/**
 * Show task details
 * 
 * Usage: node show-task.js <taskId>
 * Example: node show-task.js 01-001
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
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

function findTaskFile(taskId) {
  const entries = readdirSync(tasksRoot, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('phase-')) {
      const phasePath = join(tasksRoot, entry.name);
      const files = readdirSync(phasePath);
      
      for (const file of files) {
        if (file.startsWith(taskId)) {
          return join(phasePath, file);
        }
      }
    }
  }
  
  return null;
}

function formatTask(task, content) {
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
  
  console.log('\n' + '='.repeat(80));
  console.log(`${statusEmoji[task.status] || '❓'} ${priorityEmoji[task.priority] || ''} ${task.title}`);
  console.log('='.repeat(80));
  console.log(`\nID:           ${task.id}`);
  console.log(`Status:        ${task.status}`);
  console.log(`Priority:      ${task.priority}`);
  console.log(`Phase:         ${task.phase} (${task.phaseName})`);
  
  if (task.parent) {
    console.log(`Parent:        ${task.parent}`);
  }
  
  if (task.children && task.children.length > 0) {
    console.log(`Children:      ${task.children.join(', ')}`);
  }
  
  if (task.dependsOn && task.dependsOn.length > 0) {
    console.log(`Depends on:    ${task.dependsOn.join(', ')}`);
  }
  
  if (task.blocks && task.blocks.length > 0) {
    console.log(`Blocks:        ${task.blocks.join(', ')}`);
  }
  
  if (task.assignee) {
    console.log(`Assignee:      ${task.assignee}`);
  }
  
  if (task.labels && task.labels.length > 0) {
    console.log(`Labels:        ${task.labels.join(', ')}`);
  }
  
  if (task.estimatedHours) {
    console.log(`Estimated:     ${task.estimatedHours} hours`);
  }
  
  if (task.actualHours) {
    console.log(`Actual:        ${task.actualHours} hours`);
  }
  
  if (task.dueDate) {
    console.log(`Due Date:      ${task.dueDate}`);
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log('CONTENT:');
  console.log('-'.repeat(80));
  
  // Extract content after front matter
  const contentMatch = content.match(/^---\n[\s\S]*?\n---\n\n([\s\S]*)$/);
  if (contentMatch) {
    console.log(contentMatch[1]);
  } else {
    console.log('(No content found)');
  }
  
  console.log('\n');
}

// Parse arguments
const [taskId] = process.argv.slice(2);

if (!taskId) {
  console.error('Usage: node show-task.js <taskId>');
  console.error('Example: node show-task.js 01-001');
  process.exit(1);
}

const taskFile = findTaskFile(taskId);

if (!taskFile) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

const content = readFileSync(taskFile, 'utf-8');
const frontMatter = parseFrontMatter(content);

if (!frontMatter) {
  console.error(`Invalid task file: ${taskFile}`);
  process.exit(1);
}

formatTask(frontMatter, content);

