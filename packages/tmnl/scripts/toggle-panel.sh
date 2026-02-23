#!/usr/bin/env bash
# Toggle TMNL panel workspace via SIGUSR1
pkill -USR1 -f 'tmnl-panel$'
