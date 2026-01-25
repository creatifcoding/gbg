# Durable-Streams Integration - Ralph Loop Prompt

## Mission

You are executing autonomous work on the **durable-streams ↔ NATS integration** for TMNL's Holonet layer. You have full authority to research, design, implement, test, and commit code within the boundaries of the plan.

---

## Pre-Iteration Protocol

**BEFORE doing any work, execute these commands in order:**

```bash
# 1. Update dynamic context with current state
cat > .claude/ralph-loop-context.md << 'CONTEXT_EOF'
# Ralph Loop Dynamic Context
> Auto-updated: $(date -Iseconds)

## Active Beads
$(bd list --status=in_progress 2>/dev/null || echo "None")

## Ready Work
$(bd ready 2>/dev/null | head -20 || echo "Run bd ready manually")

## Recent Commits
$(git log --oneline -5)

## Test Status
$(bun test src/lib/holonet/durable-streams/ 2>&1 | tail -10 || echo "Run tests manually")
CONTEXT_EOF

# 2. Read the context you just created
cat .claude/ralph-loop-context.md
```

Then read the plan file:
```
Read ~/.claude/plans/eventual-enchanting-mountain.md
```

---

## Authority & Boundaries

### You CAN (with impunity):
- Create new Effect services following the plan architecture
- Write comprehensive unit and integration tests
- Create beads for new work items (`bd create`)
- Close beads when work is complete (`bd close`)
- Add dependencies between beads (`bd dep add`)
- Research using MCPs: `deepwiki`, `effect-docs`, `perplexity`, `firecrawl`
- Commit atomic changes with proper messages
- Refactor existing code to match patterns
- Create new files in `src/lib/holonet/durable-streams/`
- Update barrel exports (`index.ts` files)

### You MUST:
- Track ALL work in beads (never use TodoWrite for task tracking)
- Research via MCP before writing > 50 lines of new code
- Write tests alongside or before implementation
- Follow the plan's service hierarchy and call graphs
- Use Effect patterns: Schema, Service, Layer, Stream
- Commit after completing each logical unit
- Update the dynamic context file before each iteration

### You CANNOT (ask Prime first):
- Change the overall architecture without discussion
- Add new external dependencies to package.json
- Modify code outside `src/lib/holonet/`
- Delete or significantly refactor existing working services
- Push to remote (local commits only)

---

## Current Phase: Phase 1 - Core Services

### Completed:
- [x] ConsumerStateService - offset tracking (11 tests passing)

### In Progress / Next:
- [ ] StreamCodecService tests - verify existing implementation
- [ ] SchemaRegistry - schema registration and lookup
- [ ] Content-Type parser for schema parameter extraction

### Phase 1 Deliverables (from plan):
1. `SchemaRegistry` - schema registration and lookup (core/schema/)
2. `StreamCodecService` - schema-aware encode/decode with header injection
3. `ConsumerStateService` - offset tracking ✅
4. Content-Type parser for schema parameter extraction
5. Integration tests with real NATS + schema validation

---

## MCP Research Patterns

### For Effect patterns:
```
Use effect-docs MCP: effect_docs_search query="<topic>"
Then: get_effect_doc documentId=<id>
```

### For nats.ws / JetStream:
```
Use deepwiki: query @nats-io/nats.ws for <topic>
```

### For architectural decisions:
```
Use perplexity_research: "Effect-TS best practices for <pattern>"
```

### For existing codebase patterns:
```
Grep/Read src/lib/holonet/nats/ for patterns
Check submodules/effect for test examples
```

---

## Beads Workflow

```bash
# Find ready work
bd ready

# Create new work item
bd create --title="[DS Phase 1] StreamCodecService tests" --type=task

# Claim work
bd update <id> --status=in_progress

# Add dependency (B depends on A)
bd dep add <B> <A>

# Complete work
bd close <id> --reason="Implementation complete with N tests"

# Sync before commit
bd sync --from-main
```

---

## Commit Protocol

After completing a logical unit:

```bash
# 1. Check what changed
git status

# 2. Stage relevant files
git add src/lib/holonet/durable-streams/...

# 3. Sync beads
bd sync --from-main

# 4. Stage beads
git add .beads/issues.jsonl

# 5. Commit with conventional format
git commit -m "feat(holonet): <description>

<details>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Iteration Goals

Each iteration should accomplish ONE of:
1. Complete a single bead (implement + test + commit)
2. Research and document a blocking question
3. Create beads for newly discovered work
4. Fix failing tests

**Do NOT try to do everything in one iteration.** Small, focused progress.

---

## Exit Conditions

Stop the Ralph loop when:
- Phase 1 is complete (all services implemented with tests)
- You hit a blocking question that needs Prime's input
- Tests are failing and you can't determine the fix
- You've completed 10 iterations without Prime check-in

---

## Start

Read the pre-iteration protocol above, update context, then begin work on the next ready bead or the most impactful Phase 1 task.
