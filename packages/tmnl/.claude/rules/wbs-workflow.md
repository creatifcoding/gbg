# WBS Workflow Rules

## Auto-Detection Triggers

Activate WBS context when user message contains:
- "epic" + number (e.g., "epic 8", "work on epic 9")
- "alarm ES", "work order ES", "equipment state ES"
- "event sourcing", "EventLog"
- "v3 architecture", "v3 service"
- Explicit "/wbs" command

## Session Protocol

### Starting Work

1. **ALWAYS read tracker first**
   ```bash
   cat .claude/plans/enumerated-crafting-otter.md | head -300
   ```

2. **ALWAYS create TaskCreate entries** for work items
   - One task per WBS item
   - Include WBS ID in task subject (e.g., "EL-2.1: Feature flag")

3. **ALWAYS mark tracker** when claiming work
   - Change ⏳ → 🔄 for task being worked

### During Work

1. **Update TaskUpdate** as you progress
   - `in_progress` when starting
   - `completed` when verified

2. **Verify before marking complete**
   - Tests must pass
   - TypeScript must compile
   - No regressions

### Completing Work

1. **Update tracker markdown**
   - Change 🔄 → ✅ for completed tasks

2. **Append to session log**
   Format:
   ```markdown
   ## YYYY-MM-DD — Session [short-id]
   **Agent:** [name]
   **Epic:** [N] ([Name])
   **Completed:** [task IDs]
   **Next:** [next task ID + description]
   **Blockers:** [any blockers or "None"]
   ```

3. **Commit tracker changes**
   - Include session log in commit

## Multi-Agent Coordination

| Rule | Enforcement |
|------|-------------|
| One epic per session | Check 🔄 markers before claiming |
| Verify before complete | Tests + TypeScript = ✅ |
| Log everything | Session log is mandatory |
| Git-based locking | Commit immediately after claiming |

## Anti-Patterns

❌ Starting work without reading tracker
❌ Completing tasks without verification
❌ Skipping session log
❌ Working on blocked tasks (⏸️)
❌ Claiming multiple epics simultaneously

## Quick Commands

```bash
# View current progress
cat .claude/plans/enumerated-crafting-otter.md | grep -E "^\\|.*(✅|🔄|⏳|🎯)"

# View session log
cat .claude/plans/wbs-session-log.md

# Count completed vs remaining
grep -c "✅" .claude/plans/enumerated-crafting-otter.md
grep -c "⏳" .claude/plans/enumerated-crafting-otter.md

# Run EventJournal tests
bun test src/lib/iiot/__tests__/integration/sql-event-journal.test.ts

# Check TypeScript
bunx tsc --noEmit
```

## Epic Dependencies

```
Epic 8 (Alarm ES) ─────┐
                       ├──▶ Epic 12 (ES Integration) ──▶ Epic 25 (Regulatory)
Epic 9 (Work Order) ───┤
                       │
Epic 10 (Equipment) ───┘

Epic 11 (Non-ES) ──────▶ Independent
```

## File Locations

| File | Purpose |
|------|---------|
| `.claude/plans/enumerated-crafting-otter.md` | Progress tracker |
| `.claude/plans/wbs-session-log.md` | Session log |
| `thoughts/shared/plans/2026-01-26-v3-service-architecture-wbs.md` | Full WBS |
| `src/lib/iiot/infrastructure/feature-flags.ts` | Feature flags |
| `src/lib/iiot/schemas/events/` | Event schemas |
| `src/lib/iiot/handlers/` | Event handlers |
| `src/lib/iiot/services/l2/` | L2 services |
