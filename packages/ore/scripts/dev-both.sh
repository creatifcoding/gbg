#!/bin/bash

# Run Windows build in background
bash scripts/build-windows.sh &

# Run WSLg version in foreground
bunx tauri dev
