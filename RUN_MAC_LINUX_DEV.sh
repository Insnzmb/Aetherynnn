#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

export DEV_BUILD=on
echo "=== AETHERYN WEB: DEV Launcher (Mac/Linux) ==="
echo "DEV_BUILD=on (dev console + AI trace enabled)"

node tools/launcher.cjs
