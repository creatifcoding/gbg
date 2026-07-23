# AGENTS.md — mac-mini-morning-window

Guidance for autonomous agents (Claude Code, cowork/computer-use, Copilot) operating on
this component. Pairs with `CLAUDE.md` (invariants).

## What this is
A self-contained macOS ops bundle: scheduled sleep/wake/notify for the `gbg` Mac mini over
Wi-Fi. Shell + launchd + pmset only. No build step, not part of the bun `packages/*`
workspace — it lives under `.ops/` deliberately.

## Rules of engagement
- **Stay in scope:** only `.ops/mac-mini-morning-window/` in-repo and `gbg-morning`-namespaced
  host paths (`/usr/local/lib/gbg-morning`, `/etc/gbg-morning`, `/Library/LaunchDaemons/com.gbg.morning.*`,
  `/var/log/gbg-morning.log`). Never touch `packages/*` or other business code.
- **Privilege:** only `install.sh`/`uninstall.sh` use sudo. Keep it that way.
- **Secrets:** never read, print, or commit `/etc/gbg-morning/notify.env`. It is git-ignored.
- **Safety:** never weaken the auto-sleep guards. A change that could sleep a machine
  someone is using is a defect.
- **Reversibility:** any new host-side effect must be undone by `uninstall.sh`.

## Validate before proposing a change
```bash
bash -n *.sh && shellcheck *.sh
plutil -lint launchd/*.plist
```

## Commit / branch conventions (this repo)
- Work on a `claude/<topic>` branch (matches existing `claude/*` and `copilot/*` branches).
- Commit only your files: `git add .ops/mac-mini-morning-window && git commit`.
- The `gbg` remote uses per-account SSH aliases: push with
  `git@github-creatifcoding:creatifcoding/gbg.git`.

## Common tasks
- **Add a window:** edit `WINDOWS` in `notify.env`, add a `StartCalendarInterval` dict in
  `com.gbg.morning.window.plist`, and keep the `pmset repeat` daily anchor in `install.sh`
  consistent. Reload: `sudo launchctl kickstart -k system/com.gbg.morning.window`.
- **Change notifier:** `notify.sh` is the only integration point (ntfy + generic SMTP).
- **Add email via openship/other SMTP:** set `SMTP_URL`/`MAIL_FROM`/`SMTP_USER`/`SMTP_PASS`
  in `notify.env`. No code change.
