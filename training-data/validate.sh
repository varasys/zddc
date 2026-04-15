#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DOMAIN="${1:-all}"
PASS=0
WARN=0
FAIL=0

ok()   { echo "  ✓ $*"; ((PASS+=1)) || true; }
warn() { echo "  ⚠ $*"; ((WARN+=1)) || true; }
fail() { echo "  ✗ $*"; ((FAIL+=1)) || true; }

echo "=== ZDDC Training Data Validator ==="
echo "Domain: $DOMAIN"
echo ""

echo "[ Raw Data ]"
RAW_FILE="raw/interactions.jsonl"
if [ ! -f "$RAW_FILE" ]; then
    warn "No raw interactions file found. Collect interactions first."
else
    RAW_COUNT=$(grep -c . "$RAW_FILE" 2>/dev/null || echo 0)
    ok "Raw interactions: $RAW_COUNT"
fi

echo ""
echo "[ JSONL Validity ]"
check_jsonl() {
    local file="$1"
    if [ ! -f "$file" ]; then warn "File not found: $file"; return; fi
    if [ ! -s "$file" ]; then warn "File is empty: $file"; return; fi
    local count
    count=$(grep -c . "$file" 2>/dev/null || echo 0)
    ok "$file — $count lines"
}

if [ "$DOMAIN" = "all" ]; then
    for f in processed/*.jsonl validation/*.jsonl; do
        [ -f "$f" ] && check_jsonl "$f"
    done
else
    check_jsonl "processed/${DOMAIN}.jsonl"
fi

echo ""
echo "[ Domain Balance ]"
if [ -f "processed/all.jsonl" ] && [ -s "processed/all.jsonl" ]; then
    python3 -c "
import json
from collections import Counter
counts = Counter()
with open('processed/all.jsonl') as f:
    for line in f:
        line = line.strip()
        if line:
            try:
                obj = json.loads(line)
                domain = obj.get('metadata', {}).get('domain', 'unknown')
                counts[domain] += 1
            except Exception:
                pass
if not counts:
    print('  no domain data found')
else:
    print(f'  Total: {sum(counts.values())} examples')
    for domain, count in sorted(counts.items(), key=lambda x: -x[1]):
        status = 'OK' if count >= 200 else 'LOW'
        print(f'  [{status}] {domain}: {count}')
"
else
    warn "processed/all.jsonl not found — run bash process.sh first"
fi

echo ""
echo "[ Train/Val/Test Split ]"
for split in train val test; do
    f="validation/${split}.jsonl"
    if [ ! -f "$f" ] || [ ! -s "$f" ]; then
        warn "$split split missing or empty"
    else
        count=$(grep -c . "$f" 2>/dev/null || echo 0)
        ok "$split: $count examples"
    fi
done

echo ""
echo "[ Existing Adapters ]"
if [ -d "adapters" ] && [ "$(ls -A adapters 2>/dev/null)" ]; then
    for adapter_dir in adapters/*/; do
        name=$(basename "$adapter_dir")
        if [ -f "${adapter_dir}adapter_config.json" ]; then
            ok "$name (trained)"
        else
            warn "$name (incomplete)"
        fi
    done
else
    echo "  (no adapters yet)"
fi

echo ""
echo "================================="
echo "PASS: $PASS   WARN: $WARN   FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
    echo "Status: FAIL"
    exit 1
elif [ "$WARN" -gt 0 ]; then
    echo "Status: WARN"
else
    echo "Status: PASS"
fi
