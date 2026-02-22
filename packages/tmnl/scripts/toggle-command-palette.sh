#!/usr/bin/env bash
# Toggle the TMNL command palette.
# Sends SIGUSR1 to the tmnl-shell process, which toggles the palette window.
pkill -USR1 -f 'tmnl-shell$' 2>/dev/null
