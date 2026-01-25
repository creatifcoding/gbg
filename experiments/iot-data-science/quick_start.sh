#!/bin/bash
# Quick Start Script for Prefect Smoke Detection Pipeline
# This script demonstrates running both training and prediction flows

set -e  # Exit on error

echo "====================================================================="
echo "PREFECT SMOKE DETECTION PIPELINE - QUICK START"
echo "====================================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    echo "❌ Error: Must run from iot-data-science project root"
    echo "   cd /path/to/iot-data-science && ./quick_start.sh"
    exit 1
fi

# Check for data files
if [ ! -f "smoke_analysis/data/raw/train_dataset.csv" ]; then
    echo "❌ Error: Training data not found"
    echo "   Expected: smoke_analysis/data/raw/train_dataset.csv"
    exit 1
fi

if [ ! -f "smoke_analysis/data/raw/test_dataset.csv" ]; then
    echo "❌ Error: Test data not found"
    echo "   Expected: smoke_analysis/data/raw/test_dataset.csv"
    exit 1
fi

echo "✓ Data files found"
echo ""

# Create results directory
mkdir -p results

echo "---------------------------------------------------------------------"
echo "STEP 1: Running Training Flow"
echo "---------------------------------------------------------------------"
echo "This will:"
echo "  - Load 5,000 training samples"
echo "  - Train JAX/Equinox MLP for 50 epochs"
echo "  - Save model to results/model_run_001.eqx"
echo ""

uv run python flows/train_flow.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Training complete!"
    echo ""
else
    echo ""
    echo "❌ Training failed"
    exit 1
fi

echo "---------------------------------------------------------------------"
echo "STEP 2: Running Prediction Flow"
echo "---------------------------------------------------------------------"
echo "This will:"
echo "  - Load 12,437 test samples"
echo "  - Generate predictions using trained model"
echo "  - Save predictions to results/test_predictions_run_001.csv"
echo ""

uv run python flows/predict_flow.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Predictions complete!"
    echo ""
else
    echo "❌ Prediction failed"
    exit 1
fi

echo "====================================================================="
echo "✓ PIPELINE COMPLETE"
echo "====================================================================="
echo ""
echo "Generated Files:"
echo "  - results/model_run_001.eqx (trained model weights)"
echo "  - results/test_predictions_run_001.csv (12,437 predictions)"
echo ""
echo "Next Steps:"
echo "  1. View results in Prefect UI: prefect server start"
echo "     Then navigate to: http://127.0.0.1:4200"
echo ""
echo "  2. Analyze predictions:"
echo "     uv run python src/analyze_model.py"
echo ""
echo "  3. Customize flows - see PREFECT_SETUP.md for details"
echo ""
echo "====================================================================="
