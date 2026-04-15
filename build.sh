#!/bin/sh
set -eu

# Top-level build script — builds all ZDDC HTML tools in sequence.
# Each tool's build.sh is responsible for producing its own dist/ output.

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

echo "=== Building ZDDC tools ==="

sh "$SCRIPT_DIR/transmittal/build.sh"
sh "$SCRIPT_DIR/archive/build.sh"
sh "$SCRIPT_DIR/classifier/build.sh"
sh "$SCRIPT_DIR/mdedit/build.sh"

echo "=== All tools built successfully ==="
