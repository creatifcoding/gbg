---
id: "01-001-001"
title: "Implement BaseArchetype class structure"
shortTitle: "implement-archetype-class"
status: pending
phase: 1
phaseName: "foundation"
priority: high
parent: "01-001"
children: []
dependsOn: []
blocks: []
assignee: null
labels: ["foundation", "schema", "implementation"]
estimatedHours: 2
actualHours: 0
startDate: null
dueDate: null
completedDate: null
relatedTasks: []
relatedDocs: ["../../src/l1/index.ts"]
relatedIssues: []
notes: ""
---

# Implement BaseArchetype class structure

## Overview

Implement the actual BaseArchetype class extending Schema.TaggedClass with proper structure.

## Objectives

- [ ] Create BaseArchetype class
- [ ] Extend Schema.TaggedClass correctly
- [ ] Use proper tag identifier
- [ ] Define empty struct (no system fields)

## Requirements

- Must use `Schema.TaggedClass<BaseArchetype>`
- Tag must be `"@gbg/schemas/BaseArchetype"`
- Tag value must be `"BaseArchetype"`
- Struct must be empty `{}` (system fields are automatic)

## Implementation Details

### Step 1: Import Required Modules
```typescript
import { Schema } from "effect";
```

### Step 2: Define BaseArchetype Class
```typescript
export class BaseArchetype extends Schema.TaggedClass<BaseArchetype>(
  "@gbg/schemas/BaseArchetype"
)("BaseArchetype", {}) {}
```

### Step 3: Verify Structure
- Check that class extends TaggedClass correctly
- Verify tag format
- Ensure empty struct

## Acceptance Criteria

- [ ] BaseArchetype class exists
- [ ] Extends Schema.TaggedClass correctly
- [ ] Uses proper tag format
- [ ] Empty struct defined
- [ ] No system fields in struct
- [ ] Code compiles without errors

## Dependencies

- Depends on: None
- Blocks: [Task 01-001-002](./01-001-002-add-typescript-types-exports.md)

## Related Tasks

- [Parent Task: Complete BaseArchetype](./01-001-complete-base-archetype.md)

## Notes

The empty struct `{}` is intentional - system fields are automatically provided by Hygraph.

## Progress Log

- **2024-11-12**: Task created

## References

- [Effect Schema TaggedClass](https://effect.website/docs/schema/classes)
- [Internal Documentation](../../src/l2/INTERNAL.md#basehygraphmodel-correction)

