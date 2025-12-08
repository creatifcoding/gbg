# Session Management Commands - Overview

Two commands for bulletproof session management: `/close-session` and `/sync`.

## Design Philosophy

**No work is lost. Ever.**

Both commands implement:
- **Explicit failure modes** with recovery paths
- **User confirmation** for destructive operations
- **Dry-run modes** for preview
- **Worktree error handling** for beads sync issues
- **Conflict resolution** with clear options
- **Verification phases** to confirm success

---

## Command Comparison

| Feature | /sync | /close-session |
|---------|-------|----------------|
| **Purpose** | Mid-session checkpoint | End-of-session termination |
| **Beads sync** | Optional modes | Always (unless quick) |
| **Git commit message** | Auto-generated | User-provided structured |
| **Verification depth** | Basic SHA check | Full 5-phase protocol |
| **Journal update** | No | Yes (close timestamp) |
| **Process check** | No | Yes (warns about running servers) |
| **Phases** | 8 steps | 5 phases |
| **Use frequency** | Every 30-60 min | Once per session |

---

## /sync - Session Synchronization

**Purpose**: Lightweight checkpoint without ending session.

### Modes

1. **Full Sync** (`/sync` or `/sync full`)
   - Beads export → Git add → Commit → Pull (rebase) → Push → Beads import
   - Use for: Regular checkpoints, before switching tasks

2. **Quick Sync** (`/sync quick` or `/sync beads`)
   - Beads export only (no git operations)
   - Use for: Rapid beads updates, avoiding commit noise

3. **Status Check** (`/sync status`)
   - Read-only, shows sync state
   - Use for: Before starting work, investigating issues

4. **Git-Only Sync** (`/sync git`)
   - Skip beads, git only
   - Use for: Emergency when beads is broken

5. **Conflict Resolution** (`/sync resolve`)
   - Interactive conflict handling
   - Use for: After failed sync with conflicts

### Key Features

- **Worktree error recovery** - Detects .beads/ worktree issues, falls back to manual staging
- **Rebase conflict handling** - Aborts cleanly, switches to resolve mode
- **Network retry logic** - 3 retries with exponential backoff
- **Auto-generated commit messages** - Timestamped sync commits
- **Optional auto-sync** - Configurable intervals (30-60 min recommended)

### Example Workflow

```bash
# Mid-session checkpoints
/sync                  # Every 30-60 min
/sync status           # Check state before starting work
/sync quick            # Just beads, no git commit
/sync resolve          # If conflicts occur
```

---

## /close-session - Session Termination Protocol

**Purpose**: Safely close session with full verification.

### Phases

1. **Phase 1: Inventory**
   - Git status, beads stats, process check, branch check
   - Non-destructive reconnaissance

2. **Phase 2: Stage**
   - Beads sync (with worktree recovery)
   - Selective git add (user confirmation)
   - Stage verification

3. **Phase 3: Commit**
   - Structured commit message (user-provided)
   - Type/scope/subject format
   - Commit verification

4. **Phase 4: Push**
   - Push to remote with retry
   - Non-fast-forward recovery (fetch + rebase)
   - Push verification

5. **Phase 5: Verify**
   - Remote SHA match
   - Working tree clean check
   - Beads consistency check
   - Journal entry (optional)

### Key Features

- **Explicit phase boundaries** - Clear progress visualization
- **User confirmation** at critical points (staging, commit)
- **Structured commit messages** - Type/scope/subject format enforced
- **Process detection** - Warns if dev servers still running
- **Branch safety** - Warns if closing on main/master
- **Full verification** - 5-point check before declaring success

### Example Workflow

```bash
# End of session
/close-session         # Full close with verification
/close-session dry-run # Preview without executing
/close-session quick   # Skip beads sync (emergency)
```

---

## Integration with Beads Workflow

### Normal Operation

```
bd sync            # Beads CLI (standalone)
/sync             # Val command (beads + git)
/close-session    # Val command (full session close)
```

### Worktree Error Recovery

When `.beads/` is in a git worktree (common in multi-clone setups):

```bash
bd sync --flush-only              # Export to JSONL without git ops
git add .beads/*.jsonl .beads/beads.db .beads/.meta.json
git commit -m "sync: beads"
```

Both `/sync` and `/close-session` detect this error and apply recovery automatically.

---

## Commit Message Formats

### /sync commits (auto-generated)

```
sync: session checkpoint 2025-12-08 14:45

Synchronized beads and code changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Val <val@maidens.ai>
```

### /close-session commits (user-provided)

```
feat(tmnl): add session management commands

- Implement /close-session with 5-phase protocol
- Implement /sync with 5 modes (full, quick, status, git, resolve)
- Add worktree error recovery for beads sync
- Add conflict resolution for both beads and git

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Val <val@maidens.ai>
```

