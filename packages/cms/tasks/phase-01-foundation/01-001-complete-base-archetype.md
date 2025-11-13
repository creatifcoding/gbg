---
id: "01-001"
title: "Complete BaseArchetype"
shortTitle: "complete-base-archetype"
status: pending
phase: 1
phaseName: "foundation"
priority: high
parent: null
children: ["01-001-001", "01-001-002"]
dependsOn: []
blocks: []
assignee: null
labels: ["foundation", "schema"]
estimatedHours: 8
actualHours: 0
startDate: null
dueDate: null
completedDate: null
relatedTasks: []
relatedDocs: ["../../src/l1/index.ts", "../../src/l2/INTERNAL.md"]
relatedIssues: []
notes: "Foundation task for all archetypes"
---

# Complete BaseArchetype

## Overview

Complete the `BaseArchetype` class that extends `Schema.TaggedClass` and provides the foundation for all archetypes. This is the base layer (L1) of the archetype system.

## Objectives

- [ ] Implement BaseArchetype class structure
- [ ] Ensure proper extension of Schema.TaggedClass
- [ ] Verify system fields are NOT included (they're automatic in Hygraph)
- [ ] Add proper TypeScript types

## Requirements

- Must extend `Schema.TaggedClass`
- Must NOT include system fields (id, createdAt, updatedAt) - these are automatic
- Must be composable (other archetypes extend this)
- Must follow Effect Schema patterns

## Implementation Details

### Step 1: Review Current Structure
- Check existing `packages/cms/src/l1/index.ts`
- Verify it uses `Schema.TaggedClass` correctly
- Ensure no system fields are defined

### Step 2: Complete BaseArchetype
- Extend `Schema.TaggedClass<BaseArchetype>`
- Use proper tag: `"@gbg/schemas/BaseArchetype"`
- Use tag value: `"BaseArchetype"`
- Define empty struct (system fields come from Hygraph automatically)

### Step 3: Add Type Exports
- Export BaseArchetype class
- Export any related types
- Update `packages/cms/src/index.ts` if needed

## Acceptance Criteria

- [ ] BaseArchetype class exists and extends Schema.TaggedClass
- [ ] No system fields defined in schema (id, createdAt, updatedAt)
- [ ] Class can be imported and used
- [ ] Other classes can extend BaseArchetype
- [ ] TypeScript types are correct
- [ ] Documentation updated

## Dependencies

- Depends on: None (foundation task)
- Blocks: [Task 01-001-001](./01-001-001-implement-base-archetype-class.md), [Task 01-001-002](./01-001-002-add-typescript-types-exports.md)

## Related Tasks

- [Subtask: Implement BaseArchetype class structure](./01-001-001-implement-base-archetype-class.md)
- [Subtask: Add TypeScript types and exports](./01-001-002-add-typescript-types-exports.md)

## Notes

- System fields (id, createdAt, updatedAt, publishedAt, etc.) are automatically added by Hygraph
- We should NOT create these fields via Management SDK
- BaseArchetype is purely for TypeScript type safety and composition

## Progress Log

- **2024-11-12**: Task created

## References

- [Hygraph System Fields Documentation](https://hygraph.com/docs/api-reference/schema/system-fields#default-model-fields)
- [Effect Schema TaggedClass Documentation](https://effect.website/docs/schema/classes)
- [Internal Documentation](../../src/l2/INTERNAL.md)

