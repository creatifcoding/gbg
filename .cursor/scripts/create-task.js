#!/usr/bin/env node
/**
 * Create a new task file
 * 
 * Usage: node create-task.js <phaseNumber> <taskId> <title> <phaseName>
 * Example: node create-task.js 1 001 "Complete BaseArchetype" foundation
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = join(__dirname, '../..');

function titleToFilename(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function generateTaskId(phase, taskId, parentId = null) {
  if (parentId) {
    return `${parentId}-${taskId.padStart(3, '0')}`;
  }
  return `${phase.toString().padStart(2, '0')}-${taskId.padStart(3, '0')}`;
}

function generatePhaseDirectory(phase, phaseName) {
  const phaseNum = phase.toString().padStart(2, '0');
  return `phase-${phaseNum}-${phaseName}`;
}

function generateFilename(taskId, title) {
  const filename = titleToFilename(title);
  return `${taskId}-${filename}.md`;
}

function loadTemplate() {
  const templatePath = join(workspaceRoot, 'packages/cms/tasks/template.md');
  return readFileSync(templatePath, 'utf-8');
}

function createTaskFile(phase, taskId, title, phaseName, parentId = null) {
  const fullTaskId = generateTaskId(phase, taskId, parentId);
  const phaseDir = generatePhaseDirectory(phase, phaseName);
  const filename = generateFilename(fullTaskId, title);
  const phasePath = join(workspaceRoot, 'packages/cms/tasks', phaseDir);
  const filePath = join(phasePath, filename);

  // Create phase directory if it doesn't exist
  if (!existsSync(phasePath)) {
    mkdirSync(phasePath, { recursive: true });
  }

  // Check if file already exists
  if (existsSync(filePath)) {
    console.error(`Error: Task file already exists: ${filePath}`);
    process.exit(1);
  }

  // Load template
  const template = loadTemplate();
  
  // Replace template placeholders
  const content = template
    .replace(/id: "XX-XXX"/g, `id: "${fullTaskId}"`)
    .replace(/title: "Task Title"/g, `title: "${title}"`)
    .replace(/phase: X/g, `phase: ${phase}`)
    .replace(/phaseName: "snake-case-phase-name"/g, `phaseName: "${phaseName}"`)
    .replace(/# Task Title/g, `# ${title}`)
    .replace(/parent: null/g, parentId ? `parent: "${parentId}"` : 'parent: null');

  // Write file
  writeFileSync(filePath, content, 'utf-8');
  
  console.log(`✅ Created task: ${filePath}`);
  console.log(`   Task ID: ${fullTaskId}`);
  console.log(`   Phase: ${phase} (${phaseName})`);
  if (parentId) {
    console.log(`   Parent: ${parentId}`);
  }
  
  return filePath;
}

// Parse arguments
const [phaseNumber, taskId, title, phaseName, parentId] = process.argv.slice(2);

if (!phaseNumber || !taskId || !title || !phaseName) {
  console.error('Usage: node create-task.js <phaseNumber> <taskId> <title> <phaseName> [parentId]');
  console.error('Example: node create-task.js 1 001 "Complete BaseArchetype" foundation');
  process.exit(1);
}

try {
  createTaskFile(
    parseInt(phaseNumber, 10),
    taskId,
    title,
    phaseName,
    parentId || null
  );
} catch (error) {
  console.error('Error creating task:', error.message);
  process.exit(1);
}

