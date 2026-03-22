#!/usr/bin/env python3
"""
TMNL NATS Monitor - tmux session for watching live NATS message traffic

Creates a tmux session with panes for monitoring:
- All test subjects (test.>)
- KV bucket operations ($KV.>)
- JetStream activity ($JS.>)
- NATS server events ($SYS.>)

Usage: python3 scripts/test-monitor.py
Attach: tmux attach -t nats-monitor

Requires: nats CLI, NATS server on ws://localhost:9222
"""

import libtmux
from libtmux.constants import PaneDirection

SESSION_NAME = "nats-monitor"
NATS_URL = "ws://localhost:9222"

def main():
    server = libtmux.Server()

    # Kill existing session if it exists
    try:
        existing = server.sessions.filter(session_name=SESSION_NAME)
        if existing:
            existing[0].kill()
            print(f"Killed existing session: {SESSION_NAME}")
    except Exception:
        pass

    # Create new session
    session = server.new_session(
        session_name=SESSION_NAME,
        window_name="nats-traffic",
        start_directory="/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl"
    )

    window = session.active_window

    # Pane 0: All test messages (test.>)
    pane0 = window.active_pane
    pane0.send_keys(f"echo '=== TEST MESSAGES (test.>) ===' && nats sub 'test.>' -s {NATS_URL}")

    # Pane 1: KV bucket operations ($KV.>) - split right
    pane1 = window.split(direction=PaneDirection.Right)
    pane1.send_keys(f"echo '=== KV OPERATIONS ($KV.>) ===' && nats sub '$KV.>' -s {NATS_URL}")

    # Pane 2: All holonet messages (holonet.>) - split below pane0
    window.select_pane(pane0.pane_id)
    pane2 = window.split(direction=PaneDirection.Below)
    pane2.send_keys(f"echo '=== HOLONET MESSAGES (holonet.>) ===' && nats sub 'holonet.>' -s {NATS_URL}")

    # Pane 3: JetStream API activity ($JS.API.>) - split below pane1
    window.select_pane(pane1.pane_id)
    pane3 = window.split(direction=PaneDirection.Below)
    pane3.send_keys(f"echo '=== JETSTREAM API ($JS.API.>) ===' && nats sub '$JS.API.>' -s {NATS_URL}")

    # Even out the layout
    window.select_layout("tiled")

    # Create second window for server stats and wildcard catch-all
    window2 = session.new_window(window_name="server-stats")

    # Pane 0: NATS server stats (refreshing)
    pane_stats = window2.active_pane
    pane_stats.send_keys(f"watch -n 2 'nats server info -s {NATS_URL} 2>/dev/null || echo \"Waiting for NATS...\"'")

    # Pane 1: Stream info - split right
    pane_streams = window2.split(direction=PaneDirection.Right)
    pane_streams.send_keys(f"watch -n 3 'nats stream ls -s {NATS_URL} 2>/dev/null || echo \"No streams\"'")

    # Pane 2: KV bucket list - split below pane_stats
    window2.select_pane(pane_stats.pane_id)
    pane_kv = window2.split(direction=PaneDirection.Below)
    pane_kv.send_keys(f"watch -n 3 'nats kv ls -s {NATS_URL} 2>/dev/null || echo \"No KV buckets\"'")

    # Pane 3: Catch-all subscriber (>) - split below pane_streams
    window2.select_pane(pane_streams.pane_id)
    pane_all = window2.split(direction=PaneDirection.Below)
    pane_all.send_keys(f"echo '=== ALL MESSAGES (>) ===' && nats sub '>' -s {NATS_URL}")

    window2.select_layout("tiled")

    # Go back to first window
    session.select_window(window.window_id)

    print(f"Created tmux session: {SESSION_NAME}")
    print(f"")
    print(f"  Attach with: tmux attach -t {SESSION_NAME}")
    print(f"")
    print(f"Window 1 (nats-traffic):")
    print(f"  - test.>       : All test messages")
    print(f"  - holonet.>    : Holonet messages")
    print(f"  - $KV.>        : KV bucket operations")
    print(f"  - $JS.API.>    : JetStream API calls")
    print(f"")
    print(f"Window 2 (server-stats):")
    print(f"  - Server info  : NATS server status")
    print(f"  - Stream list  : JetStream streams")
    print(f"  - KV list      : KV buckets")
    print(f"  - >            : Catch-all subscriber")

if __name__ == "__main__":
    main()
