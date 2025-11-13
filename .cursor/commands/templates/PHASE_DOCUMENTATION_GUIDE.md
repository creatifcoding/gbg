# Phase Documentation Guide

Comprehensive guide for documenting phases.

## Overview

Phase documentation provides context, progress tracking, and guidance for phase work.

## Documentation Structure

Each phase should include:

```
phase-0X-{name}/
├── README.md              # Main documentation
├── phase.json             # Metadata
├── PROGRESS.md            # Progress tracking (optional)
├── DECISIONS.md           # Decision log (optional)
├── RISKS.md               # Risk assessment (optional)
└── {XX}-{task}-name.md    # Task files
```

## README.md Structure

### Header Section

```markdown
# Phase {Number}: {Display Name}

**Status**: [Active/Pending/Complete/Blocked]
**Progress**: X% (Y/Z tasks complete)
**Timeline**: YYYY-MM-DD to YYYY-MM-DD
```

### Overview Section

```markdown
## Overview

{Brief description of phase purpose}

Detailed explanation of what this phase accomplishes and why it exists.
```

### Objectives Section

```markdown
## Objectives

- [ ] Objective 1 - Description
- [ ] Objective 2 - Description
- [ ] Objective 3 - Description

Related tasks:
- [Task 01-001](./01-001-task-name.md)
- [Task 01-002](./01-002-task-name.md)
```

### Scope Section

```markdown
## Scope

### Included

- What IS part of this phase
- What systems/components affected
- What functionality added

### Excluded

- What is NOT part of this phase
- What is deferred to future phases
- What is out of scope
```

### Key Deliverables Section

```markdown
## Key Deliverables

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Deliverable 1 | ⏳ Pending | Expected by 2024-11-20 |
| Deliverable 2 | 🔄 In Progress | On track |
| Deliverable 3 | ✅ Complete | Delivered 2024-11-15 |
```

### Tasks Section

```markdown
## Tasks

Total: {count}
Pending: {count} ⏳
In Progress: {count} 🔄
Completed: {count} ✅

### Root Tasks

- [01-001 - Complete BaseArchetype](./01-001-complete-base-archetype.md)
  - [01-001-001 - Implement class structure](./01-001-001-implement-base-archetype-class.md)
  - [01-001-002 - Add types](./01-001-002-add-typescript-types.md)

See all tasks: `/task-list {phaseName}`
```

### Metrics Section

```markdown
## Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Completion | 33% | 100% | 🟡 On Track |
| Tasks Complete | 1/3 | 3/3 | 🟡 |
| Estimated Hours | 8 | 8 | ✅ |
| Actual Hours | 2 | 8 | 🟡 |
| Blocked Tasks | 0 | 0 | ✅ |
```

### Dependencies Section

```markdown
## Dependencies

### Phase Dependencies

- ✅ **Phase 0: Planning** (Complete)
- ⏳ **External SDK** (Waiting for v2.0 release)

### Task Dependencies

- 01-001 ← (no dependencies)
- 01-002 ← [01-001-002](./01-001-002-add-typescript-types.md)
```

### Resources Section

```markdown
## Resources

### Documentation

- [Task System Guide](../../TASKS.md)
- [API Reference](../../API.md)
- [Architecture Overview](../../ARCHITECTURE.md)

### Tools & Services

- Service 1 - [Link](https://example.com)
- Service 2 - [Link](https://example.com)

### Team & Contact

- Assigned to: [Team/Person]
- Questions? → [Contact Info]
```

### Progress & Timeline Section

```markdown
## Progress & Timeline

### Timeline

```
Week 1: 01-001, 01-002
Week 2: 01-001-001, 01-001-002
Week 3: 01-002-001
Week 4: Testing & wrap-up
```

### Progress Log

- **2024-11-13**: Phase created, tasks initialized
- **2024-11-14**: Started 01-001
- **2024-11-15**: Completed 01-001-001
- **2024-11-16**: Working on 01-001-002
```

### Critical Path Section

```markdown
## Critical Path

Sequential dependencies that determine phase duration:

```
01-001 (blocker) → 01-002 (depends on 01-001)
│
├─ 01-001-001 (parallel)
├─ 01-001-002 (parallel)
└─ 01-001-003 (parallel)
```

Estimated duration: 8 hours (sequential path)
```

