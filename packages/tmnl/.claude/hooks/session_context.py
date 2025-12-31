#!/usr/bin/env python3
"""
SessionStart Hook: Context Injection

Injects Fermion pattern reminders and key context at session start.
Keeps output concise - the full skill is available via /fermion-patterns.

Input (stdin): JSON with session_id, session_type
Output (stdout): Context message for the session

Exit codes:
  0 - Success
"""

import json
import sys
from pathlib import Path


FERMION_REMINDER = """
📦 **Fermion Context Loaded**

**Registry Pattern (CRITICAL)**:
- `Atom.set()` / `Atom.get()` → return Effects (require AtomRegistry context)
- `registry.set()` / `registry.get()` → synchronous (use in React callbacks)

**Quick Reference**:
```typescript
// Module-level registry
export const myRegistry = Registry.make()

// Sync mutations in React
registry.set(atom, value)      // ✓ No Effect required
const val = registry.get(atom) // ✓ Synchronous read

// Inside Effect.gen()
yield* Atom.set(atom, value)   // ✓ Effect context handles AtomRegistry
```

**Anti-Patterns**:
- ❌ `Atom.set()` in React callbacks (returns Effect, not void)
- ❌ `Atom.family()` inside components (recreates on render)
- ❌ Forgetting `<RegistryProvider>` wrapper

**Skill**: Run `/fermion-patterns` for full documentation.
"""


def get_project_summary() -> str:
    """
    Optional: Get a brief project state summary.
    Currently minimal - can be extended to check git status, open issues, etc.
    """
    project_dir = Path(__file__).parent.parent.parent

    # Check if in TMNL project
    if not (project_dir / "package.json").exists():
        return ""

    # Could add: git branch, recent commits, open beads issues
    return ""


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        # SessionStart may not always have JSON input
        input_data = {}

    session_type = input_data.get("session_type", "unknown")

    # Build output
    output_parts = [FERMION_REMINDER.strip()]

    # Add project summary if available
    project_summary = get_project_summary()
    if project_summary:
        output_parts.append(project_summary)

    # Print the context (will be shown to user/agent)
    print("\n".join(output_parts))

    sys.exit(0)


if __name__ == "__main__":
    main()
