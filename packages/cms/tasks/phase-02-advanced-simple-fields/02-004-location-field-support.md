---
id: "02-004"
title: "Location field support"
shortTitle: "location-field-support"
status: pending
phase: 2
phaseName: "advanced-simple-fields"
priority: medium
parent: null
children: []
dependsOn: []
blocks: []
assignee: null
labels: ["fields", "location", "advanced"]
estimatedHours: 2
actualHours: 0
startDate: null
dueDate: null
completedDate: null
relatedTasks: []
relatedDocs: ["../../src/l2/INTERNAL.md"]
relatedIssues: []
notes: "Implement Location field type support for geographic data. Based on INTERNAL.md Phase 2 priorities."
---

# Location field support

## Overview

Implement Location field type support in the Archetype system. Location fields store geographic data including latitude, longitude, and address.

## Objectives

- [ ] Map Effect Schema to Location field type
- [ ] Support Location field creation
- [ ] Add Location field annotations/metadata support
- [ ] Ensure proper geographic data structure

## Requirements

- Must use `SimpleFieldType.Location` from Management SDK
- Must support latitude, longitude, address
- Must follow Hygraph Location field patterns
- Must integrate with existing field mapping system

## Implementation Details

### Step 1: Review Location Documentation

Reference: [INTERNAL.md - Location](../../../src/l2/INTERNAL.md#location)

Key points:
- GraphQL Type: `Location`
- Management SDK: `SimpleFieldType.Location`
- Contains: Latitude, longitude, address
- Useful for maps, geocoding, etc.

### Step 2: Add Location Type Mapping

Extend the type mapper to handle Location:
- Detect Location annotation/metadata
- Map to `SimpleFieldType.Location`
- Handle geographic data structure

### Step 3: Implement Location Field Creation

```typescript
// Location field
client.createSimpleField({
  parentApiId: 'Page',
  type: SimpleFieldType.Location,
  apiId: 'address',
  displayName: 'Address',
  isRequired: false,
});
```

### Step 4: Add Effect Schema Annotation

Create annotation/metadata system for Location:
- `hygraph({ type: "Location" })`
- Support for structured location data

## Acceptance Criteria

- [ ] Location fields can be created via Archetype
- [ ] Location fields accept geographic data
- [ ] Annotation system supports Location metadata
- [ ] GraphQL type is correct (`Location`)
- [ ] Tests pass for Location field creation

## Dependencies

- Depends on: Phase 1 (foundation) - BaseArchetype and simple field mapping
- Blocks: None (can be parallel with other Phase 2 tasks)

## Related Tasks

- [02-001 - RichText field support](./02-001-richtext-field-support.md) (parallel)
- [02-002 - JSON field support](./02-002-json-field-support.md) (parallel)
- [02-003 - Color field support](./02-003-color-field-support.md) (parallel)
- [02-005 - Validation framework](./02-005-validation-framework.md) (parallel)

## Notes

- Location fields contain structured geographic data
- Useful for maps, geocoding, location-based features
- Data includes lat, lng, and optional address
- Can be used for store locators, event venues, etc.

## Progress Log

- **2024-11-13**: Task created

## References

- [Hygraph Field Types - Location](https://hygraph.com/docs/api-reference/schema/field-types#location)
- [Internal Documentation](../../../src/l2/INTERNAL.md#location)