### Risks & Mitigations Section

```markdown
## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Dependency delay | High | Medium | Review early |
| Resource unavailable | High | Low | Cross-train |
| Scope creep | Medium | High | Strict boundaries |
```

### Status & Health Section

```markdown
## Status & Health

### Overall Status: 🟡 ON TRACK

- ✅ No critical blockers
- 🟡 One task at risk (01-002)
- ⏳ On schedule

### What's Working

- Task 01-001 progressing well
- Team coordination smooth
- No external blockers

### What Needs Attention

- Task 01-002 needs review
- Time estimate may need adjustment
- Consider adding subtask 01-002-002

### Next Steps

1. Complete 01-001-002
2. Begin 01-002
3. Schedule review meeting
```

### Related & Next Phase Section

```markdown
## Related Documentation

- [Previous Phase: Phase 0](../phase-00-planning/)
- [Task System](../../TASKS.md)
- [Naming Conventions](../../NAMING.md)

## Next Phase

[Phase 2: Metadata-Annotations](../phase-02-metadata-annotations/)

### Transition Criteria

- [ ] All Phase 1 tasks complete
- [ ] Documentation reviewed
- [ ] Stakeholder approval
- [ ] Phase 2 initialized

See: `/phase-next foundation` for transition
```

## Optional Additional Files

### PROGRESS.md - Detailed Progress Tracking

```markdown
# Phase 1 Progress Tracking

## Week 1 (Nov 13-19)

### Completed
- [x] Setup project structure
- [x] Create initial tasks
- [x] Implement BaseArchetype

### In Progress
- [ ] Add TypeScript types
- [ ] Write documentation

### Blockers
- None

### Metrics
- Hours estimated: 8
- Hours actual: 2.5
```

### DECISIONS.md - Decision Log

```markdown
# Phase 1 Decisions

## Decision 1: Use Schema.TaggedClass

**Date**: 2024-11-13
**Context**: Need type-safe schema system
**Options**: 
  1. Schema.TaggedClass (chosen)
  2. Regular classes
  3. Interfaces only

**Decision**: Schema.TaggedClass
**Rationale**: Type safety + composability
**Impact**: Foundation for entire system
```

### RISKS.md - Risk Assessment

```markdown
# Phase 1 Risks

## Risk 1: External Dependency Delay

**Risk**: Hygraph SDK v2.0 delayed
**Impact**: High - would block Phase 2
**Probability**: Medium
**Mitigation**: Use fallback SDK, plan early
```

## Writing Guidelines

### Best Practices

✅ **Do:**
- Be specific and measurable
- Use clear task links
- Update regularly (weekly)
- Include examples
- Reference documentation
- Use status indicators
- Provide context

❌ **Don't:**
- Use vague language
- Leave progress stale
- Forget to link tasks
- Assume reader knowledge
- Use abbreviations without explanation
- Forget status indicators

### Style Guidelines

- **Headings**: Use clear hierarchy (H1, H2, H3)
- **Lists**: Use bullet points for lists
- **Tables**: Use for structured data
- **Links**: Always link related items
- **Status**: Use emojis (✅ ⏳ 🔄 🚫 🟡)
- **Tone**: Professional, clear, actionable

## Examples

### Example: Phase 1 Foundation

See: [../../packages/cms/tasks/phase-01-foundation/README.md](../../packages/cms/tasks/phase-01-foundation/)

Key elements:
- Clear overview
- Linked tasks
- Progress metrics
- Status indicators
- Actionable next steps

## Automation

These commands automatically reference phase documentation:

- `/phase-list` - Shows phase descriptions
- `/phase-show <phase>` - Displays phase README
- `/phase-report <phase>` - Analyzes phase data
- `/task-list <phase>` - Lists phase tasks

## Maintenance

Update phase documentation:

- **Weekly**: Progress log, status
- **Bi-weekly**: Metrics, timeline
- **Monthly**: Risks, decisions
- **As needed**: Scope, dependencies

---

**Remember**: Good documentation saves time and prevents confusion!

