# Kraken Task: WorkOrderContext Event Handlers (EL-3)

## Task
Implement EventLog handlers for the WorkOrderContext aggregate with 10 events.

## Checkpoints
<!-- Resumable state for kraken agent -->
**Task:** WorkOrderContext Event Handlers
**Started:** 2026-01-31T11:05:00Z
**Last Updated:** 2026-01-31T11:06:00Z

### Phase Status
- Phase 1 (Tests Written): VALIDATED (tests fail because impl missing)
- Phase 2 (EventGroup Definition): IN_PROGRESS
- Phase 3 (Handlers Implementation): PENDING
- Phase 4 (Type Compilation): PENDING
- Phase 5 (Tests Pass): PENDING

### Validation State
```json
{
  "test_count": 12,
  "tests_passing": 0,
  "test_failure_reason": "Failed to resolve import '../context-handlers'",
  "files_modified": [
    "src/lib/iiot/handlers/__tests__/context-handlers.test.ts"
  ],
  "last_test_command": "bunx vitest run src/lib/iiot/handlers/__tests__/context-handlers.test.ts",
  "last_test_exit_code": 1
}
```

### Resume Context
- Current focus: Creating WorkOrderContextEvents EventGroup in groups.ts
- Next action: Add 10 event definitions to EventGroup
- Blockers: None

## Events to Implement (10 total)
1. ContextCreated - Initial context for work order
2. ContextUpdated - Context field updated
3. ContextSnapshotted - Immutable point-in-time snapshot
4. AssetAttached - Asset linked to work order
5. AssetDetached - Asset unlinked
6. ResourceAllocated - Resource assigned (tools, materials)
7. ResourceReleased - Resource freed
8. ExternalRefLinked - External system reference added
9. ExternalRefUnlinked - External reference removed
10. ChildWorkOrderSpawned - Child work order created

## Reference Files
- Event schemas: `src/lib/iiot/schemas/events/operational/context-events.ts`
- Groups pattern: `src/lib/iiot/schemas/events/groups.ts` (AlarmEvents as reference)
- Handler pattern: `src/lib/iiot/handlers/alarm-handlers.ts`
