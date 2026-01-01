#!/usr/bin/env python3
"""
SessionEnd Hook: Cleanup Automation

Performs cleanup when session ends:
1. Sync beads from main
2. Log session summary to .agents/sessions.log
3. Warn if uncommitted changes

Input (stdin): JSON with reason
Output (stdout): Status messages

Exit codes:
  0 - Success
"""

import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def sync_beads() -> tuple[bool, str]:
    """Sync beads from main branch."""
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')

    try:
        result = subprocess.run(
            ['bd', 'sync', '--from-main'],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            return True, "Beads synced from main"
        else:
            return False, f"Beads sync failed: {result.stderr[:100]}"

    except subprocess.TimeoutExpired:
        return False, "Beads sync timed out"
    except FileNotFoundError:
        return False, "bd command not found"
    except Exception as e:
        return False, f"Beads sync error: {e}"


def check_git_status() -> tuple[bool, list[str]]:
    """Check for uncommitted changes."""
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')

    try:
        result = subprocess.run(
            ['git', 'status', '--porcelain'],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=10
        )

        if not result.stdout.strip():
            return False, []

        # Parse changed files
        changes = []
        for line in result.stdout.strip().split('\n')[:10]:
            if line.strip():
                changes.append(line.strip())

        return True, changes

    except Exception:
        return False, []


def log_session_summary(reason: str) -> None:
    """Log session summary to .agents/sessions.log."""
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')
    log_dir = Path(project_dir) / '.agents'
    log_file = log_dir / 'sessions.log'

    try:
        # Ensure directory exists
        log_dir.mkdir(parents=True, exist_ok=True)

        # Build log entry
        timestamp = datetime.now().isoformat()
        entry = f"[{timestamp}] Session ended (reason: {reason})\n"

        # Get git info for context
        try:
            result = subprocess.run(
                ['git', 'log', '--oneline', '-3'],
                cwd=project_dir,
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                commits = result.stdout.strip().split('\n')
                entry += f"  Recent commits: {len(commits)}\n"
                for commit in commits:
                    entry += f"    {commit}\n"
        except Exception:
            pass

        # Get modified file count
        try:
            result = subprocess.run(
                ['git', 'status', '--porcelain'],
                cwd=project_dir,
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                modified = len([l for l in result.stdout.split('\n') if l.strip()])
                entry += f"  Uncommitted changes: {modified} files\n"
        except Exception:
            pass

        entry += "\n"

        # Append to log
        with open(log_file, 'a') as f:
            f.write(entry)

    except Exception as e:
        print(f"Failed to log session: {e}", file=sys.stderr)


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        input_data = {}

    reason = input_data.get("reason", "unknown")

    outputs = []
    outputs.append(f"🔚 Session ending ({reason})")

    # Sync beads
    success, message = sync_beads()
    if success:
        outputs.append(f"✓ {message}")
    else:
        outputs.append(f"⚠ {message}")

    # Check git status
    has_changes, changes = check_git_status()
    if has_changes:
        outputs.append(f"⚠ Uncommitted changes ({len(changes)} files):")
        for change in changes[:5]:
            outputs.append(f"  {change}")
        if len(changes) > 5:
            outputs.append(f"  ... and {len(changes) - 5} more")

    # Log session
    log_session_summary(reason)
    outputs.append("✓ Session logged to .agents/sessions.log")

    print("\n".join(outputs))
    sys.exit(0)


if __name__ == "__main__":
    main()
