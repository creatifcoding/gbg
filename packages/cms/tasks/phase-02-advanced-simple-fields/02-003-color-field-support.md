---
id: "02-003"
title: "Color field support"
shortTitle: "color-field-support"
status: pending
phase: 2
phaseName: "advanced-simple-fields"
priority: medium
parent: null
children: []
dependsOn: []
blocks: []
assignee: null
labels: ["fields", "color", "advanced"]
estimatedHours: 1
actualHours: 0
startDate: null
dueDate: null
completedDate: null
relatedTasks: []
relatedDocs: ["../../src/l2/INTERNAL.md"]
relatedIssues: []
notes: "Implement Color field type support for hex color codes. Based on INTERNAL.md Phase 2 priorities."
---

# Color field support

## Overview

Implement Color field type support in the Archetype system. Color fields store hex color codes with UI color picker support.

## Objectives

- [ ] Map Effect Schema to Color field type
- [ ] Support Color field creation
- [ ] Add Color field annotations/metadata support
- [ ] Ensure proper hex format validation

## Requirements

- Must use `SimpleFieldType.Color` from Management SDK
- Must support hex color format (#RRGGBB)
- Must follow Hygraph Color field patterns
- Must integrate with existing field mapping system

## Implementation Details

### Step 1: Review Color Documentation

Reference: [INTERNAL.md - Color](../../../src/l2/INTERNAL.md#color)

Key points:
- GraphQL Type: `Color`
- Management SDK: `SimpleFieldType.Color`
- Format: Hex color codes
- UI provides color picker

### Step 2: Add Color Type Mapping

Extend the type mapper to handle Color:
- Detect Color annotation/metadata
- Map to `SimpleFieldType.Color`
- Handle hex color validation

### Step 3: Implement Color Field Creation

```typescript
// Color field
client.createSimpleField({
  parentApiId: 'Page',
  type: SimpleFieldType.Color,
  apiId: 'primaryColor',
  displayName: 'Primary Color',
  isRequired: false,
});
```

### Step 4: Add Effect Schema Annotation

Create annotation/metadata system for Color:
- `hygraph({ type: "Color" })`
- Support hex color string validation

## Acceptance Criteria

- [ ] Color fields can be created via Archetype
- [ ] Color fields accept hex format
- [ ] Annotation system supports Color metadata
- [ ] GraphQL type is correct (`Color`)
- [ ] Tests pass for Color field creation

## Dependencies

- Depends on: Phase 1 (foundation) - BaseArchetype and simple field mapping
- Blocks: None (can be parallel with other Phase 2 tasks)

## Related Tasks

- [02-001 - RichText field support](./02-001-richtext-field-support.md) (parallel)
- [02-002 - JSON field support](./02-002-json-field-support.md) (parallel)
- [02-004 - Location field support](./02-004-location-field-support.md) (parallel)
- [02-005 - Validation framework](./02-005-validation-framework.md) (parallel)

## Notes

- Color fields are simple but useful
- Hex format is standard (#RRGGBB)
- UI provides color picker automatically
- Useful for theming, branding, etc.

## Progress Log

- **2024-11-13**: Task created

## References

- [Hygraph Field Types - Color](https://hygraph.com/docs/api-reference/schema/field-types#color)
- [Internal Documentation](../../../src/l2/INTERNAL.md#color)

