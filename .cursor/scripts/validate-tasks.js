#!/usr/bin/env node
/**
 * Validate all task files
 * 
 * Usage: node validate-tasks.js
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
    return { error: e.message };
  }
}

function validateTaskId(id) {
  return /^\d{2}-\d{3}(-\d{3})*$/.test(id);
}

function validatePhaseName(name) {
  return /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(name);
}

function validateFilename(filename, taskId, title) {
  const expectedPattern = new RegExp(`^${taskId.replace(/\./g, '\\.')}-[a-z0-9]+(?:-[a-z0-9]+)*\\.md$`);
  return expectedPattern.test(filename);
}

function getAllTasks() {
  const tasks = [];
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
  
  return tasks;
}

function validateTasks() {
  const tasks = getAllTasks();
  const errors = [];
  const warnings = [];
  const taskMap = new Map();
  
  // Build task map
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }
  
  // Validate each task
  for (const task of tasks) {
    // Validate ID format
    if (!validateTaskId(task.id)) {
      errors.push(`${task.id}: Invalid ID format`);
    }
    
    // Validate required fields
    if (!task.title) errors.push(`${task.id}: Missing title`);
    if (!task.status) errors.push(`${task.id}: Missing status`);
    if (!task.phase) errors.push(`${task.id}: Missing phase`);
    if (!task.phaseName) errors.push(`${task.id}: Missing phaseName`);
    if (!task.priority) errors.push(`${task.id}: Missing priority`);
    
    // Validate phaseName format
    if (task.phaseName && !validatePhaseName(task.phaseName)) {
      errors.push(`${task.id}: Invalid phaseName format: ${task.phaseName}`);
    }
    
    // Validate filename matches ID and title
    const expectedFilename = `${task.id}-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.md`;
    if (!task.filename.startsWith(task.id)) {
      errors.push(`${task.id}: Filename doesn't start with task ID: ${task.filename}`);
    }
    
    // Validate parent-child consistency
    if (task.parent) {
      const parent = taskMap.get(task.parent);
      if (!parent) {
        errors.push(`${task.id}: Parent task not found: ${task.parent}`);
      } else if (!parent.children || !parent.children.includes(task.id)) {
        errors.push(`${task.id}: Parent ${task.parent} doesn't list this task in children`);
      }
    }
    
    // Validate children exist
    if (task.children && task.children.length > 0) {
      for (const childId of task.children) {
        const child = taskMap.get(childId);
        if (!child) {
          errors.push(`${task.id}: Child task not found: ${childId}`);
        } else if (child.parent !== task.id) {
          errors.push(`${task.id}: Child ${childId} doesn't list this task as parent`);
        }
      }
    }
    
    // Validate phase consistency
    if (task.parent) {
      const parent = taskMap.get(task.parent);
      if (parent && (parent.phase !== task.phase || parent.phaseName !== task.phaseName)) {
        errors.push(`${task.id}: Phase mismatch with parent ${task.parent}`);
      }
    }
    
    // Validate status consistency
    if (task.status === 'completed' && !task.completedDate) {
      warnings.push(`${task.id}: Completed task missing completedDate`);
    }
  }
  
  return { errors, warnings, taskCount: tasks.length };
}

try {
  const { errors, warnings, taskCount } = validateTasks();
  
  console.log(`\nValidated ${taskCount} task(s)\n`);
  
  if (errors.length > 0) {
    console.error(`❌ Found ${errors.length} error(s):\n`);
    for (const error of errors) {
      console.error(`   ${error}`);
    }
    console.error('');
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.warn(`⚠️  Found ${warnings.length} warning(s):\n`);
    for (const warning of warnings) {
      console.warn(`   ${warning}`);
    }
    console.log('');
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All tasks are valid!\n');
  }
} catch (error) {
  console.error('Error validating tasks:', error.message);
  process.exit(1);
}

