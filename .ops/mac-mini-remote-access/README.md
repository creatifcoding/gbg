# mac-mini-remote-access

Reach the `gbg` Mac mini over the Tailscale tailnet — terminal (Tailscale SSH + herdr),
and GUI (macOS Screen Sharing / VNC). Companion to `../mac-mini-morning-window`.

## Model
The mini sleeps between scheduled windows (see `mac-mini-morning-window`). This bundle makes
it **reachable whenever it is awake** and reconnects Tailscale automatically on each wake — it
deliberately does **not** force the machine to stay awake. To hold a session open past the
15-min window, stay active or `touch /tmp/gbg-no-sleep` (the sleep guard keeps it up).

## Installs
- **Tailscale** as a system daemon (`tailscaled`) — reconnects before login and on wake.
- **Tailscale SSH** (`--ssh`) — SSH in from any of your tailnet devices, no key management.
- **Screen Sharing** (VNC :5900) — macOS GUI, auths against your login.
- **herdr server** LaunchAgent — your herdr sessions are up and `--remote`-attachable.

## Install
```bash
cd .ops/mac-mini-remote-access
sudo ./install.sh
sudo tailscale up --ssh --accept-routes    # one-time browser auth
tailscale ip -4
```

## Connect (while the mini is awake)
```bash
ssh <user>@<tailscale-ip>                 # terminal
herdr --remote <user>@<tailscale-ip>      # attach herdr sessions
# GUI: Screen Sharing.app -> vnc://<tailscale-ip>
```

## Uninstall
```bash
sudo ./uninstall.sh
```

See `../mac-mini-morning-window/CLAUDE.md` for the shared invariants (namespaced, reversible,
no secrets in git).
