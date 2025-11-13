#!/usr/bin/env node
/**
 * Show task hierarchy tree
 * 
 * Usage: node task-tree.js [taskId]
 * Example: node task-tree.js 01-001
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

function getAllTasks() {
  const tasks = new Map();
  const entries = readdirSync(tasksRoot, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('phase-')) {
      const phasePath = join(tasksRoot, entry.name);
      const files = readdirSync(phasePath);
      
      for (const file of files) {
        if (file.endsWith('.md') && file.match(/^\d{2}-\d{3}/)) {
          const filePath = join(phasePath, file);
          const content = readFileSync(filePath, 'utf-8');
          const frontMatter = parseFrontMatter(content);
          
          if (frontMatter && frontMatter.id) {
            tasks.set(frontMatter.id, frontMatter);
          }
        }
      }
    }
  }
  
  return tasks;
}

function printTree(taskId, tasks, indent = '', isLast = true) {
  const task = tasks.get(taskId);
  if (!task) return;
  
  const statusEmoji = {
    pending: '⏳',
    in_progress: '🔄',
    completed: '✅',
    blocked: '🚫',
    cancelled: '❌'
  };
  
  const emoji = statusEmoji[task.status] || '❓';
  const prefix = isLast ? '└── ' : '├── ';
  
  console.log(`${indent}${prefix}${emoji} ${task.id} - ${task.title} [${task.status}]`);
  
  if (task.children && task.children.length > 0) {
    const newIndent = indent + (isLast ? '    ' : '│   ');
    for (let i = 0; i < task.children.length; i++) {
      const isLastChild = i === task.children.length - 1;
      printTree(task.children[i], tasks, newIndent, isLastChild);
    }
  }
}

function findRootTasks(tasks) {
  const rootTasks = [];
  for (const [id, task] of tasks) {
    if (!task.parent) {
      rootTasks.push(id);
    }
  }
  return rootTasks.sort();
}

// Parse arguments
const [taskId] = process.argv.slice(2);

const tasks = getAllTasks();

if (taskId) {
  // Show tree for specific task
  if (!tasks.has(taskId)) {
    console.error(`Task not found: ${taskId}`);
    process.exit(1);
  }
  
  console.log('\nTask Hierarchy:\n');
  printTree(taskId, tasks);
} else {
  // Show all root tasks
  const rootTasks = findRootTasks(tasks);
  
  if (rootTasks.length === 0) {
    console.log('No root tasks found.');
    process.exit(0);
  }
  
  console.log('\nTask Hierarchy (Root Tasks):\n');
  for (let i = 0; i < rootTasks.length; i++) {
    const isLast = i === rootTasks.length - 1;
    printTree(rootTasks[i], tasks, '', isLast);
  }
}

console.log('\n');

