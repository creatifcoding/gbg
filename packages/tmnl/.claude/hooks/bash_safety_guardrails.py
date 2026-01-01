#!/usr/bin/env python3
"""
PreToolUse Hook: Bash Safety Guardrails

Blocks dangerous commands, warns on risky operations, audits package installs.

Input (stdin): JSON with tool_name, tool_input
Output (stdout): JSON with permissionDecision

Exit codes:
  0 - Success (allow/ask/deny via JSON)
  2 - Hard block (stderr shown to Claude)
"""

import json
import re
import sys
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Decision(Enum):
    ALLOW = "allow"
    ASK = "ask"
    DENY = "deny"


@dataclass
class SafetyResult:
    decision: Decision
    reason: str
    audit_message: Optional[str] = None


# =============================================================================
# BLOCK RULES - Hard deny, cannot proceed
# =============================================================================
BLOCK_PATTERNS = [
    # Catastrophic deletes
    (r'rm\s+(-[rf]+\s+)*/', "Catastrophic delete: rm on root"),
    (r'rm\s+(-[rf]+\s+)*~', "Catastrophic delete: rm on home"),
    (r'rm\s+(-[rf]+\s+)*\$HOME', "Catastrophic delete: rm on $HOME"),

    # Protected paths
    (r'rm\s+(-[rf]+\s+)*\.claude/', "Protected path: .claude/"),
    (r'rm\s+(-[rf]+\s+)*\.beads/', "Protected path: .beads/"),
    (r'rm\s+(-[rf]+\s+)*src/', "Protected path: src/"),
    (r'rm\s+(-[rf]+\s+)*\.git/', "Protected path: .git/"),

    # Chained destruction
    (r'rm\s+-rf\s+node_modules\s*&&\s*rm', "Chained rm commands"),

    # Fork bombs and malicious patterns
    (r':\(\)\s*\{\s*:\|:\s*&\s*\}', "Fork bomb detected"),
    (r'>\s*/dev/sd[a-z]', "Direct write to block device"),
    (r'dd\s+if=.*of=/dev/sd', "dd to block device"),
    (r'mkfs\.\w+\s+/dev/', "Filesystem creation on device"),
]

# =============================================================================
# WARN RULES - Ask user before proceeding
# =============================================================================
WARN_PATTERNS = [
    # Git force operations
    (r'git\s+push\s+(-f|--force)', "Force push to remote"),
    (r'git\s+push\s+.*--force', "Force push to remote"),
    (r'git\s+reset\s+--hard', "Hard reset (loses changes)"),
    (r'git\s+clean\s+-[a-z]*f', "Git clean with force"),
    (r'git\s+checkout\s+--\s+\.', "Checkout all files (discards changes)"),

    # SQL destruction
    (r'DROP\s+TABLE', "SQL DROP TABLE"),
    (r'DROP\s+DATABASE', "SQL DROP DATABASE"),
    (r'DELETE\s+FROM\s+\w+\s*(;|$)', "SQL DELETE without WHERE"),
    (r'TRUNCATE\s+TABLE', "SQL TRUNCATE"),

    # Permission issues
    (r'chmod\s+777', "chmod 777 (world-writable)"),
    (r'chmod\s+-R\s+777', "Recursive chmod 777"),
    (r'chown\s+-R\s+root', "Recursive chown to root"),

    # Dangerous environment
    (r'export\s+PATH\s*=\s*["\']?/', "PATH override"),
    (r'unset\s+PATH', "PATH unset"),
    (r'sudo\s+rm', "sudo rm"),
    (r'sudo\s+-i', "sudo interactive shell"),

    # Network exposure
    (r'--listen\s+0\.0\.0\.0', "Listen on all interfaces"),
    (r'-p\s+0\.0\.0\.0:', "Bind to all interfaces"),
]

# =============================================================================
# AUDIT RULES - Log and allow
# =============================================================================
AUDIT_PATTERNS = [
    (r'bun\s+add\s+(\S+)', "Package install: bun add"),
    (r'npm\s+install\s+(\S+)', "Package install: npm"),
    (r'pnpm\s+add\s+(\S+)', "Package install: pnpm"),
    (r'yarn\s+add\s+(\S+)', "Package install: yarn"),
    (r'pip\s+install\s+(\S+)', "Package install: pip"),
    (r'cargo\s+add\s+(\S+)', "Package install: cargo"),
]


def check_command(command: str) -> SafetyResult:
    """Analyze command for safety issues."""

    # Normalize command for pattern matching
    cmd_normalized = command.strip()

    # Check BLOCK patterns first
    for pattern, reason in BLOCK_PATTERNS:
        if re.search(pattern, cmd_normalized, re.IGNORECASE):
            return SafetyResult(
                decision=Decision.DENY,
                reason=f"BLOCKED: {reason}"
            )

    # Check WARN patterns
    for pattern, reason in WARN_PATTERNS:
        if re.search(pattern, cmd_normalized, re.IGNORECASE):
            return SafetyResult(
                decision=Decision.ASK,
                reason=f"CAUTION: {reason}"
            )

    # Check AUDIT patterns (log but allow)
    for pattern, reason in AUDIT_PATTERNS:
        match = re.search(pattern, cmd_normalized, re.IGNORECASE)
        if match:
            pkg = match.group(1) if match.lastindex else "unknown"
            return SafetyResult(
                decision=Decision.ALLOW,
                reason="",
                audit_message=f"📦 {reason}: {pkg}"
            )

    # Default: allow
    return SafetyResult(decision=Decision.ALLOW, reason="")


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error parsing input JSON: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Only process Bash tool
    if tool_name != "Bash":
        sys.exit(0)

    command = tool_input.get("command", "")
    if not command:
        sys.exit(0)

    # Check safety
    result = check_command(command)

    # Handle DENY
    if result.decision == Decision.DENY:
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": result.reason
            }
        }
        print(json.dumps(output))
        sys.exit(0)

    # Handle ASK
    if result.decision == Decision.ASK:
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "ask",
                "permissionDecisionReason": result.reason
            }
        }
        print(json.dumps(output))
        sys.exit(0)

    # Handle ALLOW with audit
    if result.audit_message:
        print(result.audit_message)

    sys.exit(0)


if __name__ == "__main__":
    main()
