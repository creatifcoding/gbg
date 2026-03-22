# Conductor Inline Task Harness Emission Contract v1

## Intent

Define the non-breaking adapter contract for mapping `chat:v2/tool_event` stream events into Conductor inline task thread events.

## Threading model

- **Thread id**: `node:${nodeId}`
- **Message anchor**: assistant message id when available (`messageAnchorId`)
- **Event ordering**: harness `seq` is preserved and guarded; stale/duplicate seq is ignored at atom append.

## Mapping rules

### Tool start

`chat:v2/tool_event` with `phase = "start"` maps to:

- `InlineHarnessTaskUpserted`
- `status = "running"`
- `taskId = toolCallId`
- `title = toolName`
- `progress = payload.progress` when numeric
- `message = payload.message | payload.delta | payload.error | payload.result`

### Tool update

`chat:v2/tool_event` with `phase = "update"` maps to one of:

- `InlineHarnessTaskProgressChanged` when `payload.progress` is numeric
- `InlineHarnessTaskLogAppended` otherwise

### Tool end

`chat:v2/tool_event` with `phase = "end"` maps to one of:

- `InlineHarnessTaskFailed` when payload has `error` or explicit failed status
- `InlineHarnessTaskCompleted` otherwise

## UI contract notes

- `InlineTaskRow` owns state-specific slot indicators and loading affordances.
- Motion is implemented via `motion/react` (motion.dev runtime), with reduced-motion fallbacks.
- Expanded thread remains scope-persistent by `threadId + messageAnchorId`.

## Rollout safety

- Adapter is additive; no existing chat-v2 message flow paths are replaced.
- Legacy `ConductorAgentChat` send/stream behavior remains unchanged.
- Inline task rendering is attachment-lane scoped to assistant message anchors.

## Verification checklist

- compile: `bunx tsc --noEmit -p tsconfig.json`
- regression: `bunx vitest src/components/testbed/conductor/__tests__/ConductorAgentChat.regression.test.tsx`
- hard-cut invariant: `bunx vitest src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts`
- adapter mapping: `bunx vitest src/components/testbed/conductor/__tests__/ConductorInlineTaskEventAdapter.test.ts`
- atom reducer/scoping: `bunx vitest src/lib/conductor/atoms/__tests__/inline-task-thread.test.ts`
