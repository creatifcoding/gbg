#!/usr/bin/env node
/**
 * Update task status
 * 
 * Usage: node update-status.js <taskId> <status>
 * Example: node update-status.js 01-001 in_progress
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load, dump } from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = join(__dirname, '../..');
const tasksRoot = join(workspaceRoot, 'packages/cms/tasks');

const validStatuses = ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'];

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

function updateTaskStatus(taskFile, newStatus) {
  const content = readFileSync(taskFile, 'utf-8');
  const match = content.match(/^(---\n[\s\S]*?\n---)\n\n([\s\S]*)$/);
  
  if (!match) {
    throw new Error('Invalid task file format');
  }
  
  const frontMatterStr = match[1];
  const body = match[2];
  
  // Parse front matter
  const frontMatterContent = frontMatterStr.replace(/^---\n|\n---$/g, '');
  const frontMatter = load(frontMatterContent);
  
  // Update status
  frontMatter.status = newStatus;
  
  // Update completedDate if completing
  if (newStatus === 'completed' && !frontMatter.completedDate) {
    frontMatter.completedDate = new Date().toISOString().split('T')[0];
  }
  
  // Reconstruct file
  const newFrontMatter = `---\n${dump(frontMatter, { lineWidth: 0, noRefs: true })}\n---`;
  const newContent = `${newFrontMatter}\n\n${body}`;
  
  writeFileSync(taskFile, newContent, 'utf-8');
  
  return frontMatter;
}

// Parse arguments
const [taskId, status] = process.argv.slice(2);

if (!taskId || !status) {
  console.error('Usage: node update-status.js <taskId> <status>');
  console.error(`Valid statuses: ${validStatuses.join(', ')}`);
  process.exit(1);
}

if (!validStatuses.includes(status)) {
  console.error(`Invalid status: ${status}`);
  console.error(`Valid statuses: ${validStatuses.join(', ')}`);
  process.exit(1);
}

try {
  const taskFile = findTaskFile(taskId);
  
  if (!taskFile) {
    console.error(`Task not found: ${taskId}`);
    process.exit(1);
  }
  
  const task = updateTaskStatus(taskFile, status);
  
  console.log(`✅ Updated task ${taskId} status to: ${status}`);
  
  if (status === 'completed' && task.completedDate) {
    console.log(`   Completed on: ${task.completedDate}`);
  }
} catch (error) {
  console.error('Error updating task:', error.message);
  process.exit(1);
}

