---
id: "02-001"
title: "RichText field support"
shortTitle: "richtext-field-support"
status: pending
phase: 2
phaseName: "advanced-simple-fields"
priority: high
parent: null
children: []
dependsOn: []
blocks: []
assignee: null
labels: ["fields", "richtext", "advanced"]
estimatedHours: 3
actualHours: 0
startDate: null
dueDate: null
completedDate: null
relatedTasks: []
relatedDocs: ["../../src/l2/INTERNAL.md"]
relatedIssues: []
notes: "Implement RichText field mapping with embed support. Based on INTERNAL.md Phase 2 priorities."
---

# RichText field support

## Overview

Implement RichText field type support in the Archetype system. RichText fields support formatted content, markdown, and can embed other models.

## Objectives

- [ ] Map Effect Schema to RichText field type
- [ ] Support basic RichText fields
- [ ] Support RichText with embeds
- [ ] Support embeddable models configuration
- [ ] Add RichText annotations/metadata support

## Requirements

- Must use `SimpleFieldType.Richtext` from Management SDK
- Must support `embedsEnabled` flag
- Must support `embeddableModels` array
- Must follow Hygraph RichText field patterns
- Must integrate with existing field mapping system

## Implementation Details

### Step 1: Review RichText Documentation

Reference: [INTERNAL.md - RichText](../../../src/l2/INTERNAL.md#richtext)

Key points:
- GraphQL Type: `RichText`
- Management SDK: `SimpleFieldType.Richtext`
- Can enable embeds for specific models
- Supports formatting and visual representation

### Step 2: Add RichText Type Mapping

Extend the type mapper to handle RichText:
- Detect RichText annotation/metadata
- Map to `SimpleFieldType.Richtext`
- Extract embed configuration if present

### Step 3: Implement Basic RichText Field

```typescript
// Basic richtext field
client.createSimpleField({
  parentApiId: 'Page',
  type: SimpleFieldType.Richtext,
  apiId: 'content',
  displayName: 'Content',
  isRequired: true,
});
```

### Step 4: Implement RichText with Embeds

```typescript
// Richtext with embeds
client.createSimpleField({
  parentApiId: 'Page',
  type: SimpleFieldType.Richtext,
  apiId: 'contentExtended',
  displayName: 'Content Extended',
  embedsEnabled: true,
  embeddableModels: ['Author'],
});
```

### Step 5: Add Effect Schema Annotation

Create annotation/metadata system for RichText:
- `hygraph({ type: "Richtext" })`
- `hygraph({ type: "Richtext", embedsEnabled: true, embeddableModels: [...] })`

## Acceptance Criteria

- [ ] RichText fields can be created via Archetype
- [ ] Basic RichText fields work
- [ ] RichText with embeds works
- [ ] Embeddable models can be configured
- [ ] Annotation system supports RichText metadata
- [ ] Tests pass for RichText field creation

## Dependencies

- Depends on: Phase 1 (foundation) - BaseArchetype and simple field mapping
- Blocks: None (can be parallel with other Phase 2 tasks)

## Related Tasks

- [02-002 - JSON field support](./02-002-json-field-support.md) (parallel)
- [02-003 - Color field support](./02-003-color-field-support.md) (parallel)
- [02-004 - Location field support](./02-004-location-field-support.md) (parallel)
- [02-005 - Validation framework](./02-005-validation-framework.md) (parallel)

## Notes

- RichText is a simple field type, not complex
- Embeds are optional but powerful feature
- Can embed multiple model types
- RichText content is stored as structured data

## Progress Log

- **2024-11-13**: Task created

## References

- [Hygraph Field Types - Rich Text](https://hygraph.com/docs/api-reference/schema/field-types#rich-text)
- [Hygraph Management SDK - Richtext Field Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#richtext-field)
- [Hygraph Management SDK - Richtext with Embeds Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#richtext-with-embeds-and-single-allowed-embeddable-model)
- [Internal Documentation](../../../src/l2/INTERNAL.md#richtext)

