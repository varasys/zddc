# ZDDC Training Data Pipeline

Adaptive LoRA fine-tuning for **Qwen3-Coder-Next** (`vllm/RedHatAI/Qwen3-Coder-Next-NVFP4`).

Training data is collected reactively: when Qwen struggles on a task and a stronger model (Sonnet/Opus) is consulted, that interaction is captured as a training example. Over time, domain-specific LoRA adapters are trained to patch Qwen's weak spots.

---

## Directory Layout

```
training-data/
├── raw/
│   └── interactions.jsonl      # All captured weak-spot interactions
├── processed/
│   ├── all.jsonl               # Deduplicated, combined dataset
│   ├── multi-domain.jsonl      # All domains merged
│   └── <domain>.jsonl          # Per-domain splits (auto-generated)
├── validation/
│   ├── train.jsonl             # 80% split
│   ├── val.jsonl               # 10% split
│   └── test.jsonl              # 10% split (never used during training)
├── adapters/
│   └── <domain>-lora-v1/       # Trained LoRA adapter
│   └── <domain>-lora-v1-merged/ # Merged standalone model
├── snapshots/
│   └── v<date>/                # Versioned dataset snapshots
├── collect-interaction.js      # Capture a weak-spot interaction
├── process.sh                  # Cluster raw data into domain splits
├── validate.sh                 # Check data quality before training
├── train.sh                    # Train a LoRA adapter
└── deploy.sh                   # Merge adapter into standalone model
```

---

## Workflow

### Step 1 — Collect a weak-spot interaction

When Qwen gets stuck or you ask it to consult Sonnet/Opus:

```bash
node collect-interaction.js \
  --query  "How do I parse ZDDC filenames?" \
  --qwen   "[Qwen's suboptimal answer]" \
  --expert "[Sonnet's correct answer]"
```

Optionally specify domain explicitly (otherwise auto-detected):

```bash
node collect-interaction.js \
  --query  "..." \
  --qwen   "..." \
  --expert "..." \
  --domain zddc-naming
```

Raw interaction is appended to `raw/interactions.jsonl`.

### Step 2 — Process (after ~50 new interactions)

```bash
bash process.sh
```

Deduplicates, clusters by domain, creates train/val/test splits.

### Step 3 — Validate

```bash
bash validate.sh
```

Checks JSONL validity, domain balance, and split sizes.

### Step 4 — Train

```bash
bash train.sh              # train multi-domain adapter
bash train.sh zddc-naming  # train domain-specific adapter
```

Outputs LoRA adapter to `adapters/<domain>-lora-v1/`.

### Step 5 — Deploy (optional)

```bash
bash deploy.sh             # merge multi-domain adapter
bash deploy.sh zddc-naming # merge specific adapter
```

Merges the LoRA weights into the base model and saves a standalone model.

---

## Training Data Format

Each line in a `.jsonl` file is one training example:

```json
{
  "messages": [
    {"role": "user",      "content": "Query that exposed weakness"},
    {"role": "assistant", "content": "Qwen's original response"},
    {"role": "user",      "content": "consult Sonnet"},
    {"role": "assistant", "content": "Expert's correct response"}
  ],
  "metadata": {
    "domain":         "zddc-naming",
    "adapter":        "lora-v1-zddc_naming",
    "timestamp":      "2025-10-31T14:30:00.000Z",
    "interaction_id": "int_1735648200000_abc123",
    "source":         "manual-expert-consultation"
  }
}
```

---

## Auto-Detected Domains

| Domain | Trigger keywords |
|--------|----------------|
| `zddc-naming` | zddc, trackingnumber, revision, status code |
| `html-architecture` | html, spa, single-file, es module, vanilla js |
| `build-system` | build.sh, dist/, template.html |
| `coding-debugging` | debug, error, fix, console |
| `reasoning-architecture` | reason, analyze, architecture, design |
| `general-coding` | (default) |

---

## LoRA Configuration

| Parameter | Value | Notes |
|-----------|-------|-------|
| Base model | `Qwen/Qwen2.5-7B-Instruct` | Replace with Qwen3 when available on HF |
| Rank | 64 | Increase to 128 if underfitting |
| Alpha | 64 | 1:1 with rank |
| Target modules | q_proj, v_proj, k_proj, o_proj | All attention projections |
| Dropout | 0.05 | Light regularisation |
| Learning rate | 1e-4 | Cosine decay with 10% warmup |
| Epochs | 3 | Monitor val loss to catch overfitting |
| Batch size | 8 effective | 4 per-device × 2 gradient accumulation |
| Precision | bfloat16 | Requires Ampere GPU or newer |

---

## Hardware Requirements

| Setup | Min VRAM | Method | Notes |
|-------|----------|--------|-------|
| Qwen-7B LoRA | 24 GB | LoRA bf16 | Recommended |
| Qwen-7B QLoRA | 16 GB | QLoRA 4-bit | Add `--load_in_4bit` flag |
| Qwen-14B LoRA | 48 GB | LoRA bf16 | Better quality |

Your system has 96 GB VRAM — full LoRA on Qwen-14B is feasible.

---

## When to Retrain

- Every **50–100 new interactions** collected
- When a new domain accumulates **200+ examples**
- After a major project phase where Qwen struggled repeatedly
