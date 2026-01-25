# Ralph Loop Dynamic Context
> Auto-updated: $(date -Iseconds)

## Active Beads
$(bd list --status=in_progress 2>/dev/null || echo "None")

## Ready Work
$(bd ready 2>/dev/null | head -20 || echo "Run bd ready manually")

## Recent Commits
$(git log --oneline -5)

## Test Status
$(bun test src/lib/holonet/durable-streams/ 2>&1 | tail -20 || echo "Run tests manually")