**Type prefixes**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `chore` - Maintenance
- `refactor` - Code restructuring
- `test` - Tests
- `style` - Formatting
- `perf` - Performance

**Scope**: Package name (e.g., `tmnl`, `gotby`, `cms`)

---

## Error Recovery Reference

### Beads Errors

| Error | Recovery Command | Manual Steps |
|-------|------------------|--------------|
| Worktree error | Auto-detected, uses `--flush-only` | `git add .beads/` manually |
| Beads conflicts | `/sync resolve` | Choose local/remote/merge |
| Daemon issues | `/sync quick` (bypass daemon) | Check `bd info` |
| Database locked | Retry after pause | Kill stale processes |

### Git Errors

| Error | Recovery Command | Manual Steps |
|-------|------------------|--------------|
| Non-fast-forward | Auto-retry with rebase | Manual if conflicts |
| Merge conflicts | `/sync resolve` | Resolve in editor, `git rebase --continue` |
| Push rejected (auth) | Manual fix required | Re-authenticate |
| Network failure | Auto-retry 3x | Check connection |

### Mixed Errors

| Error | Recovery Command | Manual Steps |
|-------|------------------|--------------|
| Both beads + git conflicts | `/sync resolve` | Resolve beads first, then git |
| Partial sync (beads ok, git failed) | `/sync git` | Retry git-only |
| Partial sync (git ok, beads failed) | `/sync quick` | Retry beads-only |

---

## Typical Session Flow

```
┌─────────────────────────────────────────────────────────┐
│ START SESSION                                           │
│   - Open journal entry                                  │
│   - Check sync status (/sync status)                    │
│   - Start dev servers                                   │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ WORK CYCLE (30-60 min)                                  │
│   - Code changes                                        │
│   - Beads updates                                       │
│   - Testing                                             │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ CHECKPOINT                                              │
│   - /sync (or /sync quick if just beads)               │
│   - Continue working                                    │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼ (repeat WORK CYCLE → CHECKPOINT 2-3x)
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ END SESSION                                             │
│   - /close-session (full verification)                 │
│   - Journal close entry                                 │
│   - Stop dev servers                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Configuration

### Auto-Sync (Optional)

Create `.claude/config.json`:

```json
{
  "auto_sync": {
    "enabled": true,
    "interval_minutes": 30,
    "mode": "quick"
  }
}
```

Val will remind at intervals:
```
⏰ Auto-sync reminder: Last sync was 31 minutes ago.
Run `/sync` to checkpoint current progress?
```

### Git Ignore Recommendations

Ensure `.gitignore` includes:

```
# Claude/Agent files (if you want them untracked)
.claude/archives/
.agents/val/journal/*.md

# Or track them (recommended for audit trail)
# Leave them unignored
```

Currently, these are **untracked** in the repo (per git status).

---

## Related Commands

- `/journal log` - Quick journal entry
- `/journal new` - Create today's journal entry
- `/maintain archive` - Snapshot CLAUDE.md before major changes
- `/maintain task` - Update Current Task section

---

## Testing the Commands

### Test /sync

```bash
# Dry-run first
/sync status

# Quick sync (beads only)
/sync quick

# Full sync
/sync

# Test conflict resolution (simulate)
# (create conflicting changes in another clone)
/sync resolve
```

### Test /close-session

```bash
# Dry-run first
/close-session dry-run

# Quick close (skip beads)
/close-session quick

# Full close
/close-session
```

---

## Design Principles

1. **Explicit over implicit** - Every phase announces itself
2. **User confirmation for destructive ops** - Never auto-commit without user aware
3. **Failure modes documented** - Every error has a recovery path
4. **Dry-run always available** - Preview before executing
5. **Verification is mandatory** - Never assume success
6. **Recovery paths are first-class** - Errors are expected, handled gracefully
7. **Audit trail always generated** - Co-authored commits, journal entries

---

## Implementation Notes

Both commands use:
- **AskUserQuestion** for user input (staging selection, commit message, conflict resolution)
- **HEREDOC for commit messages** to ensure proper formatting
- **Bash tool for all git/bd operations** with proper error capture
- **Progressive output** with phase boundaries clearly marked
- **No silent failures** - every error is surfaced to user

---

## Future Enhancements

Potential additions:

1. **Auto-conflict resolution** - ML-based merge strategies
2. **Sync hooks** - Pre/post-sync custom scripts
3. **Multi-clone orchestration** - Sync across multiple clones automatically
4. **Sync metrics** - Track sync frequency, conflict rates
5. **Session templates** - Pre-defined sync strategies per project
6. **Remote sync verification** - Fetch and compare checksums

---

## Signature

All commits created by these commands include:

```
Co-Authored-By: Val <val@maidens.ai>
```

---

## Help

- `/sync help` - Show sync command documentation
- `/close-session help` - Show close-session command documentation
- Read this file for overview and comparison
