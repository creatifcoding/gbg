# mac-mini-morning-window

Unattended daily **power windows** for the `gbg` Mac mini (Apple Silicon M4 Pro, macOS 15,
Wi-Fi only). The machine sleeps most of the day (draw ≈ 0.2–1 W, "next to nothing"),
**wakes itself** on a schedule via the SMC RTC alarm, pings your phone, holds a short
window for you to act, then sleeps again.

No Wake-on-LAN, no Ethernet. On-demand remote wake over Wi-Fi is unreliable on Apple
Silicon — **scheduled wake-from-sleep is not**, so the design leans entirely on scheduled
windows instead of magic packets.

## Daily cycle

| Time     | Event |
|----------|-------|
| 07:00    | RTC wakes the mini (`pmset repeat wakeorpoweron`, works from sleep *or* full off). |
| 07:00    | `window-manager` pushes "window open", holds 15 min, arms an 11:00 wake, sleeps. |
| 07:00–11:00 | Asleep (~1 W). |
| 11:00    | RTC wake (armed at 07:00) → "window open" → 15 min → sleeps. |
| overnight | Asleep until tomorrow 07:00. |

Windows are configurable — set `WINDOWS="07:00 11:00 15:00"` in the env file for more.

## Business-safety guards

The 15-min auto-sleep is **cancelled** (machine stays awake, next window still fires) if:

1. **Veto file** — `touch /tmp/gbg-no-sleep`.
2. **Console in use** — human input within `IDLE_GUARD_SECONDS` (default 180 s).
3. **Active ssh/terminal session** — you're remoted in.

Powering **on/waking** is always harmless; only the guarded sleep can touch a live session,
and it errs toward staying awake. Everything is namespaced `com.gbg.morning.*`, logs to
`/var/log/gbg-morning.log`, and is fully reversible with `uninstall.sh`.

## Notifications

- **Primary: ntfy.sh** — free, no account. `install.sh` generates a private random topic
  into `/etc/gbg-morning/notify.env`. Install the **ntfy** app (iOS/Android), subscribe to
  that topic.
- **Optional email:** any SMTP relay (`SMTP_URL` + `MAIL_FROM`/`SMTP_USER`/`SMTP_PASS`) —
  Gmail app-password, an openship relay, whatever.

> The ntfy topic is effectively a shared secret; it lives only in the root-owned,
> `git`-ignored `/etc/gbg-morning/notify.env`.

## Install / uninstall

```bash
cd .ops/mac-mini-morning-window
sudo ./install.sh      # single privileged step; fires a test push immediately
# ...
sudo ./uninstall.sh    # full rollback
```

## Tuning

Edit `/etc/gbg-morning/notify.env` (`WINDOWS`, `GRACE_SECONDS`, `IDLE_GUARD_SECONDS`), then
reload: `sudo launchctl kickstart -k system/com.gbg.morning.window`. To change window times
you must also edit `StartCalendarInterval` in `launchd/com.gbg.morning.window.plist` and the
`pmset repeat` line in `install.sh` (the RTC wake and the launchd trigger must agree).

See `CLAUDE.md` / `AGENTS.md` for invariants before modifying.
