#!/bin/bash
# build-interaction-collector.sh
# Install dependencies for the interaction collector

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Installing Node.js Dependencies ==="

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

# Check minimal version
NODE_MAJOR=$(echo $NODE_VERSION | cut -c2- | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "Error: Node.js 18+ is required"
    exit 1
fi

echo "✓ Node.js version check passed"

# Create package.json if it doesn't exist
if [ ! -f package.json ]; then
    cat > package.json << 'EOF'
{
  "name": "zddc-training-data",
  "version": "1.0.0",
  "description": "Training data collection for ZDDC fine-tuning",
  "type": "module",
  "main": "collect-interaction.js",
  "scripts": {
    "collect": "node collect-interaction.js"
  },
  "keywords": ["zddc", "training", "lora"],
  "license": "MIT"
}
EOF
fi

echo "✓ Created/verified package.json"
echo ""
echo "=== Ready to use ==="
echo "Usage: node collect-interaction.js --query \"...\" --qwen \"...\" --expert \"...\""
echo "       node collect-interaction.js --query \"How do I...\" --qwen \"[Qwen answer]\" --expert \"[Expert answer]\""
echo ""
echo "To batch process interactions, use process.sh"
