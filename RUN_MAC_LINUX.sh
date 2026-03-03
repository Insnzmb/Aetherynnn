#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "=== AETHERYN WEB: One-Click Launcher (Mac/Linux) ==="
echo "Folder: $(pwd)"
echo

node tools/launcher.cjs
