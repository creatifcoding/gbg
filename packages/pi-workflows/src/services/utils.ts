import { createHash, randomUUID } from 'node:crypto'

import * as Schema from 'effect/Schema'

import {
  WorkflowCallId,
  WorkflowDigest,
  WorkflowName,
  WorkflowRunId,
  WorkflowSource,
  type WorkflowSource as WorkflowSourceType,
} from '../domain/schemas'

export function decodeWorkflowName(value: string): WorkflowName {
  return Schema.decodeUnknownSync(WorkflowName)(value)
}

export function decodeRunId(value: string): WorkflowRunId {
  return Schema.decodeUnknownSync(WorkflowRunId)(value)
}

export function decodeCallId(value: string): WorkflowCallId {
  return Schema.decodeUnknownSync(WorkflowCallId)(value)
}

export function decodeDigest(value: string): WorkflowDigest {
  return Schema.decodeUnknownSync(WorkflowDigest)(value)
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value))
}

export function digestUnknown(value: unknown): WorkflowDigest {
  return decodeDigest(createHash('sha256').update(canonicalJson(value)).digest('hex'))
}

export function digestString(value: string): WorkflowDigest {
  return decodeDigest(createHash('sha256').update(value).digest('hex'))
}

export function makeRunId(): WorkflowRunId {
  return decodeRunId(`wf_${randomUUID()}`)
}

export function makeCallId(): WorkflowCallId {
  return decodeCallId(`call_${randomUUID()}`)
}

export function decodeWorkflowSource(value: unknown): WorkflowSourceType {
  return Schema.decodeUnknownSync(WorkflowSource)(value)
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, sortJson(nested)]),
    )
  }

  return value
}
