#!/bin/bash
set -e

# Add Windows target if not already added
rustup target add x86_64-pc-windows-gnu

# Build for Windows
cd src-tauri
cargo build --target x86_64-pc-windows-gnu

# Get the exe path
EXE_PATH="$(pwd)/target/x86_64-pc-windows-gnu/debug/tmnl.exe"

# Convert WSL path to Windows path
WIN_PATH=$(wslpath -w "$EXE_PATH")

# Launch on Windows in hidden window
powershell.exe -Command "Start-Process -WindowStyle Hidden '$WIN_PATH'"
