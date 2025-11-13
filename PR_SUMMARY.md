# PR Summary: Hygraph Existence Checking Utilities

## Branch
`feat/cms/hygraph-existence-utilities`

## Overview
Adds `urql`-based existence checking utilities for Hygraph models and fields, enabling programmatic schema management with conditional creation. Includes a preconfigured Content API client and ensure utilities that check existence before creating models/fields.

## Commits (2 total)

### 1. Urql Existence Checking Utilities
**Commit**: `feat(cms): add urql existence checking utilities`
- Added `urql` dependency to `packages/cms/package.json`
- Created `hygraph-urql-client.ts` - preconfigured urql client for Content API
- Created `hygraph-existence-utils.ts` with:
  - `modelExists()` - checks if a model exists via GraphQL introspection
  - `fieldExists()` - checks if a field exists within a model
  - `ensureModel()` - generic utility that checks and conditionally creates models
  - `ensureSimpleField()` - generic utility that checks and conditionally creates fields
- Updated `hygraph-hello-world.ts` to use ensure utilities with dotenv configuration
- All utilities use TypeScript generics for type-safe Management SDK integration

### 2. Task Documentation
**Commit**: `docs(tasks): add hygraph existence checking utilities subtasks`
- Added task 01-001-003: Add urql dependency and create Content API client
- Added task 01-001-004: Create existence check utilities using urql
- Added task 01-001-005: Create ensure utilities with generic type parameters
- Added task 01-001-006: Update hygraph-hello-world.ts to use ensure utilities
- Updated parent task 01-001 with new subtasks

## Files Changed

### Created
- `packages/cms/src/experiments/hygraph-urql-client.ts` - urql client for Content API
- `packages/cms/src/experiments/hygraph-existence-utils.ts` - existence checking and ensure utilities
- `packages/cms/tasks/phase-01-foundation/01-001-003-add-urql-dependency-and-create-content-api-client.md`
- `packages/cms/tasks/phase-01-foundation/01-001-004-create-existence-check-utilities-using-urql.md`
- `packages/cms/tasks/phase-01-foundation/01-001-005-create-ensure-utilities-with-generic-type-parameters.md`
- `packages/cms/tasks/phase-01-foundation/01-001-006-update-hygraph-hello-world-ts-to-use-ensure-utilities.md`

### Modified
- `packages/cms/package.json` - added `urql` and `@urql/core` dependencies
- `packages/cms/src/experiments/hygraph-hello-world.ts` - refactored to use ensure utilities
- `packages/cms/tasks/phase-01-foundation/01-001-complete-base-archetype.md` - updated with new subtasks

## Key Features
- ✅ GraphQL introspection-based existence checking (no ENVIRONMENT_READ permission required)
- ✅ Type-safe generic utilities for Management SDK integration
- ✅ Conditional creation pattern (check before create)
- ✅ Support for both model and field existence checks
- ✅ Handles Hygraph naming conventions (capitalized types)
- ✅ Preconfigured urql client with environment variable support

## Technical Details

### Existence Checking Strategy
- Uses GraphQL query compilation errors as existence signals
- Tries both API ID as-is and capitalized versions (Hygraph convention)
- Read-only Content API queries (no mutations)

### Type Safety
- Generic type parameters for Management SDK migration inputs
- `EnsureClients` type for required client instances
- Full TypeScript type inference for migration parameters

### Environment Variables
- `HYGRAPH_CONTENT_ENDPOINT` - Content API endpoint (required)
- `HYGRAPH_CONTENT_TOKEN` - Content API auth token (optional)
- `HYGRAPH_MGMT_TOKEN` - Management API auth token (required)
- `HYGRAPH_MGMT_ENDPOINT` - Management API endpoint (required)

## Testing
- Utilities tested with `hygraph-hello-world.ts` example
- Existence checks validated against Hygraph Content API
- Conditional creation verified (skips if already exists)

## Next Steps
1. Review PR
2. Merge to main
3. Continue with Phase 1 foundation tasks
4. Extend utilities for complex field types

## PR Link
https://github.com/creatifcoding/gbg/pull/new/feat/cms/hygraph-existence-utilities
