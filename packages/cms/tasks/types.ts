/**
 * TypeScript types for Task Front Matter
 * 
 * These types ensure consistency across task files and enable type-safe
 * task manipulation in scripts and tooling.
 */

/**
 * Task status values
 */
export type TaskStatus = 
  | "pending"
  | "in_progress"
  | "completed"
  | "blocked"
  | "cancelled";

/**
 * Task priority values
 */
export type TaskPriority = 
  | "low"
  | "medium"
  | "high"
  | "critical";

/**
 * Task ID format: {phase}-{task-id}[-{subtask-id}...]
 * Examples: "01-001", "01-001-001", "01-001-001-001"
 */
export type TaskId = string & { readonly __brand: "TaskId" };

/**
 * Phase name format: snake_case (lowercase, hyphens/underscores)
 * Examples: "foundation", "metadata-annotations", "advanced-simple-fields"
 */
export type PhaseName = string & { readonly __brand: "PhaseName" };

/**
 * Short title format: kebab-case (lowercase, hyphens, 3 words or less)
 * Examples: "base-archetype", "complete-setup", "add-types"
 */
export type ShortTitle = string & { readonly __brand: "ShortTitle" };

/**
 * ISO 8601 date string (YYYY-MM-DD)
 */
export type ISODate = string & { readonly __brand: "ISODate" };

/**
 * Task Front Matter
 * 
 * This interface represents the YAML front matter of a task file.
 */
export interface TaskFrontMatter {
  /** Unique task identifier (e.g., "01-001" or "01-001-001") */
  id: TaskId;
  
  /** Task title (full description) */
  title: string;
  
  /** Short title in kebab-case (e.g., "base-archetype", "add-types") */
  shortTitle: ShortTitle;
  
  /** Current status of the task */
  status: TaskStatus;
  
  /** Phase number */
  phase: number;
  
  /** Phase name in snake_case (e.g., "foundation", "metadata-annotations") */
  phaseName: PhaseName;
  
  /** Task priority */
  priority: TaskPriority;
  
  /** ID of parent task (null for top-level tasks) */
  parent: TaskId | null;
  
  /** Array of child task IDs */
  children: TaskId[];
  
  /** Array of sibling task IDs (same parent) */
  siblings?: TaskId[];
  
  /** Array of task IDs this task depends on */
  dependsOn: TaskId[];
  
  /** Array of task IDs blocked by this task */
  blocks: TaskId[];
  
  /** Person or team responsible for this task */
  assignee?: string | null;
  
  /** Tags for categorization */
  labels?: string[];
  
  /** Estimated time to complete in hours */
  estimatedHours?: number;
  
  /** Actual time spent in hours */
  actualHours?: number;
  
  /** Start date in ISO 8601 format (YYYY-MM-DD) */
  startDate?: ISODate | null;
  
  /** Due date in ISO 8601 format (YYYY-MM-DD) */
  dueDate?: ISODate | null;
  
  /** Completion date in ISO 8601 format (YYYY-MM-DD) */
  completedDate?: ISODate | null;
  
  /** Array of related task IDs */
  relatedTasks?: TaskId[];
  
  /** Array of related documentation paths */
  relatedDocs?: string[];
  
  /** Array of related issue/PR numbers or URLs */
  relatedIssues?: string[];
  
  /** Internal notes (not displayed in body) */
  notes?: string;
}

/**
 * Task file structure
 */
export interface TaskFile {
  /** Front matter metadata */
  frontMatter: TaskFrontMatter;
  
  /** Markdown content body */
  content: string;
  
  /** File path */
  path: string;
}

/**
 * Helper type for creating a new task
 */
export type NewTask = Omit<TaskFrontMatter, "id" | "children" | "dependsOn" | "blocks"> & {
  id?: TaskId;
  children?: TaskId[];
  dependsOn?: TaskId[];
  blocks?: TaskId[];
};

/**
 * Task ID validation
 */
export function isValidTaskId(id: string): id is TaskId {
  return /^\d{2}-\d{3}(-\d{3})*$/.test(id);
}

/**
 * Create a TaskId from a string (with validation)
 */
export function createTaskId(id: string): TaskId {
  if (!isValidTaskId(id)) {
    throw new Error(`Invalid task ID format: ${id}. Expected format: XX-XXX[-XXX...]`);
  }
  return id as TaskId;
}

/**
 * Phase name validation
 */
export function isValidPhaseName(name: string): name is PhaseName {
  return /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(name);
}

/**
 * Create a PhaseName from a string (with validation)
 */
export function createPhaseName(name: string): PhaseName {
  if (!isValidPhaseName(name)) {
    throw new Error(`Invalid phase name format: ${name}. Expected snake_case format.`);
  }
  return name as PhaseName;
}

/**
 * Convert a human-readable phase name to snake_case
 */
export function toPhaseName(name: string): PhaseName {
  return createPhaseName(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-")
  );
}

/**
 * Short title validation (kebab-case, 3 words or less)
 */
export function isValidShortTitle(title: string): title is ShortTitle {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(title) && title.length <= 30 && (title.match(/-/g) || []).length < 3;
}

/**
 * Create a ShortTitle from a string (with validation)
 */
export function createShortTitle(title: string): ShortTitle {
  if (!isValidShortTitle(title)) {
    throw new Error(`Invalid short title format: ${title}. Expected kebab-case with 3 words or less.`);
  }
  return title as ShortTitle;
}

/**
 * Convert a full task title to short title (kebab-case, 3 words)
 */
export function toShortTitle(title: string): ShortTitle {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, "")
    .split(/\s+/)
    .filter(w => w.length > 0)
    .slice(0, 3);
  
  const shortTitle = words.join("-");
  return createShortTitle(shortTitle);
}

/**
 * Convert a task title to filename-safe snake_case
 */
export function titleToFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * Generate task filename from task ID and title
 */
export function generateTaskFilename(id: TaskId, title: string): string {
  const filename = titleToFilename(title);
  return `${id}-${filename}.md`;
}

/**
 * Generate phase directory name from phase number and name
 */
export function generatePhaseDirectoryName(phase: number, phaseName: PhaseName): string {
  const phaseNum = phase.toString().padStart(2, "0");
  return `phase-${phaseNum}-${phaseName}`;
}

/**
 * Extract phase number from task ID
 */
export function getPhaseFromTaskId(id: TaskId): number {
  const match = id.match(/^(\d{2})-/);
  if (!match) {
    throw new Error(`Invalid task ID format: ${id}`);
  }
  return parseInt(match[1], 10);
}

/**
 * Get parent task ID from child task ID
 */
export function getParentTaskId(id: TaskId): TaskId | null {
  const parts = id.split("-");
  if (parts.length <= 2) {
    return null; // Top-level task
  }
  return createTaskId(parts.slice(0, -1).join("-"));
}

/**
 * Check if task A is a child of task B
 */
export function isChildOf(childId: TaskId, parentId: TaskId): boolean {
  return childId.startsWith(parentId + "-");
}

/**
 * Check if task A is a descendant of task B
 */
export function isDescendantOf(descendantId: TaskId, ancestorId: TaskId): boolean {
  return descendantId.startsWith(ancestorId + "-");
}

