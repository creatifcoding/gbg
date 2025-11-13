---
id: "01-001-004"
title: "Create existence check utilities using urql"
shortTitle: "create-existence-check-utilities-using-urql"
status: completed
phase: 1
phaseName: "foundation"
priority: medium
parent: "01-001"
children: []
dependsOn: ["01-001-003"]
blocks: ["01-001-005"]
assignee: null
labels: ["foundation", "hygraph", "urql", "existence-check"]
estimatedHours: 1
actualHours: 1
startDate: "2025-11-13"
dueDate: null
completedDate: "2025-11-13"
relatedTasks: []
relatedDocs: ["../../src/experiments/hygraph-existence-utils.ts"]
relatedIssues: []
notes: "Created read-only existence check utilities using GraphQL introspection via urql"
---

# Create existence check utilities using urql

## Overview

Create read-only utilities that use urql to query the Hygraph Content API and check if models and fields exist in the schema using GraphQL introspection. These utilities leverage Hygraph's auto-generated queries to probe schema existence.

## Objectives

- [x] Implement `modelExists()` function
- [x] Implement `fieldExists()` function
- [x] Use Hygraph's auto-generated single-entry queries for model checks
- [x] Use Hygraph's auto-generated plural queries for field checks
- [x] Handle GraphQL validation errors to determine existence
- [x] Export utilities for use in ensure functions

## Requirements

- Must use urql client for Content API queries
- Must use auto-generated query names (e.g., `post`, `posts`) based on API IDs
- Must interpret GraphQL validation errors to determine non-existence
- Must return boolean indicating existence
- Must handle errors gracefully (return false on unknown errors)
- Must be read-only (no mutations)

## Implementation Details

### Step 1: Implement modelExists() function
- Created `buildModelProbeQuery(apiId)` helper that generates:
  ```graphql
  query TestModelExists {
    ${apiId}(where: { id: "fake-id" }) {
      id
    }
  }
  ```
- Implemented `modelExists(client, apiId)` that:
  - Builds query using model API ID (e.g., "blob", "post")
  - Executes query via urql `client.query().toPromise()`
  - Checks for GraphQL validation error: `Cannot query field "${apiId}" on type "Query"`
  - Returns `false` if validation error found (model doesn't exist)
  - Returns `true` if query accepted by schema (model exists)
  - Handles network/other errors gracefully (returns false)

### Step 2: Implement fieldExists() function
- Created `buildFieldProbeQuery(pluralApiId, fieldApiId)` helper that generates:
  ```graphql
  query TestFieldExists {
    ${pluralApiId}(first: 1) {
      id
      ${fieldApiId}
    }
  }
  ```
- Implemented `fieldExists(client, pluralApiId, fieldApiId)` that:
  - Builds query using plural API ID (e.g., "blobs", "posts") and field API ID
  - Executes query via urql
  - Checks for GraphQL validation error: `Cannot query field "${fieldApiId}"`
  - Returns `false` if validation error found (field doesn't exist)
  - Returns `true` if query accepted by schema (field exists)
  - Handles errors gracefully

### Step 3: Export utilities
- Added functions to `packages/cms/src/experiments/hygraph-existence-utils.ts`
- Exported for use in ensure utilities

## Acceptance Criteria

- [x] `modelExists()` function implemented
- [x] `fieldExists()` function implemented
- [x] Uses auto-generated query names correctly
- [x] Interprets GraphQL errors correctly
- [x] Returns correct boolean values
- [x] Handles errors gracefully
- [x] Read-only (no mutations)
- [x] Functions exported and documented

## Dependencies

- Depends on: [Task 01-001-003](./01-001-003-add-urql-dependency-and-create-content-api-client.md)
- Blocks: [Task 01-001-005](./01-001-005-create-ensure-utilities-with-generic-type-parameters.md)

## Related Tasks

- [Parent Task: Complete BaseArchetype](./01-001-complete-base-archetype.md)
- [Previous Task: Add urql dependency](./01-001-003-add-urql-dependency-and-create-content-api-client.md)
- [Next Task: Create ensure utilities](./01-001-005-create-ensure-utilities-with-generic-type-parameters.md)

## Notes

- These utilities are purely read-only - they only query the Content API
- Existence is determined by schema validation, not by actual content
- Uses Hygraph's auto-generated queries as documented in their API reference
- GraphQL validation errors are the signal for non-existence

## Progress Log

- **2025-11-13**: Task created retroactively
- **2025-11-13**: Implemented `modelExists()` with GraphQL introspection
- **2025-11-13**: Implemented `fieldExists()` with GraphQL introspection
- **2025-11-13**: Added error handling and documentation
- **2025-11-13**: Task completed

## References

- [Hygraph Queries Documentation](https://hygraph.com/docs/api-reference/content-api/queries#fetching-a-single-entry)
- [urql One-off Queries](https://nearform.com/open-source/urql/docs/basics/core/#one-off-queries-and-mutations)
- [Created file: hygraph-existence-utils.ts](../../src/experiments/hygraph-existence-utils.ts)
