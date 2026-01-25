#!/usr/bin/env bash
# LEANN wrapper script with nix library paths
# Usage: ./scripts/leann-wrapper.sh [leann args...]

export LD_LIBRARY_PATH="/nix/store/xm08aqdd7pxcdhm0ak6aqb1v7hw5q6ri-gcc-14.3.0-lib/lib:/nix/store/8icpg7vrz95c6ap3mznmlmg7h0l2av1w-zlib-1.3.1/lib:$LD_LIBRARY_PATH"

exec leann "$@"
