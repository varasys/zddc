#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== ZDDC Training Data Processor ==="
echo "Timestamp: $(date +%Y-%m-%d_%H-%M-%S)"

# Step 1: Combine raw interactions
echo "Step 1: Combining raw interactions..."
cat raw/*.jsonl > raw/all-interactions.jsonl 2>/dev/null || echo "No raw interactions yet"

# Step 2: Deduplicate by conversation content
echo "Step 2: Deduplicating..."
if [ -f raw/all-interactions.jsonl ]; then
    jq -s 'unique_by(.messages | tojson)' raw/all-interactions.jsonl > processed/all.jsonl
else
    echo "Warning: No raw interactions to deduplicate"
fi

# Step 3: Categorize by domain
echo "Step 3: Categorizing by domain..."

# Check if we have data to process
if [ -f processed/all.jsonl ]; then
    # Extract unique domains
    domains=$(jq -r '.metadata.domain' processed/all.jsonl | sort -u)
    
    for domain in $domains; do
        if [ -n "$domain" ]; then
            echo "  Processing domain: $domain"
            jq -s "grep(.metadata.domain == \"$domain\")" processed/all.jsonl > "processed/${domain}.jsonl" 2>/dev/null || \
                jq -s 'map(select(.metadata.domain == "'"$domain"'"))' processed/all.jsonl > "processed/${domain}.jsonl"
        fi
    done
else
    echo "Warning: No processed data found"
fi

# Step 4: Create multi-domain dataset
echo "Step 4: Creating multi-domain dataset..."
if [ -f processed/all.jsonl ]; then
    cp processed/all.jsonl processed/multi-domain.jsonl
fi

# Step 5: Initialize validation split (empty until we have data)
echo "Step 5: Splitting into train/val/test..."
mkdir -p validation

# Create empty placeholders if no data
if [ ! -f validation/train.jsonl ]; then
    touch validation/train.jsonl
fi
if [ ! -f validation/val.jsonl ]; then
    touch validation/val.jsonl
fi
if [ ! -f validation/test.jsonl ]; then
    touch validation/test.jsonl
fi

# Step 6: Create snapshot
echo "Step 6: Creating snapshot..."
SNAPSHOT_NAME="v$(date +%Y-%m-%d)"
mkdir -p snapshots/$SNAPSHOT_NAME

if [ -f processed/all.jsonl ]; then
    cp processed/all.jsonl snapshots/$SNAPSHOT_NAME/dataset.jsonl
    cp validation/*.jsonl snapshots/$SNAPSHOT_NAME/
fi

echo ""
echo "=== Processing Complete ==="

# Display summary
if [ -f processed/all.jsonl ]; then
    TOTAL=$(wc -l < processed/all.jsonl)
    VALIDATION=$(wc -l < processed/val.jsonl 2>/dev/null || echo 0)
    echo "Total examples: $TOTAL"
    
    echo ""
    echo "Domain breakdown:"
    if [ -f processed/all.jsonl ]; then
        jq -s 'group_by(.metadata.domain) | map({domain: .[0].metadata.domain, count: length})' processed/all.jsonl | jq '.[] | "  \(.domain): \(.count)"'
    fi
else
    echo "No data processed yet. Collect some interactions first."
fi

echo ""
echo "Next steps:"
echo "  1. Collect interactions: node collect-interaction.js --query \"...\" --qwen \"...\" --expert \"...\""
echo "  2. Process: bash process.sh"
echo "  3. Train: bash train.sh [domain]"
