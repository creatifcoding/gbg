#!/usr/bin/env python3
"""
PRAGMA Golden Reference Generator

Generates reference tokenizer and embedding outputs from Python (HuggingFace)
for cross-backend equivalence testing against Candle/Rust.

Requirements:
  pip install transformers torch numpy

Usage:
  python pragma-golden-gen.py --output ../golden-corpus/reference/
"""

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np


def load_corpus(corpus_dir: Path) -> list[dict]:
    """Load all corpus entries from JSON files."""
    entries = []
    for f in sorted(corpus_dir.glob("*.json")):
        if f.name == "manifest.json":
            continue
        with open(f) as fh:
            data = json.load(fh)
            entries.extend(data)
    return entries


def generate_tokenizer_reference(entries: list[dict], output_dir: Path):
    """Generate reference tokenizer outputs using HuggingFace tokenizers."""
    from transformers import AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")

    results = []
    for entry in entries:
        prompt = entry["prompt"]
        encoded = tokenizer(prompt, padding=False, truncation=True, max_length=128)
        results.append({
            "id": entry["id"],
            "prompt": prompt,
            "input_ids": encoded["input_ids"],
            "attention_mask": encoded["attention_mask"],
            "token_type_ids": encoded.get("token_type_ids", [0] * len(encoded["input_ids"])),
            "num_tokens": len(encoded["input_ids"]),
        })

    out_path = output_dir / "tokenizer_reference.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"  Tokenizer reference: {len(results)} entries → {out_path}")
    return results


def generate_embedding_reference(entries: list[dict], output_dir: Path):
    """Generate reference embeddings using HuggingFace sentence-transformers."""
    import torch
    from transformers import AutoModel, AutoTokenizer

    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name)
    model.eval()

    results = []
    for entry in entries:
        prompt = entry["prompt"]
        encoded = tokenizer(prompt, return_tensors="pt", padding=True, truncation=True, max_length=128)

        with torch.no_grad():
            outputs = model(**encoded)
            # Mean pooling with attention mask
            attention_mask = encoded["attention_mask"]
            token_embeddings = outputs.last_hidden_state
            input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
            sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
            sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
            embedding = (sum_embeddings / sum_mask).squeeze().numpy()

        results.append({
            "id": entry["id"],
            "prompt": prompt,
            "embedding": embedding.tolist(),
            "dim": len(embedding),
            "norm": float(np.linalg.norm(embedding)),
        })

    out_path = output_dir / "embedding_reference.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"  Embedding reference: {len(results)} entries → {out_path}")
    return results


def generate_bertscore_reference(entries: list[dict], output_dir: Path):
    """Generate reference BERTScore pairs for scoring validation."""
    import torch
    from transformers import AutoModel, AutoTokenizer

    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name)
    model.eval()

    def embed(text: str) -> np.ndarray:
        encoded = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=128)
        with torch.no_grad():
            outputs = model(**encoded)
            attention_mask = encoded["attention_mask"]
            token_embeddings = outputs.last_hidden_state
            input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
            sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
            sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
            return (sum_embeddings / sum_mask).squeeze().numpy()

    # Generate pairs: self-reference, close match, distant
    pairs = []
    prompts = [e["prompt"] for e in entries if e["prompt"]][:20]

    for i, prompt in enumerate(prompts):
        ref_emb = embed(prompt)

        # Self-reference
        pairs.append({
            "id": f"bertscore-self-{i:03d}",
            "reference": prompt,
            "hypothesis": prompt,
            "expected_f1_min": 0.99,
            "expected_f1_max": 1.0,
            "category": "self-reference",
        })

        # Distant pair (next category if available)
        if i + 10 < len(prompts):
            pairs.append({
                "id": f"bertscore-distant-{i:03d}",
                "reference": prompt,
                "hypothesis": prompts[i + 10],
                "expected_f1_min": 0.0,
                "expected_f1_max": 0.95,
                "category": "distant",
            })

    out_path = output_dir / "bertscore_reference.json"
    with open(out_path, "w") as f:
        json.dump(pairs, f, indent=2)
    print(f"  BERTScore reference: {len(pairs)} pairs → {out_path}")


def main():
    parser = argparse.ArgumentParser(description="PRAGMA golden reference generator")
    parser.add_argument("--corpus", type=Path, default=Path(__file__).parent.parent / "golden-corpus")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent.parent / "golden-corpus" / "reference")
    parser.add_argument("--skip-embeddings", action="store_true", help="Skip embedding generation (slow)")
    parser.add_argument("--skip-bertscore", action="store_true", help="Skip BERTScore pair generation")
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)

    print(f"Loading corpus from {args.corpus}")
    entries = load_corpus(args.corpus)
    print(f"  Loaded {len(entries)} entries")

    print("\nGenerating tokenizer reference...")
    generate_tokenizer_reference(entries, args.output)

    if not args.skip_embeddings:
        print("\nGenerating embedding reference...")
        generate_embedding_reference(entries, args.output)
    else:
        print("\nSkipping embeddings (--skip-embeddings)")

    if not args.skip_bertscore:
        print("\nGenerating BERTScore reference pairs...")
        generate_bertscore_reference(entries, args.output)
    else:
        print("\nSkipping BERTScore (--skip-bertscore)")

    print("\n✓ Done")


if __name__ == "__main__":
    main()
