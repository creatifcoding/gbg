---
id: "01-001-005"
title: "Create ensure utilities with generic type parameters"
shortTitle: "create-ensure-utilities-with-generic-type-parameters"
status: completed
phase: 1
phaseName: "foundation"
priority: medium
parent: "01-001"
children: []
dependsOn: ["01-001-004"]
blocks: ["01-001-006"]
assignee: null
labels: ["foundation", "hygraph", "typescript", "generics", "management-sdk"]
estimatedHours: 1.5
actualHours: 1.5
startDate: "2025-11-13"
dueDate: null
completedDate: "2025-11-13"
relatedTasks: []
relatedDocs: ["../../src/experiments/hygraph-existence-utils.ts"]
relatedIssues: []
notes: "Created ensureModel and ensureSimpleField utilities with generic type parameters using BatchMigration types"
---

# Create ensure utilities with generic type parameters

## Overview

Create `ensureModel` and `ensureSimpleField` utilities that check existence via urql (read-only) and create models/fields via Management SDK if missing. These utilities use generic type parameters for type safety with `BatchMigrationCreateModelInput` and `BatchMigrationCreateSimpleFieldInput`.

## Objectives

- [x] Define `EnsureClients` type for required clients
- [x] Implement `ensureModel()` with generic type parameters
- [x] Implement `ensureSimpleField()` with generic type parameters
- [x] Use `BatchMigrationCreateModelInput` type (not alias)
- [x] Use `BatchMigrationCreateSimpleFieldInput` type (not alias)
- [x] Check existence before creating
- [x] Queue creation operations (don't execute)
- [x] Return `{ created: boolean }` result

## Requirements

- Must accept generic type parameters for migration params and clients
- Must use `BatchMigrationCreateModelInput` directly (not `CreateModelParams` alias)
- Must use `BatchMigrationCreateSimpleFieldInput` directly (not `CreateSimpleFieldParams` alias)
- Must check existence via urql before creating
- Must queue operations via Management SDK (not execute)
- Must return structured result indicating if creation was queued
- Must support type-safe parameter passing

## Implementation Details

### Step 1: Define EnsureClients type
- Created `EnsureClients` type in `hygraph-existence-utils.ts`:
  ```typescript
  export type EnsureClients = {
    urqlClient: UrqlClient;
    mgmtClient: MgmtClient;
  };
  ```

### Step 2: Implement ensureModel()
- Implemented `ensureModel<TModelParams, TClients>()` that:
  - Accepts `BatchMigrationCreateModelInput` as generic parameter `TModelParams`
  - Accepts `EnsureClients` as generic parameter `TClients`
  - Extracts clients from params: `const { urqlClient, mgmtClient, ...modelParams } = params`
  - Calls `modelExists(urqlClient, modelParams.apiId)` to check existence
  - Returns `{ created: false }` if model already exists
  - Calls `mgmtClient.createModel(modelParams)` to queue creation if missing
  - Returns `{ created: true }` if creation was queued
  - Note: Operations are queued, not executed (caller must call `mgmtClient.run(true)`)

### Step 3: Implement ensureSimpleField()
- Implemented `ensureSimpleField<TFieldParams, TClients>()` that:
  - Accepts `BatchMigrationCreateSimpleFieldInput` as generic parameter `TFieldParams`
  - Accepts `EnsureClients` as generic parameter `TClients`
  - Requires `parentPluralApiId` parameter for existence checks
  - Extracts clients and field params: `const { urqlClient, mgmtClient, parentPluralApiId, ...fieldParams } = params`
  - Calls `fieldExists(urqlClient, parentPluralApiId, fieldParams.apiId)` to check existence
  - Returns `{ created: false }` if field already exists
  - Calls `mgmtClient.createSimpleField(fieldParams)` to queue creation if missing
  - Returns `{ created: true }` if creation was queued

### Step 4: Export utilities
- Exported both functions from `hygraph-existence-utils.ts`
- Added comprehensive documentation

## Acceptance Criteria

- [x] `EnsureClients` type defined
- [x] `ensureModel()` implemented with generic types
- [x] `ensureSimpleField()` implemented with generic types
- [x] Uses `BatchMigrationCreateModelInput` directly
- [x] Uses `BatchMigrationCreateSimpleFieldInput` directly
- [x] Checks existence before creating
- [x] Queues operations correctly
- [x] Returns structured results
- [x] Type-safe parameter passing
- [x] Functions exported and documented

## Dependencies

- Depends on: [Task 01-001-004](./01-001-004-create-existence-check-utilities-using-urql.md)
- Blocks: [Task 01-001-006](./01-001-006-update-hygraph-hello-world-ts-to-use-ensure-utilities.md)

## Related Tasks

- [Parent Task: Complete BaseArchetype](./01-001-complete-base-archetype.md)
- [Previous Task: Create existence check utilities](./01-001-004-create-existence-check-utilities-using-urql.md)
- [Next Task: Update hygraph-hello-world.ts](./01-001-006-update-hygraph-hello-world-ts-to-use-ensure-utilities.md)

## Notes

- These utilities combine read-only checks (urql) with mutations (Management SDK)
- Operations are queued, not executed - caller must call `mgmtClient.run(true)` separately
- Generic type parameters ensure type safety for both migration params and clients
- Using `BatchMigration*` types directly (not aliases) as requested

## Progress Log

- **2025-11-13**: Task created retroactively
- **2025-11-13**: Defined `EnsureClients` type
- **2025-11-13**: Implemented `ensureModel()` with generic type parameters
- **2025-11-13**: Implemented `ensureSimpleField()` with generic type parameters
- **2025-11-13**: Added documentation and type exports
- **2025-11-13**: Task completed

## References

- [Hygraph Management SDK Types](../../node_modules/.pnpm/@hygraph+management-sdk@1.5.2/node_modules/@hygraph/management-sdk/dist/src/Client.d.ts)
- [Updated file: hygraph-existence-utils.ts](../../src/experiments/hygraph-existence-utils.ts)
