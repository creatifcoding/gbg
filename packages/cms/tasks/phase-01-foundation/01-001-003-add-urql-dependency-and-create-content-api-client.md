---
id: "01-001-003"
title: "Add urql dependency and create Content API client"
shortTitle: "add-urql-dependency-and-create-content-api-client"
status: completed
phase: 1
phaseName: "foundation"
priority: medium
parent: "01-001"
children: []
dependsOn: []
blocks: ["01-001-004"]
assignee: null
labels: ["foundation", "hygraph", "urql", "content-api"]
estimatedHours: 0.5
actualHours: 0.5
startDate: "2025-11-13"
dueDate: null
completedDate: "2025-11-13"
relatedTasks: []
relatedDocs: ["../../src/experiments/hygraph-urql-client.ts", "../../package.json"]
relatedIssues: []
notes: "Created urql client for read-only Content API queries to check schema existence"
---

# Add urql dependency and create Content API client

## Overview

Add urql dependency to enable GraphQL queries against the Hygraph Content API for schema introspection. Create a preconfigured urql client module for read-only existence checks.

## Objectives

- [x] Add urql dependency to package.json
- [x] Create hygraph-urql-client.ts module
- [x] Configure urql Client with Content API endpoint
- [x] Support optional authentication token
- [x] Export preconfigured client instance

## Requirements

- Must use urql's one-off query pattern (`client.query(query, variables).toPromise()`)
- Must read from `HYGRAPH_CONTENT_ENDPOINT` environment variable
- Must support optional `HYGRAPH_CONTENT_TOKEN` for authenticated queries
- Must use `cacheExchange` and `fetchExchange` exchanges
- Must throw error if Content API endpoint is not configured

## Implementation Details

### Step 1: Add urql dependency
- Added `urql` to `packages/cms/package.json` dependencies
- Version: `^4.0.7`

### Step 2: Create hygraph-urql-client.ts
- Created `packages/cms/src/experiments/hygraph-urql-client.ts`
- Configured urql Client with:
  - Content API endpoint from `HYGRAPH_CONTENT_ENDPOINT` env var
  - Optional auth token from `HYGRAPH_CONTENT_TOKEN` env var
  - `cacheExchange` and `fetchExchange` exchanges
  - Proper headers including Content-Type and optional Authorization
- Exported `hygraphContentClient` instance

## Acceptance Criteria

- [x] urql dependency added to package.json
- [x] hygraph-urql-client.ts module created
- [x] Client configured with Content API endpoint
- [x] Optional authentication supported
- [x] Error thrown if endpoint not configured
- [x] Client exported and ready for use

## Dependencies

- Depends on: None
- Blocks: [Task 01-001-004](./01-001-004-create-existence-check-utilities-using-urql.md)

## Related Tasks

- [Parent Task: Complete BaseArchetype](./01-001-complete-base-archetype.md)
- [Next Task: Create existence check utilities](./01-001-004-create-existence-check-utilities-using-urql.md)

## Notes

- This client is specifically for read-only queries against the Content API
- Used for schema introspection to check if models/fields exist
- Separate from Management SDK client which is used for mutations

## Progress Log

- **2025-11-13**: Task created retroactively
- **2025-11-13**: Added urql dependency to package.json
- **2025-11-13**: Created hygraph-urql-client.ts module with Content API configuration
- **2025-11-13**: Task completed

## References

- [urql Documentation](https://nearform.com/open-source/urql/docs/basics/core/#one-off-queries-and-mutations)
- [Hygraph Content API Documentation](https://hygraph.com/docs/api-reference/content-api/queries#fetching-a-single-entry)
- [Created file: hygraph-urql-client.ts](../../src/experiments/hygraph-urql-client.ts)
