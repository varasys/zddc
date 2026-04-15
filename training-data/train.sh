#!/usr/bin/env bash
set -euo pipefail

# train.sh — Train a LoRA adapter for Qwen3-Coder-Next
# Usage:
#   bash train.sh              # train on all domains (multi-domain)
#   bash train.sh zddc-naming  # train on a specific domain
#
# Output: adapters/<domain>-lora-v1/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DOMAIN="${1:-all}"
BASE_MODEL="Qwen/Qwen2.5-7B-Instruct"
LORA_RANK=64
LORA_ALPHA=64
LEARNING_RATE="1e-4"
NUM_EPOCHS=3
MAX_SEQ_LENGTH=2048
WARMUP_RATIO=0.1
WEIGHT_DECAY=0.01

if [ "$DOMAIN" = "all" ]; then
    TRAIN_FILE="validation/train.jsonl"
    OUTPUT_DIR="adapters/multi-domain-lora-v1"
else
    TRAIN_FILE="processed/${DOMAIN}.jsonl"
    OUTPUT_DIR="adapters/${DOMAIN}-lora-v1"
fi
VAL_FILE="validation/val.jsonl"

echo "=== ZDDC LoRA Fine-Tuning ==="
echo "Domain:        $DOMAIN"
echo "Base model:    $BASE_MODEL"
echo "Train file:    $TRAIN_FILE"
echo "Output dir:    $OUTPUT_DIR"
echo "LoRA rank:     $LORA_RANK / alpha: $LORA_ALPHA"
echo "Learning rate: $LEARNING_RATE  Epochs: $NUM_EPOCHS"
echo ""

if [ ! -f "$TRAIN_FILE" ]; then
    echo "Error: training file not found: $TRAIN_FILE"
    echo "Run bash process.sh first."
    exit 1
fi
TRAIN_COUNT=$(grep -c . "$TRAIN_FILE" 2>/dev/null || echo 0)
if [ "$TRAIN_COUNT" -eq 0 ]; then
    echo "Error: training file is empty. Collect at least 50 interactions first."
    exit 1
fi
echo "Training examples: $TRAIN_COUNT"

NO_EVAL=0
if [ ! -f "$VAL_FILE" ] || [ "$(grep -c . "$VAL_FILE" 2>/dev/null || echo 0)" -eq 0 ]; then
    echo "Warning: no validation data found. Skipping eval."
    NO_EVAL=1
fi

command -v python3 &>/dev/null || { echo "Error: python3 required"; exit 1; }

echo "Checking Python dependencies..."
python3 -c "import torch, transformers, peft, trl, datasets, accelerate" 2>/dev/null || {
    echo "Installing required packages..."
    pip install torch transformers peft trl datasets accelerate --quiet
}
echo "Dependencies OK"
echo ""

mkdir -p "$OUTPUT_DIR"

TRAIN_PY=$(mktemp /tmp/train_lora_XXXXXX.py)
trap 'rm -f "$TRAIN_PY"' EXIT

cat > "$TRAIN_PY" << 'PYEOF'
import json, sys, argparse, torch
from pathlib import Path
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments
from peft import LoraConfig, get_peft_model, TaskType
from trl import SFTTrainer

def load_jsonl(path):
    out = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out

def fmt(ex):
    text = ""
    for m in ex["messages"]:
        text += f"<|im_start|>{m['role']}\n{m['content']}<|im_end|>\n"
    return {"text": text}

p = argparse.ArgumentParser()
p.add_argument("--model_name", default="Qwen/Qwen2.5-7B-Instruct")
p.add_argument("--train_file", required=True)
p.add_argument("--val_file")
p.add_argument("--output_dir", required=True)
p.add_argument("--lora_rank", type=int, default=64)
p.add_argument("--lora_alpha", type=int, default=64)
p.add_argument("--learning_rate", type=float, default=1e-4)
p.add_argument("--num_epochs", type=int, default=3)
p.add_argument("--max_seq_length", type=int, default=2048)
p.add_argument("--warmup_ratio", type=float, default=0.1)
p.add_argument("--weight_decay", type=float, default=0.01)
p.add_argument("--no_eval", action="store_true")
args = p.parse_args()

print(f"Loading tokenizer: {args.model_name}")
tok = AutoTokenizer.from_pretrained(
    args.model_name, model_max_length=args.max_seq_length,
    padding_side="right", trust_remote_code=True)
if tok.pad_token is None:
    tok.pad_token = tok.eos_token

print("Loading base model...")
model = AutoModelForCausalLM.from_pretrained(
    args.model_name, torch_dtype=torch.bfloat16,
    device_map="auto", trust_remote_code=True)
model.gradient_checkpointing_enable()

print("Applying LoRA...")
lora_cfg = LoraConfig(
    r=args.lora_rank, lora_alpha=args.lora_alpha,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05, bias="none", task_type=TaskType.CAUSAL_LM)
model = get_peft_model(model, lora_cfg)
model.print_trainable_parameters()

train_ds = Dataset.from_list([fmt(d) for d in load_jsonl(args.train_file)])
print(f"Training examples: {len(train_ds)}")

eval_ds = None
if not args.no_eval and args.val_file:
    vp = Path(args.val_file)
    if vp.exists() and vp.stat().st_size > 0:
        vdata = load_jsonl(args.val_file)
        if vdata:
            eval_ds = Dataset.from_list([fmt(d) for d in vdata])
            print(f"Validation examples: {len(eval_ds)}")

ta = TrainingArguments(
    output_dir=args.output_dir,
    per_device_train_batch_size=4,
    per_device_eval_batch_size=4,
    gradient_accumulation_steps=2,
    learning_rate=args.learning_rate,
    num_train_epochs=args.num_epochs,
    warmup_ratio=args.warmup_ratio,
    weight_decay=args.weight_decay,
    lr_scheduler_type="cosine",
    bf16=True, fp16=False,
    logging_steps=10,
    save_steps=100,
    eval_steps=50 if eval_ds else None,
    evaluation_strategy="steps" if eval_ds else "no",
    save_strategy="steps",
    save_total_limit=3,
    load_best_model_at_end=(eval_ds is not None),
    report_to=[],
    seed=42,
)

trainer = SFTTrainer(
    model=model, args=ta,
    train_dataset=train_ds, eval_dataset=eval_ds,
    dataset_text_field="text",
    max_seq_length=args.max_seq_length,
    tokenizer=tok)

print("\nStarting training...")
trainer.train()

print(f"\nSaving adapter to {args.output_dir} ...")
trainer.model.save_pretrained(args.output_dir)
tok.save_pretrained(args.output_dir)
print(f"Done. Adapter saved to: {args.output_dir}")
PYEOF

CMD="python3 $TRAIN_PY \
  --model_name $BASE_MODEL \
  --train_file $TRAIN_FILE \
  --val_file $VAL_FILE \
  --output_dir $OUTPUT_DIR \
  --lora_rank $LORA_RANK \
  --lora_alpha $LORA_ALPHA \
  --learning_rate $LEARNING_RATE \
  --num_epochs $NUM_EPOCHS \
  --max_seq_length $MAX_SEQ_LENGTH \
  --warmup_ratio $WARMUP_RATIO \
  --weight_decay $WEIGHT_DECAY"

[ "$NO_EVAL" -eq 1 ] && CMD="$CMD --no_eval"

echo "Launching training..."
eval "$CMD"

echo ""
echo "=== Training Complete ==="
echo "Adapter: $OUTPUT_DIR"
echo "Next: bash test.sh $DOMAIN  OR  bash deploy.sh $DOMAIN"
