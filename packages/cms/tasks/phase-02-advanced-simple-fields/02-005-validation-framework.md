---
id: "02-005"
title: "Validation framework"
shortTitle: "validation-framework"
status: pending
phase: 2
phaseName: "advanced-simple-fields"
priority: high
parent: null
children: []
dependsOn: []
blocks: []
assignee: null
labels: ["validation", "framework", "advanced"]
estimatedHours: 4
actualHours: 0
startDate: null
dueDate: null
completedDate: null
relatedTasks: []
relatedDocs: ["../../src/l2/INTERNAL.md"]
relatedIssues: []
notes: "Build comprehensive validation extraction from Schema.filter and apply to Hygraph fields. Based on INTERNAL.md Phase 2 priorities."
---

# Validation framework

## Overview

Build a comprehensive validation framework that extracts validation logic from Effect Schema filters and applies them to Hygraph field configurations.

## Objectives

- [ ] Extract validation logic from Schema.filter
- [ ] Map Effect Schema validations to Hygraph validations
- [ ] Support String validations (regex, length)
- [ ] Support Number validations (min/max range)
- [ ] Support Date/DateTime validations (range constraints)
- [ ] Create validation extraction utilities

## Requirements

- Must extract validations from `Schema.filter(T, fn)`
- Must map to Hygraph validation format
- Must support all validation types from INTERNAL.md
- Must integrate with existing field mapping system
- Must preserve validation error messages

## Implementation Details

### Step 1: Review Validation Documentation

Reference: [INTERNAL.md - Field Configuration - Validations](../../../src/l2/INTERNAL.md#validations)

Key points:
- String: Regex patterns, length constraints
- Number: Range (min/max), whole number constraints
- Date/DateTime: Date range constraints
- Validation format in Management SDK

### Step 2: Analyze Schema.filter Structure

Understand how Effect Schema filters work:
- Filter functions contain validation logic
- Need to extract and parse filter logic
- Map to Hygraph validation format

### Step 3: Implement String Validations

```typescript
// String validation example
validations: {
  String: {
    matches: {
      regex: '^([a-z0-9_\\.\\+-]+)@([\\da-z\\.-]+)\\.([a-z\\.]{2,6})$',
    },
  },
}
```

Extract from:
```typescript
Schema.String.pipe(
  Schema.filter(s => /^([a-z0-9_\.\+-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})$/.test(s))
)
```

### Step 4: Implement Number Validations

```typescript
// Number validation example
validations: {
  Int: {
    range: {
      max: 1000,
      min: 0,
      errorMessage: 'Counter has to be between 0 and 1000',
    },
  },
}
```

Extract from:
```typescript
Schema.Number.pipe(
  Schema.filter(n => n >= 0 && n <= 1000)
)
```

### Step 5: Implement Date Validations

```typescript
// Date validation example
validations: {
  Date: {
    range: {
      min: '2024-01-01',
      max: '2024-12-31',
    },
  },
}
```

### Step 6: Create Validation Extractor

Build utility to:
- Parse Schema.filter functions
- Extract validation logic
- Map to Hygraph format
- Preserve error messages

## Acceptance Criteria

- [ ] String regex validations extracted and applied
- [ ] String length validations extracted and applied
- [ ] Number range validations extracted and applied
- [ ] Date range validations extracted and applied
- [ ] Validation error messages preserved
- [ ] Tests pass for all validation types
- [ ] Validation extraction utility works

## Dependencies

- Depends on: Phase 1 (foundation) - BaseArchetype and field mapping
- Blocks: None (can be parallel with other Phase 2 tasks, but enhances them)

## Related Tasks

- [02-001 - RichText field support](./02-001-richtext-field-support.md) (can use validations)
- [02-002 - JSON field support](./02-002-json-field-support.md) (can use validations)
- [02-003 - Color field support](./02-003-color-field-support.md) (can use validations)
- [02-004 - Location field support](./02-004-location-field-support.md) (can use validations)

## Notes

- Validation extraction is complex - may need AST parsing
- Some validations may not be directly mappable
- Error messages should be preserved when possible
- Framework should be extensible for future validation types

## Progress Log

- **2024-11-13**: Task created

## References

- [Hygraph Field Configuration - Validations](https://hygraph.com/docs/api-reference/schema/field-configuration#validations)
- [Hygraph Management SDK - Email Validation Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#required--unique-string-field-with-custom-regex-validation-for-emails)
- [Hygraph Management SDK - Hidden Integer Field Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#hidden-integer-field-with-custom-field-validation)
- [Internal Documentation](../../../src/l2/INTERNAL.md#field-configuration)

