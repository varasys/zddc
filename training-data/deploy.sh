#!/usr/bin/env bash
set -euo pipefail

# deploy.sh — Merge a trained LoRA adapter into a standalone model
# Usage:
#   bash deploy.sh                  # deploy multi-domain adapter
#   bash deploy.sh zddc-naming      # deploy specific domain adapter
#
# Output: adapters/<domain>-lora-v1-merged/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DOMAIN="${1:-multi-domain}"
BASE_MODEL="Qwen/Qwen2.5-7B-Instruct"
ADAPTER_DIR="adapters/${DOMAIN}-lora-v1"
MERGED_DIR="adapters/${DOMAIN}-lora-v1-merged"

echo "=== ZDDC LoRA Deployment ==="
echo "Domain:     $DOMAIN"
echo "Adapter:    $ADAPTER_DIR"
echo "Output:     $MERGED_DIR"
echo ""

if [ ! -d "$ADAPTER_DIR" ]; then
    echo "Error: adapter not found: $ADAPTER_DIR"
    echo "Run: bash train.sh $DOMAIN"
    exit 1
fi
if [ ! -f "$ADAPTER_DIR/adapter_config.json" ]; then
    echo "Error: adapter incomplete (missing adapter_config.json)"
    exit 1
fi

command -v python3 &>/dev/null || { echo "Error: python3 required"; exit 1; }
python3 -c "import torch, transformers, peft" 2>/dev/null || \
    pip install torch transformers peft --quiet

mkdir -p "$MERGED_DIR"

DEPLOY_PY=$(mktemp /tmp/deploy_lora_XXXXXX.py)
trap 'rm -f "$DEPLOY_PY"' EXIT

cat > "$DEPLOY_PY" << 'PYEOF'
import sys, os, torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

base_model_name = sys.argv[1]
adapter_dir     = sys.argv[2]
merged_dir      = sys.argv[3]

print(f"Loading base model: {base_model_name}")
tok = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    base_model_name, torch_dtype=torch.bfloat16,
    device_map="auto", trust_remote_code=True)

print(f"Loading adapter: {adapter_dir}")
model = PeftModel.from_pretrained(model, adapter_dir)

print("Merging weights into base model...")
model = model.merge_and_unload()

print(f"Saving merged model to {merged_dir} ...")
model.save_pretrained(merged_dir, safe_serialization=True)
tok.save_pretrained(merged_dir)

print("\nRunning test inference...")
prompt = "<|im_start|>user\nWhat is the ZDDC file naming convention?<|im_end|>\n<|im_start|>assistant\n"
inputs = tok(prompt, return_tensors="pt").to(model.device)
with torch.no_grad():
    out = model.generate(
        **inputs, max_new_tokens=128, temperature=0.7,
        do_sample=True, pad_token_id=tok.eos_token_id)
response = tok.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
print(f"Test prompt:    What is the ZDDC file naming convention?")
print(f"Model response: {response}")

size = sum(
    os.path.getsize(os.path.join(merged_dir, f))
    for f in os.listdir(merged_dir)
    if os.path.isfile(os.path.join(merged_dir, f)))
print(f"\nMerged model size: {size/(1024**3):.2f} GB")
print(f"Saved to: {merged_dir}")
PYEOF

python3 "$DEPLOY_PY" "$BASE_MODEL" "$ADAPTER_DIR" "$MERGED_DIR"

echo ""
echo "=== Deployment Complete ==="
echo "Merged model: $MERGED_DIR"
echo ""
echo "To use:"
echo "  from transformers import AutoTokenizer, AutoModelForCausalLM"
echo "  model = AutoModelForCausalLM.from_pretrained('$MERGED_DIR')"
echo "  tokenizer = AutoTokenizer.from_pretrained('$MERGED_DIR')"
