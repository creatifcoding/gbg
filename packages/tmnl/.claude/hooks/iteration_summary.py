#!/usr/bin/env python3
"""
Iteration Summary Hook (Stop/SessionEnd)

Writes a quick summary of current progress toward realizing the active plan.
Triggered before iteration session close to capture state.

Input (stdin): JSON with session context
Output (stdout): Summary confirmation

Exit codes:
  0 - Success
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path


def find_active_plan() -> tuple[Path | None, str | None]:
    """Find the most recently modified plan file."""
    project_dir = Path(os.environ.get('CLAUDE_PROJECT_DIR', '.'))

    # Check common plan locations
    plan_locations = [
        project_dir / 'thoughts' / 'shared' / 'plans',
        project_dir / '.agents' / 'plans',
        project_dir / 'assets' / 'documents',
    ]

    # Also check for PLAN_FILE env var
    env_plan = os.environ.get('PLAN_FILE')
    if env_plan:
        plan_path = Path(env_plan)
        if plan_path.exists():
            return plan_path, plan_path.read_text()

    # Find most recent *plan*.md or *PLAN*.md
    candidates = []
    for loc in plan_locations:
        if loc.exists():
            for f in loc.glob('*[Pp][Ll][Aa][Nn]*.md'):
                candidates.append((f, f.stat().st_mtime))

    if candidates:
        candidates.sort(key=lambda x: x[1], reverse=True)
        plan_path = candidates[0][0]
        return plan_path, plan_path.read_text()

    return None, None


def extract_phases(plan_content: str) -> list[dict]:
    """Extract phase information from plan markdown."""
    phases = []
    current_phase = None

    for line in plan_content.split('\n'):
        # Look for phase headers like "### Phase 1:" or "- [ ] Phase 1:"
        if 'Phase' in line and (':' in line or '-' in line):
            # Check if it's a checkbox
            is_done = '[x]' in line.lower() or '[X]' in line

            # Extract phase name
            if ':' in line:
                parts = line.split(':', 1)
                name = parts[0].strip().lstrip('#- [x][]')
                desc = parts[1].strip() if len(parts) > 1 else ''
            else:
                name = line.strip().lstrip('#- [x][]')
                desc = ''

            phases.append({
                'name': name.strip(),
                'description': desc,
                'completed': is_done
            })

    return phases


def get_recent_changes() -> list[str]:
    """Get recently modified files as proxy for progress."""
    import subprocess
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')

    try:
        # Get files modified in last hour
        result = subprocess.run(
            ['find', '.', '-type', 'f', '-mmin', '-60',
             '-not', '-path', './.git/*',
             '-not', '-path', './node_modules/*'],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode == 0:
            files = [f.strip() for f in result.stdout.strip().split('\n') if f.strip()]
            # Filter to interesting files
            interesting = [f for f in files if f.endswith(('.ts', '.tsx', '.py', '.md', '.json'))]
            return interesting[:20]  # Limit to 20
    except Exception:
        pass

    return []


def write_iteration_summary(plan_path: Path | None, phases: list[dict], recent_files: list[str]) -> str:
    """Write iteration summary to journal."""
    project_dir = Path(os.environ.get('CLAUDE_PROJECT_DIR', '.'))
    journal_dir = project_dir / '.agents' / 'val' / 'journal'
    journal_dir.mkdir(parents=True, exist_ok=True)

    date_str = datetime.now().strftime('%Y-%m-%d')
    time_str = datetime.now().strftime('%H:%M')

    # Find iteration number for today
    existing = list(journal_dir.glob(f'{date_str}-iteration-*.md'))
    iteration_num = len(existing) + 1

    summary_file = journal_dir / f'{date_str}-iteration-{iteration_num}.md'

    # Build summary content
    content = f"""# Iteration Summary: {date_str} #{iteration_num}

**Time**: {time_str}
**Plan**: {plan_path.name if plan_path else 'No plan detected'}

## Phase Status

"""

    if phases:
        completed = [p for p in phases if p['completed']]
        pending = [p for p in phases if not p['completed']]

        if completed:
            content += "### Completed\n"
            for p in completed:
                content += f"- [x] {p['name']}: {p['description']}\n"
            content += "\n"

        if pending:
            content += "### Pending\n"
            for p in pending[:5]:  # Show first 5 pending
                content += f"- [ ] {p['name']}: {p['description']}\n"
            if len(pending) > 5:
                content += f"- ... and {len(pending) - 5} more phases\n"
            content += "\n"
    else:
        content += "*No phases detected in plan*\n\n"

    content += "## Recent Activity\n\n"

    if recent_files:
        content += "Files modified this session:\n"
        for f in recent_files[:10]:
            content += f"- `{f}`\n"
        if len(recent_files) > 10:
            content += f"- ... and {len(recent_files) - 10} more\n"
    else:
        content += "*No recent file changes detected*\n"

    content += f"""

## Next Iteration

**Recommended**: Invoke `/plan-iteration-checkpoint` at start of next session
to assess progress and determine next steps.

---
*Auto-generated by iteration_summary hook*
"""

    # Write the file
    summary_file.write_text(content)

    return str(summary_file)


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        input_data = {}

    outputs = []
    outputs.append("📋 Iteration Summary Hook")

    # Find active plan
    plan_path, plan_content = find_active_plan()

    if plan_path:
        outputs.append(f"  Plan: {plan_path.name}")
        phases = extract_phases(plan_content)
        completed_count = len([p for p in phases if p['completed']])
        outputs.append(f"  Phases: {completed_count}/{len(phases)} completed")
    else:
        outputs.append("  No active plan detected")
        phases = []

    # Get recent changes
    recent_files = get_recent_changes()
    if recent_files:
        outputs.append(f"  Recent changes: {len(recent_files)} files")

    # Write summary
    try:
        summary_path = write_iteration_summary(plan_path, phases, recent_files)
        outputs.append(f"  Summary: {summary_path}")
    except Exception as e:
        outputs.append(f"  Failed to write summary: {e}")

    print("\n".join(outputs))
    sys.exit(0)


if __name__ == "__main__":
    main()
