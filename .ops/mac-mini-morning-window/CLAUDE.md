# CLAUDE.md — mac-mini-morning-window

Ops component that gives the `gbg` Mac mini (Apple Silicon, macOS 15, **Wi-Fi only**) a
scheduled sleep/wake/notify cycle. Read this before changing anything here.

## Mental model
- The mini **sleeps** between windows (draw ~1 W) and **wakes itself** via the SMC RTC alarm
  (`pmset`). It is NOT woken on demand — Apple-Silicon Wi-Fi WoL is unreliable, scheduled
  RTC wake is reliable. Design around scheduled windows, never magic packets.
- Two independent trigger layers must stay in agreement:
  1. **`pmset`** decides *when the hardware is awake* (`repeat wakeorpoweron` for the daily
     07:00; one-shot `schedule wake` armed by `window-manager.sh` for later windows).
  2. **launchd** (`com.gbg.morning.window`, `StartCalendarInterval`) decides *what runs* at
     those times. If you add/move a window, update BOTH the plist times and the pmset lines.

## Files
- `notify.sh` — ntfy push + optional SMTP email. Pure, config-driven.
- `boot-notify.sh` — cold-boot ping only (RunAtLoad). Not used on normal sleep/wake days.
- `window-manager.sh` — the core: announce → grace → guards → arm next wake → sleep.
- `install.sh` / `uninstall.sh` — the only privileged entry points.
- `launchd/*.plist` — daemon definitions. Installed to `/Library/LaunchDaemons`.
- `notify.env.template` — config template; real values live in `/etc/gbg-morning/notify.env`.

## Invariants (do not break)
1. **Single sudo touchpoint.** All privileged actions go through `install.sh`/`uninstall.sh`.
   Do not scatter `sudo` into other scripts.
2. **Secrets never committed.** `notify.env` is git-ignored and root-owned 0600. The ntfy
   topic and SMTP creds exist only under `/etc/gbg-morning/`. Never hardcode them.
3. **Business-safety first.** The auto-sleep MUST keep its three guards (veto file / console
   idle / ssh session). When in doubt, stay awake. Never remove a guard to "simplify".
4. **Namespaced + reversible.** Everything is `com.gbg.morning.*` / `gbg-morning`.
   `uninstall.sh` must fully undo `install.sh`. Touch nothing outside this namespace.
5. **Scope.** This component only writes under `.ops/mac-mini-morning-window/` in-repo and
   the `gbg-morning` paths on the host. Do not modify business packages in `packages/*`.

## Verify without installing
```bash
bash -n *.sh && shellcheck *.sh          # syntax + lint (shellcheck optional)
plutil -lint launchd/*.plist             # plist validity
GBG_NOTIFY_ENV=/dev/null ./notify.sh "Test" "hi"   # no-op safely (no topic set)
```
Live checks after install: `pmset -g sched`, `sudo launchctl print system/com.gbg.morning.window`,
`tail -f /var/log/gbg-morning.log`, and `touch /tmp/gbg-no-sleep` to confirm the veto path.

## Gotchas
- Cold boot at 07:00 fires BOTH `boot-notify` (RunAtLoad) and `window` (07:00) → one extra
  push. Acceptable; only happens from a true power-off, not sleep/wake.
- HHMM window compare uses `10#` base to avoid octal parse errors on `08`/`09`.
- The repo working tree has a pre-existing `DataGridTestbed.tsx` case-collision (macOS
  case-insensitive FS). Not ours — never stage it. Commit with explicit `git add .ops/...`.
