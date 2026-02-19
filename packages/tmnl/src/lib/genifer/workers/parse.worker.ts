/**
 * Parse Worker
 *
 * Offloads JSON.parse + Schema.decode from main thread.
 * Receives raw NDJSON lines, returns validated JsonPatch objects.
 *
 * @module genifer/workers/parse
 */

import { Schema } from "effect"

// =============================================================================
// Schema (duplicated from ../core/schemas to avoid bundling issues)
// =============================================================================

const PatchOp = Schema.Literal("add", "remove", "replace", "set")

const JsonPatch = Schema.Struct({
  op: PatchOp,
  path: Schema.String,
  value: Schema.optional(Schema.Unknown),
})

type JsonPatch = typeof JsonPatch.Type

const decodeJsonPatchSync = Schema.decodeUnknownSync(JsonPatch)

// =============================================================================
// Message Types
// =============================================================================

export interface ParseRequest {
  type: "parse"
  id: number
  lines: string[]
}

export interface ParseResponse {
  type: "parsed"
  id: number
  patches: JsonPatch[]
  errors: string[]
}

export interface ParseBatchRequest {
  type: "parseBatch"
  id: number
  chunk: string // Raw chunk with newlines
}

export type WorkerRequest = ParseRequest | ParseBatchRequest
export type WorkerResponse = ParseResponse

// =============================================================================
// Parse Logic
// =============================================================================

const parseLine = (line: string): JsonPatch | null => {
  let trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("//")) {
    return null
  }

  // Handle SSE format: "data: <json>"
  if (trimmed.startsWith("data:")) {
    trimmed = trimmed.slice(5).trim()
    if (!trimmed) {
      return null
    }
  }

  try {
    const raw = JSON.parse(trimmed)
    return decodeJsonPatchSync(raw)
  } catch {
    return null
  }
}

const parseLines = (lines: string[]): { patches: JsonPatch[]; errors: string[] } => {
  const patches: JsonPatch[] = []
  const errors: string[] = []

  for (const line of lines) {
    try {
      const patch = parseLine(line)
      if (patch) {
        patches.push(patch)
      }
    } catch (e) {
      errors.push(`Failed to parse: ${line.slice(0, 50)}...`)
    }
  }

  return { patches, errors }
}

const parseChunk = (chunk: string): { patches: JsonPatch[]; errors: string[] } => {
  const lines = chunk.split("\n").filter((l) => l.trim())
  return parseLines(lines)
}

// =============================================================================
// Worker Message Handler
// =============================================================================

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  switch (request.type) {
    case "parse": {
      const { patches, errors } = parseLines(request.lines)
      const response: ParseResponse = {
        type: "parsed",
        id: request.id,
        patches,
        errors,
      }
      self.postMessage(response)
      break
    }

    case "parseBatch": {
      const { patches, errors } = parseChunk(request.chunk)
      const response: ParseResponse = {
        type: "parsed",
        id: request.id,
        patches,
        errors,
      }
      self.postMessage(response)
      break
    }
  }
}

// Signal worker is ready
self.postMessage({ type: "ready" })
