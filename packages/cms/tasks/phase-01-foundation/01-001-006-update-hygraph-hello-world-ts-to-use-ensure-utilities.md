---
id: "01-001-006"
title: "Update hygraph-hello-world.ts to use ensure utilities"
shortTitle: "update-hygraph-hello-world-ts-to-use-ensure-utilities"
status: completed
phase: 1
phaseName: "foundation"
priority: medium
parent: "01-001"
children: []
dependsOn: ["01-001-005"]
blocks: []
assignee: null
labels: ["foundation", "hygraph", "experiments", "integration"]
estimatedHours: 0.5
actualHours: 0.5
startDate: "2025-11-13"
dueDate: null
completedDate: "2025-11-13"
relatedTasks: []
relatedDocs: ["../../src/experiments/hygraph-hello-world.ts"]
relatedIssues: []
notes: "Refactored hygraph-hello-world.ts to use ensureModel and ensureSimpleField utilities"
---

# Update hygraph-hello-world.ts to use ensure utilities

## Overview

Refactor `hygraph-hello-world.ts` to use the new `ensureModel` and `ensureSimpleField` utilities instead of directly calling Management SDK methods. This demonstrates the ensure pattern and provides better logging.

## Objectives

- [x] Import ensure utilities and urql client
- [x] Replace direct `createModel()` calls with `ensureModel()`
- [x] Replace direct `createSimpleField()` calls with `ensureSimpleField()`
- [x] Update environment variable names (HYGRAPH_MGMT_TOKEN, HYGRAPH_MGMT_ENDPOINT)
- [x] Add proper logging for creation vs. existence
- [x] Update model example (Blob → Yada)
- [x] Ensure proper async/await pattern

## Requirements

- Must use `ensureModel()` instead of direct `client.createModel()`
- Must use `ensureSimpleField()` instead of direct `client.createSimpleField()`
- Must pass proper type parameters (`BatchMigrationCreateModelInput`, `BatchMigrationCreateSimpleFieldInput`)
- Must call `mgmtClient.run(true)` after all ensure operations
- Must log whether items were created or already existed
- Must handle errors properly

## Implementation Details

### Step 1: Update imports
- Added imports:
  ```typescript
  import { hygraphContentClient } from './hygraph-urql-client';
  import { ensureModel, ensureSimpleField } from './hygraph-existence-utils';
  ```
- Updated Management SDK imports to include type imports:
  ```typescript
  import { Client, SimpleFieldType, type BatchMigrationCreateModelInput, type BatchMigrationCreateSimpleFieldInput } from '@hygraph/management-sdk';
  ```

### Step 2: Update environment variables
- Changed `HYGRAPH_TOKEN` → `HYGRAPH_MGMT_TOKEN`
- Changed `HYGRAPH_ENDPOINT` → `HYGRAPH_MGMT_ENDPOINT`
- Updated error messages accordingly

### Step 3: Refactor to use ensure utilities
- Wrapped operations in async `run()` function
- Replaced `createModel()` with:
  ```typescript
  const modelParams: BatchMigrationCreateModelInput = { ... };
  const modelResult = await ensureModel({
    ...modelParams,
    urqlClient: hygraphContentClient,
    mgmtClient: mgmtClient,
  });
  console.log(`Model ${apiId} ${modelResult.created ? 'does not exist, creating' : 'already exists, skipping creation'}`);
  ```
- Replaced `addFields()` with:
  ```typescript
  const fieldParams: BatchMigrationCreateSimpleFieldInput = { ... };
  const fieldResult = await ensureSimpleField({
    ...fieldParams,
    parentPluralApiId: apiIdPlural,
    urqlClient: hygraphContentClient,
    mgmtClient: mgmtClient,
  });
  console.log(`Field canExist ${fieldResult.created ? 'does not exist, creating' : 'already exists, skipping creation'}`);
  ```

### Step 4: Update example model
- Changed model from "Blob" to "Yada"
- Updated apiId: `'blob'` → `'Yada'`
- Updated apiIdPlural: `'blobs'` → `'Yadas'`
- Updated displayName and description accordingly

### Step 5: Execute queued operations
- After all ensure calls, execute:
  ```typescript
  const result = await mgmtClient.run(true);
  ```
- Added proper error handling and logging

## Acceptance Criteria

- [x] Imports updated correctly
- [x] Environment variables updated
- [x] Uses `ensureModel()` instead of direct calls
- [x] Uses `ensureSimpleField()` instead of direct calls
- [x] Proper type parameters used
- [x] Async/await pattern correct
- [x] Logging shows creation vs. existence
- [x] Operations executed via `mgmtClient.run(true)`
- [x] Error handling in place
- [x] Example model updated

## Dependencies

- Depends on: [Task 01-001-005](./01-001-005-create-ensure-utilities-with-generic-type-parameters.md)
- Blocks: None

## Related Tasks

- [Parent Task: Complete BaseArchetype](./01-001-complete-base-archetype.md)
- [Previous Task: Create ensure utilities](./01-001-005-create-ensure-utilities-with-generic-type-parameters.md)

## Notes

- This demonstrates the ensure pattern: check existence first, create only if missing
- Operations are queued and executed in a single batch via `mgmtClient.run(true)`
- Logging provides clear feedback about what was created vs. what already existed
- Environment variable names updated to distinguish Management API from Content API

## Progress Log

- **2025-11-13**: Task created retroactively
- **2025-11-13**: Updated imports and environment variables
- **2025-11-13**: Refactored to use ensureModel and ensureSimpleField
- **2025-11-13**: Updated example model and logging
- **2025-11-13**: Task completed

## References

- [Updated file: hygraph-hello-world.ts](../../src/experiments/hygraph-hello-world.ts)
- [Related utilities: hygraph-existence-utils.ts](../../src/experiments/hygraph-existence-utils.ts)
