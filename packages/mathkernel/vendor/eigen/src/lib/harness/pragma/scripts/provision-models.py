#!/usr/bin/env python3
"""PRAGMA model provisioning script.

Downloads HuggingFace models, exports to ONNX, quantizes to INT8,
and places them in the PRAGMA models directory.

Usage:
    python provision-models.py [--models-dir DIR] [--model ID] [--dry-run]

Environment:
    PRAGMA_MODELS_DIR  Override models directory (default: ~/.local/share/pragma/models)

Requirements:
    pip install transformers[onnx] optimum onnxruntime torch
"""

import argparse
import json
import os
import sys
from pathlib import Path

def get_models_dir(override: str | None = None) -> Path:
    if override:
        return Path(override)
    env = os.environ.get("PRAGMA_MODELS_DIR")
    if env:
        return Path(env)
    xdg = os.environ.get("XDG_DATA_HOME")
    if xdg:
        return Path(xdg) / "pragma" / "models"
    return Path.home() / ".local" / "share" / "pragma" / "models"

def load_manifest() -> dict:
    manifest_path = Path(__file__).parent.parent / "pragma-core" / "models" / "manifest.json"
    with open(manifest_path) as f:
        return json.load(f)

def provision_model(model_def: dict, models_dir: Path, dry_run: bool = False) -> bool:
    """Download, export, and quantize a single model."""
    model_id = model_def["id"]
    hf_repo = model_def["hf_repo"]
    target_dir = models_dir / model_id

    print(f"\n{'='*60}")
    print(f"Provisioning: {model_def['display_name']}")
    print(f"  HF repo:    {hf_repo}")
    print(f"  Target:     {target_dir}")
    print(f"  Quant:      {model_def['quantization']}")
    print(f"  Required:   {model_def['required']}")

    # Check if already provisioned
    required_files = [f["name"] for f in model_def["files"]]
    if all((target_dir / f).exists() for f in required_files):
        print(f"  ✓ Already provisioned")
        return True

    if dry_run:
        print(f"  [dry-run] Would download and export")
        return True

    target_dir.mkdir(parents=True, exist_ok=True)

    try:
        from optimum.onnxruntime import ORTModelForFeatureExtraction, ORTQuantizer
        from optimum.onnxruntime.configuration import AutoQuantizationConfig
        from transformers import AutoTokenizer

        # Step 1: Download tokenizer
        print(f"  Downloading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(hf_repo)
        tokenizer.save_pretrained(str(target_dir))

        # Step 2: Export to ONNX
        print(f"  Exporting to ONNX...")
        if model_def["role"] == "encoder":
            model = ORTModelForFeatureExtraction.from_pretrained(
                hf_repo, export=True
            )
            model.save_pretrained(str(target_dir))
        elif model_def["role"] == "scorer":
            # BLEURT needs special handling — use optimum export directly
            from optimum.exporters.onnx import main_export
            main_export(hf_repo, str(target_dir), task="text-classification")

        # Step 3: Quantize to INT8
        if model_def["quantization"] == "int8":
            print(f"  Quantizing to INT8...")
            onnx_path = target_dir / "model.onnx"
            if onnx_path.exists():
                quantizer = ORTQuantizer.from_pretrained(str(target_dir))
                qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False)
                quantizer.quantize(save_dir=str(target_dir), quantization_config=qconfig)

        # Verify
        missing = [f for f in required_files if not (target_dir / f).exists()]
        if missing:
            print(f"  ✗ Missing after export: {missing}")
            return False

        size_mb = sum(
            (target_dir / f).stat().st_size for f in required_files
            if (target_dir / f).exists()
        ) / 1_000_000
        print(f"  ✓ Done ({size_mb:.1f}MB)")
        return True

    except ImportError as e:
        print(f"  ✗ Missing dependency: {e}")
        print(f"    Install: pip install transformers[onnx] optimum onnxruntime torch")
        return False
    except Exception as e:
        print(f"  ✗ Failed: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="PRAGMA model provisioning")
    parser.add_argument("--models-dir", help="Override models directory")
    parser.add_argument("--model", help="Provision specific model ID only")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    parser.add_argument("--status", action="store_true", help="Show provisioning status")
    args = parser.parse_args()

    models_dir = get_models_dir(args.models_dir)
    manifest = load_manifest()

    if args.status:
        print(f"Models directory: {models_dir}")
        print(f"Total models: {len(manifest['models'])}")
        for m in manifest["models"]:
            target = models_dir / m["id"]
            files = [f["name"] for f in m["files"]]
            provisioned = all((target / f).exists() for f in files)
            status = "✓" if provisioned else "✗"
            required = " [REQUIRED]" if m["required"] else ""
            print(f"  {status} {m['display_name']}{required}")
            if not provisioned:
                missing = [f for f in files if not (target / f).exists()]
                print(f"    Missing: {missing}")
        return

    models = manifest["models"]
    if args.model:
        models = [m for m in models if m["id"] == args.model]
        if not models:
            print(f"Unknown model: {args.model}")
            print(f"Available: {[m['id'] for m in manifest['models']]}")
            sys.exit(1)

    print(f"PRAGMA Model Provisioning")
    print(f"Models directory: {models_dir}")
    if args.dry_run:
        print(f"[DRY RUN]")

    results = []
    for model_def in models:
        ok = provision_model(model_def, models_dir, dry_run=args.dry_run)
        results.append((model_def["id"], ok))

    print(f"\n{'='*60}")
    print(f"Results:")
    all_ok = True
    for model_id, ok in results:
        status = "✓" if ok else "✗"
        print(f"  {status} {model_id}")
        if not ok:
            all_ok = False

    if not all_ok:
        required_failed = [
            mid for mid, ok in results
            if not ok and any(m["required"] for m in manifest["models"] if m["id"] == mid)
        ]
        if required_failed:
            print(f"\n✗ REQUIRED models failed: {required_failed}")
            sys.exit(1)
        else:
            print(f"\n⚠ Optional models failed (sidecar will run in degraded mode)")

if __name__ == "__main__":
    main()
