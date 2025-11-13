---
id: "02-002"
title: "JSON field support"
shortTitle: "json-field-support"
status: pending
phase: 2
phaseName: "advanced-simple-fields"
priority: high
parent: null
children: []
dependsOn: []
blocks: []
assignee: null
labels: ["fields", "json", "advanced"]
estimatedHours: 2
actualHours: 0
startDate: null
dueDate: null
completedDate: null
relatedTasks: []
relatedDocs: ["../../src/l2/INTERNAL.md"]
relatedIssues: []
notes: "Implement JSON field type support for flexible structured data. Based on INTERNAL.md Phase 2 priorities."
---

# JSON field support

## Overview

Implement JSON field type support in the Archetype system. JSON fields allow flexible structured data storage without predefined schema.

## Objectives

- [ ] Map Effect Schema to JSON field type
- [ ] Support JSON field creation
- [ ] Add JSON field annotations/metadata support
- [ ] Ensure proper GraphQL type mapping

## Requirements

- Must use `SimpleFieldType.Json` from Management SDK
- Must support flexible data structures
- Must follow Hygraph JSON field patterns
- Must integrate with existing field mapping system

## Implementation Details

### Step 1: Review JSON Documentation

Reference: [INTERNAL.md - JSON](../../../src/l2/INTERNAL.md#json)

Key points:
- GraphQL Type: `Json`
- Management SDK: `SimpleFieldType.Json`
- Use Case: Flexible structured data
- No predefined schema required

### Step 2: Add JSON Type Mapping

Extend the type mapper to handle JSON:
- Detect JSON annotation/metadata
- Map to `SimpleFieldType.Json`
- Handle Effect Schema JSON types

### Step 3: Implement JSON Field Creation

```typescript
// JSON field
client.createSimpleField({
  parentApiId: 'Page',
  type: SimpleFieldType.Json,
  apiId: 'metadata',
  displayName: 'Metadata',
  isRequired: false,
});
```

### Step 4: Add Effect Schema Annotation

Create annotation/metadata system for JSON:
- `hygraph({ type: "Json" })`
- Support for Schema.Unknown or Schema.Any

## Acceptance Criteria

- [ ] JSON fields can be created via Archetype
- [ ] JSON fields accept flexible data
- [ ] Annotation system supports JSON metadata
- [ ] GraphQL type is correct (`Json`)
- [ ] Tests pass for JSON field creation

## Dependencies

- Depends on: Phase 1 (foundation) - BaseArchetype and simple field mapping
- Blocks: None (can be parallel with other Phase 2 tasks)

## Related Tasks

- [02-001 - RichText field support](./02-001-richtext-field-support.md) (parallel)
- [02-003 - Color field support](./02-003-color-field-support.md) (parallel)
- [02-004 - Location field support](./02-004-location-field-support.md) (parallel)
- [02-005 - Validation framework](./02-005-validation-framework.md) (parallel)

## Notes

- JSON fields are useful for flexible metadata
- No schema validation at field level
- Data structure is flexible
- Useful for configuration, settings, etc.

## Progress Log

- **2024-11-13**: Task created

## References

- [Hygraph Field Types - JSON](https://hygraph.com/docs/api-reference/schema/field-types#json)
- [Internal Documentation](../../../src/l2/INTERNAL.md#json)

