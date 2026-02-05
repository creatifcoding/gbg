/**
 * Workflow Definition Events — Unit Tests
 *
 * Tests for 5 workflow definition lifecycle events:
 * 1. DefinitionCreated - New workflow definition created
 * 2. DefinitionVersioned - New version of existing definition
 * 3. DefinitionActivated - Definition activated for use
 * 4. DefinitionDeprecated - Definition marked deprecated
 * 5. DefinitionArchived - Definition archived (no longer usable)
 *
 * Note: The _tag field is inherited from BaseOperationalEvent ('BaseOperationalEvent').
 * Event type discrimination happens via schema matching, not the instance _tag.
 *
 * @module
 * @see EL-3.11-12 for workflow definition event requirements
 */

import { describe, it, expect } from 'vitest'
import { Schema, DateTime, Option } from 'effect'
import {
  // Events
  DefinitionCreated,
  DefinitionVersioned,
  DefinitionActivated,
  DefinitionDeprecated,
  DefinitionArchived,

  // Supporting Types
  TaskTemplate,
  VersionChange,

  // Union and Constants
  WORKFLOW_DEFINITION_EVENT_TAGS,
  type WorkflowDefinitionEvent,
  type WorkflowDefinitionEventTag,
} from '../workflow-definition-events'
import { WorkflowDefinitionId, AssetId, EventId } from '../../../identifiers'

// =============================================================================
// Test Fixtures
// =============================================================================

