#!/usr/bin/env node
/**
 * Show task dependency graph
 * 
 * Usage: node task-dependencies.js <taskId>
 * Example: node task-dependencies.js 01-001
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

function collectDependencies(taskId, tasks, visited = new Set(), deps = { upstream: [], downstream: [] }) {
  if (visited.has(taskId)) return deps;
  visited.add(taskId);
  
  const task = tasks.get(taskId);
  if (!task) return deps;
  
  // Collect upstream dependencies (tasks this depends on)
  if (task.dependsOn && task.dependsOn.length > 0) {
    for (const depId of task.dependsOn) {
      if (!deps.upstream.includes(depId)) {
        deps.upstream.push(depId);
        collectDependencies(depId, tasks, visited, deps);
      }
    }
  }
  
  // Collect downstream dependencies (tasks that depend on this)
  if (task.blocks && task.blocks.length > 0) {
    for (const blockId of task.blocks) {
      if (!deps.downstream.includes(blockId)) {
        deps.downstream.push(blockId);
        collectDependencies(blockId, tasks, visited, deps);
      }
    }
  }
  
  // Also check reverse (tasks that list this in dependsOn)
  for (const [id, otherTask] of tasks) {
    if (otherTask.dependsOn && otherTask.dependsOn.includes(taskId)) {
      if (!deps.downstream.includes(id)) {
        deps.downstream.push(id);
        collectDependencies(id, tasks, visited, deps);
      }
    }
  }
  
  return deps;
}

function printDependencies(taskId, tasks) {
  const task = tasks.get(taskId);
  if (!task) {
    console.error(`Task not found: ${taskId}`);
    return;
  }
  
  const deps = collectDependencies(taskId, tasks);
  
  console.log('\n' + '='.repeat(80));
  console.log(`DEPENDENCY GRAPH: ${taskId} - ${task.title}`);
  console.log('='.repeat(80));
  
  if (deps.upstream.length > 0) {
    console.log('\n⬆️  Upstream Dependencies (this task depends on):');
    for (const depId of deps.upstream) {
      const dep = tasks.get(depId);
      if (dep) {
        console.log(`   ${depId} - ${dep.title} [${dep.status}]`);
      } else {
        console.log(`   ${depId} - (not found)`);
      }
    }
  } else {
    console.log('\n⬆️  Upstream Dependencies: None');
  }
  
  if (deps.downstream.length > 0) {
    console.log('\n⬇️  Downstream Dependencies (tasks that depend on this):');
    for (const depId of deps.downstream) {
      const dep = tasks.get(depId);
      if (dep) {
        console.log(`   ${depId} - ${dep.title} [${dep.status}]`);
      } else {
        console.log(`   ${depId} - (not found)`);
      }
    }
  } else {
    console.log('\n⬇️  Downstream Dependencies: None');
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

// Parse arguments
const [taskId] = process.argv.slice(2);

if (!taskId) {
  console.error('Usage: node task-dependencies.js <taskId>');
  console.error('Example: node task-dependencies.js 01-001');
  process.exit(1);
}

const tasks = getAllTasks();
printDependencies(taskId, tasks);

