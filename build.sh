#!/usr/bin/env bash
set -euo pipefail

# Top-level build script — builds all ZDDC HTML tools in sequence.
# Each tool's build.sh is responsible for producing its own dist/ output.

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

echo "=== Building ZDDC tools ==="

bash "$SCRIPT_DIR/transmittal/build.sh"
bash "$SCRIPT_DIR/archive/build.sh"
bash "$SCRIPT_DIR/classifier/build.sh"
bash "$SCRIPT_DIR/mdedit/build.sh"

echo "=== All tools built successfully ==="