const mockDefinitionId = 'WF-maintenance-v1' as WorkflowDefinitionId
const mockAssetId = 'PLANT-001' as AssetId
const makeEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2)}` as EventId

const baseEventFields = {
  eventId: makeEventId(),
  occurredAt: DateTime.unsafeNow(),
  causedBy: 'system',
  entityId: mockDefinitionId as unknown as AssetId,
  entityType: 'workcell' as const,
  correlationId: Option.none<string>(),
  schemaVersion: 1,
}

const mockTaskTemplates: Schema.Schema.Type<typeof TaskTemplate>[] = [
  {
    taskDefinitionId: 'TDEF-step-1' as any,
    name: 'Pre-flight Check',
    description: Option.some('Verify equipment is safe to work on'),
    estimatedDurationMinutes: Option.some(15),
    requiredApprovals: 0,
    dependencies: [],
    order: 1,
  },
  {
    taskDefinitionId: 'TDEF-step-2' as any,
    name: 'Main Procedure',
    description: Option.some('Execute main maintenance procedure'),
    estimatedDurationMinutes: Option.some(60),
    requiredApprovals: 1,
    dependencies: ['TDEF-step-1' as any],
    order: 2,
  },
]

// =============================================================================
// Test: TaskTemplate Schema
// =============================================================================

describe('TaskTemplate Schema', () => {
  it('should create a valid TaskTemplate', () => {
    const template = Schema.decodeSync(TaskTemplate)({
      taskDefinitionId: 'TDEF-step-1',
      name: 'Pre-flight Check',
      description: 'Verify equipment',
      estimatedDurationMinutes: 15,
      requiredApprovals: 0,
      dependencies: [],
      order: 1,
    })

    expect(template.taskDefinitionId).toBe('TDEF-step-1')
    expect(template.name).toBe('Pre-flight Check')
    expect(Option.isSome(template.description)).toBe(true)
    expect(template.order).toBe(1)
  })

  it('should handle optional fields as none', () => {
    const template = Schema.decodeSync(TaskTemplate)({
      taskDefinitionId: 'TDEF-step-1',
      name: 'Simple Task',
      requiredApprovals: 0,
      dependencies: [],
      order: 1,
    })

    expect(Option.isNone(template.description)).toBe(true)
    expect(Option.isNone(template.estimatedDurationMinutes)).toBe(true)
  })
})

// =============================================================================
// Test: VersionChange Schema
// =============================================================================

describe('VersionChange Schema', () => {
  it('should create a valid VersionChange', () => {
    const change = Schema.decodeSync(VersionChange)({
      field: 'taskTemplates',
      oldValue: 'Step 1: Check',
      newValue: 'Step 1: Pre-check',
      changeReason: 'Clarified step name',
    })

    expect(change.field).toBe('taskTemplates')
    expect(Option.isSome(change.changeReason)).toBe(true)
  })
})

// =============================================================================
// Test: DefinitionCreated Event
// =============================================================================

describe('DefinitionCreated Event', () => {
  it('should create a valid DefinitionCreated event with correct fields', () => {
    const event = new DefinitionCreated({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      name: 'Preventive Maintenance Workflow',
      version: '1.0.0',
      createdBy: 'engineer-001',
      description: Option.some('Standard PM workflow for production lines'),
      taskTemplates: mockTaskTemplates,
    })

    expect(event.definitionId).toBe(mockDefinitionId)
    expect(event.name).toBe('Preventive Maintenance Workflow')
    expect(event.version).toBe('1.0.0')
    expect(event.createdBy).toBe('engineer-001')
    expect(event.taskTemplates).toHaveLength(2)
  })

  it('should encode and decode correctly', () => {
    const event = new DefinitionCreated({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      name: 'Simple Workflow',
      version: '1.0.0',
      createdBy: 'system',
      description: Option.none(),
      taskTemplates: [],
    })

    const encoded = Schema.encodeSync(DefinitionCreated)(event)
    const decoded = Schema.decodeSync(DefinitionCreated)(encoded)

    expect(decoded.definitionId).toBe(mockDefinitionId)
    expect(decoded.name).toBe('Simple Workflow')
    expect(decoded.taskTemplates).toHaveLength(0)
  })

  it('should reject empty workflow name', () => {
    expect(() => {
      new DefinitionCreated({
        ...baseEventFields,
        definitionId: mockDefinitionId,
        name: '' as any, // Invalid: empty string for NonEmptyString
        version: '1.0.0',
        createdBy: 'system',
        description: Option.none(),
        taskTemplates: [],
      })
    }).toThrow()
  })
})

// =============================================================================
// Test: DefinitionVersioned Event
// =============================================================================

describe('DefinitionVersioned Event', () => {
  it('should create a valid DefinitionVersioned event with changes', () => {
    const event = new DefinitionVersioned({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      previousVersion: '1.0.0',
      newVersion: '1.1.0',
      changes: [
        {
          field: 'taskTemplates',
          oldValue: Option.some('Old step description'),
          newValue: Option.some('New step description'),
          changeReason: Option.some('Clarified instructions'),
        },
      ],
      versionedBy: 'engineer-001',
      changeNotes: Option.some('Updated task descriptions for clarity'),
    })

    expect(event.previousVersion).toBe('1.0.0')
    expect(event.newVersion).toBe('1.1.0')
    expect(event.changes).toHaveLength(1)
    expect(event.versionedBy).toBe('engineer-001')
  })

  it('should support empty changes array (metadata-only version)', () => {
    const event = new DefinitionVersioned({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      previousVersion: '1.0.0',
      newVersion: '1.0.1',
      changes: [],
      versionedBy: 'system',
      changeNotes: Option.some('Version bump for compatibility'),
    })

    expect(event.changes).toHaveLength(0)
  })
})

// =============================================================================
// Test: DefinitionActivated Event
// =============================================================================

describe('DefinitionActivated Event', () => {
  it('should create a valid DefinitionActivated event', () => {
    const effectiveFrom = DateTime.unsafeNow()

    const event = new DefinitionActivated({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      version: '1.0.0',
      activatedBy: 'manager-001',
      effectiveFrom: effectiveFrom,
      previousActiveVersion: Option.some('0.9.0'),
      notes: Option.some('Approved for production use'),
    })

    expect(event.version).toBe('1.0.0')
    expect(event.activatedBy).toBe('manager-001')
    expect(Option.isSome(event.previousActiveVersion)).toBe(true)
    expect(Option.getOrElse(event.previousActiveVersion, () => '')).toBe('0.9.0')
  })

  it('should allow first activation without previous version', () => {
    const event = new DefinitionActivated({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      version: '1.0.0',
      activatedBy: 'admin',
      effectiveFrom: DateTime.unsafeNow(),
      previousActiveVersion: Option.none(),
      notes: Option.none(),
    })

    expect(Option.isNone(event.previousActiveVersion)).toBe(true)
    expect(Option.isNone(event.notes)).toBe(true)
  })
})

// =============================================================================
// Test: DefinitionDeprecated Event
// =============================================================================

describe('DefinitionDeprecated Event', () => {
  it('should create a valid DefinitionDeprecated event with replacement', () => {
    const replacementId = 'WF-maintenance-v2' as WorkflowDefinitionId

    const event = new DefinitionDeprecated({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      version: '1.0.0',
      deprecatedBy: 'manager-001',
      reason: 'Replaced by improved workflow v2',
      replacementId: Option.some(replacementId),
      deprecationDate: DateTime.unsafeNow(),
      sunsetDate: Option.some(DateTime.unsafeNow()), // When it becomes unavailable
    })

    expect(event.deprecatedBy).toBe('manager-001')
    expect(event.reason).toBe('Replaced by improved workflow v2')
    expect(Option.isSome(event.replacementId)).toBe(true)
    expect(Option.getOrElse(event.replacementId, () => '' as any)).toBe(replacementId)
  })

  it('should allow deprecation without replacement', () => {
    const event = new DefinitionDeprecated({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      version: '1.0.0',
      deprecatedBy: 'system',
      reason: 'No longer applicable to current equipment',
      replacementId: Option.none(),
      deprecationDate: DateTime.unsafeNow(),
      sunsetDate: Option.none(),
    })

    expect(Option.isNone(event.replacementId)).toBe(true)
    expect(Option.isNone(event.sunsetDate)).toBe(true)
  })

  it('should reject empty deprecation reason', () => {
    expect(() => {
      new DefinitionDeprecated({
        ...baseEventFields,
        definitionId: mockDefinitionId,
        version: '1.0.0',
        deprecatedBy: 'manager',
        reason: '' as any, // Invalid: empty string for NonEmptyString
        replacementId: Option.none(),
        deprecationDate: DateTime.unsafeNow(),
        sunsetDate: Option.none(),
      })
    }).toThrow()
  })
})

// =============================================================================
// Test: DefinitionArchived Event
// =============================================================================

describe('DefinitionArchived Event', () => {
  it('should create a valid DefinitionArchived event', () => {
    const event = new DefinitionArchived({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      version: '1.0.0',
      archivedBy: 'admin-001',
      reason: 'Workflow superseded and no longer in use',
      archiveReference: Option.some('ARCHIVE-2026-001'),
      retentionPeriodDays: Option.some(365 * 7), // 7 years for compliance
    })

    expect(event.archivedBy).toBe('admin-001')
    expect(event.reason).toBe('Workflow superseded and no longer in use')
    expect(Option.isSome(event.archiveReference)).toBe(true)
    expect(Option.getOrElse(event.retentionPeriodDays, () => 0)).toBe(365 * 7)
  })

  it('should allow archival without retention period', () => {
    const event = new DefinitionArchived({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      version: '1.0.0',
      archivedBy: 'system',
      reason: 'Cleanup of obsolete definitions',
      archiveReference: Option.none(),
      retentionPeriodDays: Option.none(),
    })

    expect(Option.isNone(event.archiveReference)).toBe(true)
    expect(Option.isNone(event.retentionPeriodDays)).toBe(true)
  })

  it('should reject empty archive reason', () => {
    expect(() => {
      new DefinitionArchived({
        ...baseEventFields,
        definitionId: mockDefinitionId,
        version: '1.0.0',
        archivedBy: 'admin',
        reason: '' as any, // Invalid: empty string for NonEmptyString
        archiveReference: Option.none(),
        retentionPeriodDays: Option.none(),
      })
    }).toThrow()
  })
})

// =============================================================================
// Test: WORKFLOW_DEFINITION_EVENT_TAGS Constant
// =============================================================================

describe('WORKFLOW_DEFINITION_EVENT_TAGS', () => {
  it('should contain all 5 workflow definition event tags', () => {
    expect(WORKFLOW_DEFINITION_EVENT_TAGS).toHaveLength(5)
    expect(WORKFLOW_DEFINITION_EVENT_TAGS).toContain('DefinitionCreated')
    expect(WORKFLOW_DEFINITION_EVENT_TAGS).toContain('DefinitionVersioned')
    expect(WORKFLOW_DEFINITION_EVENT_TAGS).toContain('DefinitionActivated')
    expect(WORKFLOW_DEFINITION_EVENT_TAGS).toContain('DefinitionDeprecated')
    expect(WORKFLOW_DEFINITION_EVENT_TAGS).toContain('DefinitionArchived')
  })
})

// =============================================================================
// Test: WorkflowDefinitionEvent Union Type
// =============================================================================

describe('WorkflowDefinitionEvent Union Type', () => {
  it('should allow all workflow definition event types in union', () => {
    const events: WorkflowDefinitionEvent[] = [
      new DefinitionCreated({
        ...baseEventFields,
        definitionId: mockDefinitionId,
        name: 'Test Workflow',
        version: '1.0.0',
        createdBy: 'user',
        description: Option.none(),
        taskTemplates: [],
      }),
      new DefinitionActivated({
        ...baseEventFields,
        definitionId: mockDefinitionId,
        version: '1.0.0',
        activatedBy: 'admin',
        effectiveFrom: DateTime.unsafeNow(),
        previousActiveVersion: Option.none(),
        notes: Option.none(),
      }),
    ]

    expect(events).toHaveLength(2)
    // Both should have definitionId (common field)
    expect(events[0].definitionId).toBe(mockDefinitionId)
    expect(events[1].definitionId).toBe(mockDefinitionId)
  })
})

// =============================================================================
// Test: Schema Encoding/Decoding Round-Trip
// =============================================================================

describe('Schema Round-Trip', () => {
  it('should encode and decode all event types correctly', () => {
    const created = new DefinitionCreated({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      name: 'PM Workflow',
      version: '1.0.0',
      createdBy: 'engineer',
      description: Option.some('For PM tasks'),
      taskTemplates: mockTaskTemplates,
    })

    const versioned = new DefinitionVersioned({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      previousVersion: '1.0.0',
      newVersion: '1.1.0',
      changes: [],
      versionedBy: 'engineer',
      changeNotes: Option.none(),
    })

    const activated = new DefinitionActivated({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      version: '1.1.0',
      activatedBy: 'manager',
      effectiveFrom: DateTime.unsafeNow(),
      previousActiveVersion: Option.some('1.0.0'),
      notes: Option.none(),
    })

    const deprecated = new DefinitionDeprecated({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      version: '1.0.0',
      deprecatedBy: 'manager',
      reason: 'Replaced',
      replacementId: Option.none(),
      deprecationDate: DateTime.unsafeNow(),
      sunsetDate: Option.none(),
    })

    const archived = new DefinitionArchived({
      ...baseEventFields,
      definitionId: mockDefinitionId,
      version: '1.0.0',
      archivedBy: 'admin',
      reason: 'Obsolete',
      archiveReference: Option.none(),
      retentionPeriodDays: Option.none(),
    })

    // Round-trip tests
    const encodedCreated = Schema.encodeSync(DefinitionCreated)(created)
    const decodedCreated = Schema.decodeSync(DefinitionCreated)(encodedCreated)
    expect(decodedCreated.name).toBe('PM Workflow')
    expect(decodedCreated.taskTemplates).toHaveLength(2)

    const encodedVersioned = Schema.encodeSync(DefinitionVersioned)(versioned)
    const decodedVersioned = Schema.decodeSync(DefinitionVersioned)(encodedVersioned)
    expect(decodedVersioned.previousVersion).toBe('1.0.0')

    const encodedActivated = Schema.encodeSync(DefinitionActivated)(activated)
    const decodedActivated = Schema.decodeSync(DefinitionActivated)(encodedActivated)
    expect(decodedActivated.version).toBe('1.1.0')

    const encodedDeprecated = Schema.encodeSync(DefinitionDeprecated)(deprecated)
    const decodedDeprecated = Schema.decodeSync(DefinitionDeprecated)(encodedDeprecated)
    expect(decodedDeprecated.reason).toBe('Replaced')

    const encodedArchived = Schema.encodeSync(DefinitionArchived)(archived)
    const decodedArchived = Schema.decodeSync(DefinitionArchived)(encodedArchived)
    expect(decodedArchived.reason).toBe('Obsolete')
  })
})
