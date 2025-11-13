#!/usr/bin/env node
/**
 * Generate task status report
 * 
 * Usage: node task-report.js [phaseName]
 * Example: node task-report.js foundation
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

function getAllTasks(phaseName = null) {
  const tasks = [];
  const entries = readdirSync(tasksRoot, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('phase-')) {
      const phaseDirName = entry.name.replace(/^phase-\d+-/, '');
      
      if (phaseName && phaseDirName !== phaseName) {
        continue;
      }
      
      const phasePath = join(tasksRoot, entry.name);
      const files = readdirSync(phasePath);
      
      for (const file of files) {
        if (file.endsWith('.md') && file.match(/^\d{2}-\d{3}/)) {
          const filePath = join(phasePath, file);
          const content = readFileSync(filePath, 'utf-8');
          const frontMatter = parseFrontMatter(content);
          
          if (frontMatter) {
            tasks.push(frontMatter);
          }
        }
      }
    }
  }
  
  return tasks;
}

function generateReport(phaseName = null) {
  const tasks = getAllTasks(phaseName);
  
  // Group by status
  const byStatus = {
    pending: [],
    in_progress: [],
    completed: [],
    blocked: [],
    cancelled: []
  };
  
  // Group by priority
  const byPriority = {
    low: [],
    medium: [],
    high: [],
    critical: []
  };
  
  let totalEstimated = 0;
  let totalActual = 0;
  
  for (const task of tasks) {
    if (byStatus[task.status]) {
      byStatus[task.status].push(task);
    }
    
    if (byPriority[task.priority]) {
      byPriority[task.priority].push(task);
    }
    
    if (task.estimatedHours) {
      totalEstimated += task.estimatedHours;
    }
    
    if (task.actualHours) {
      totalActual += task.actualHours;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`TASK STATUS REPORT${phaseName ? ` - Phase: ${phaseName}` : ' - All Phases'}`);
  console.log('='.repeat(80));
  
  console.log(`\nTotal Tasks: ${tasks.length}`);
  console.log(`\nBy Status:`);
  console.log(`  ⏳ Pending:     ${byStatus.pending.length}`);
  console.log(`  🔄 In Progress: ${byStatus.in_progress.length}`);
  console.log(`  ✅ Completed:   ${byStatus.completed.length}`);
  console.log(`  🚫 Blocked:     ${byStatus.blocked.length}`);
  console.log(`  ❌ Cancelled:   ${byStatus.cancelled.length}`);
  
  console.log(`\nBy Priority:`);
  console.log(`  🔵 Low:      ${byPriority.low.length}`);
  console.log(`  🟡 Medium:   ${byPriority.medium.length}`);
  console.log(`  🟠 High:     ${byPriority.high.length}`);
  console.log(`  🔴 Critical: ${byPriority.critical.length}`);
  
  if (totalEstimated > 0) {
    console.log(`\nTime Estimates:`);
    console.log(`  Estimated: ${totalEstimated} hours`);
    if (totalActual > 0) {
      console.log(`  Actual:    ${totalActual} hours`);
      const variance = totalActual - totalEstimated;
      console.log(`  Variance:  ${variance > 0 ? '+' : ''}${variance} hours`);
    }
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

// Parse arguments
const [phaseName] = process.argv.slice(2);

generateReport(phaseName || null);

