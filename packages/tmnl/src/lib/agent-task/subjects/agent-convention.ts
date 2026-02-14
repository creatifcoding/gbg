/**
 * AGENT Domain Convention — Subject hierarchy for agent task operations.
 *
 * Defines the NATS subject convention for agent task services:
 *
 *   agent.task.{taskId}.logs       — log stream per task
 *   agent.task.{taskId}.status     — status change events
 *   agent.task.{taskId}.metrics    — runtime metrics
 *   agent.task.{taskId}.commands   — command input (stop, retry, etc.)
 *   agent.session.{sessionId}.tasks — session-level task events
 *
 * Stream mapping: entityType (one stream per entity type)
 *   → AGENT_TASK stream captures agent.task.>
 *   → AGENT_SESSION stream captures agent.session.>
 *
 * @module agent-task/subjects/agent-convention
 */

import { Effect } from 'effect'
import type {
  DomainId,
  EntityType,
  DomainConvention,
} from '../../holonet/subject/conventions'
import { Subject } from '../../holonet/subject/errors'
import {
  SubjectSpec,
  createSubjectSpec,
  type SubjectSpecId,
} from '../../holonet/subject/schemas'

// ---------------------------------------------------------------------------
// Domain convention
// ---------------------------------------------------------------------------

/**
 * AGENT domain convention.
 *
 * - Pattern prefix: "agent."
 * - Allowed entity types: task, session, agent, cluster
 * - Default stream mapping: entityType
 * - Custom validation: task subjects must include {taskId}
 */
export const AGENT_CONVENTION: DomainConvention = {
  domain: 'agent' as DomainId,
  patternPrefix: 'agent.',
  allowedEntityTypes: [
    'task',
    'session',
    'agent',
    'cluster',
  ] as EntityType[],
  defaultStreamMapping: { _tag: 'entityType' },
  description: 'Agent task orchestration domain',
  validate: (spec) => {
    // Task subjects must include {taskId}
    if (
      spec.entityType === ('task' as EntityType) &&
      !spec.pattern.includes('{taskId}')
    ) {
      return Effect.fail(
        new Subject.ValidationError({
          message: 'Agent task subjects must include {taskId} placeholder',
          specId: spec.id,
        }),
      )
    }
    return Effect.void
  },
}

// ---------------------------------------------------------------------------
// Subject specs — pre-built for agent task operations
// ---------------------------------------------------------------------------

/** Log stream for a specific task. */
export const AgentTaskLogsSpec = createSubjectSpec({
  domain: 'agent',
  entityType: 'task',
  pattern: 'agent.task.{taskId}.logs',
  schemaId: 'AgentTaskLogEntry',
  description: 'Real-time log stream for an agent task',
  registeredBy: 'agent-task-service',
})

/** Status change events for a task. */
export const AgentTaskStatusSpec = createSubjectSpec({
  domain: 'agent',
  entityType: 'task',
  pattern: 'agent.task.{taskId}.status',
  schemaId: 'AgentTaskStatusEvent',
  description: 'Task status change notifications',
  registeredBy: 'agent-task-service',
})

/** Runtime metrics for a task. */
export const AgentTaskMetricsSpec = createSubjectSpec({
  domain: 'agent',
  entityType: 'task',
  pattern: 'agent.task.{taskId}.metrics',
  schemaId: 'AgentTaskMetrics',
  description: 'Runtime metrics for an agent task (cpu, memory, progress)',
  registeredBy: 'agent-task-service',
})

/** Command input for a task (stop, retry, prioritize, etc.). */
export const AgentTaskCommandsSpec = createSubjectSpec({
  domain: 'agent',
  entityType: 'task',
  pattern: 'agent.task.{taskId}.commands',
  schemaId: 'AgentTaskCommand',
  description: 'Inbound commands to control a running task',
  registeredBy: 'agent-task-service',
})

/** Session-level task events. */
export const AgentSessionTasksSpec = createSubjectSpec({
  domain: 'agent',
  entityType: 'session',
  pattern: 'agent.session.{sessionId}.tasks',
  schemaId: 'AgentSessionTaskEvent',
  description: 'Task lifecycle events scoped to a session',
  registeredBy: 'agent-task-service',
})

// ---------------------------------------------------------------------------
// All specs for bulk registration
// ---------------------------------------------------------------------------

/** All agent task subject specs. */
export const AGENT_TASK_SPECS = [
  AgentTaskLogsSpec,
  AgentTaskStatusSpec,
  AgentTaskMetricsSpec,
  AgentTaskCommandsSpec,
  AgentSessionTasksSpec,
] as const

// ---------------------------------------------------------------------------
// Convenience: resolved subjects
// ---------------------------------------------------------------------------

/** Resolve the log subject for a specific task. */
export const resolveLogSubject = (taskId: string): string =>
  AgentTaskLogsSpec.resolve({ taskId })

/** Wildcard for all task logs. */
export const AGENT_TASK_LOGS_WILDCARD = AgentTaskLogsSpec.wildcardPattern()

/** Wildcard for all task events. */
export const AGENT_TASK_ALL_WILDCARD = 'agent.task.>'
