#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/matchmaking"

if [ ! -d node_modules ]; then
  echo "Installing matchmaking dependencies..."
  npm install
fi

echo "Starting Aetheryn Matchmaking..."
node index.js
