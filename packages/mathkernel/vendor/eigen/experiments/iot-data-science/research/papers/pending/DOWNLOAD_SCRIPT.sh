#!/usr/bin/env bash
# Paper Acquisition Script
# Created: 2025-12-17
# Run from: experiments/iot-data-science/

set -e  # Exit on error

# Navigate to papers directory
cd "$(dirname "$0")/../../papers" || exit 1

echo "📥 Downloading research papers..."
echo ""

# Create organized subdirectories
mkdir -p time-series sensor-fusion deep-learning

# ============================================================================
# TIME-SERIES PAPERS
# ============================================================================

echo "⏰ Time-Series Architecture Papers"
echo "-----------------------------------"

# Informer - arXiv 2012.07436 (VERIFIED)
echo "  [1/4] Informer: Beyond Efficient Transformer..."
wget -q -O time-series/2012.07436_Informer.pdf https://arxiv.org/pdf/2012.07436.pdf
echo "        ✓ Downloaded (arXiv 2012.07436)"

# N-BEATS - arXiv 1905.10437 (VERIFIED)
echo "  [2/4] N-BEATS: Neural Basis Expansion..."
wget -q -O time-series/1905.10437_NBEATS.pdf https://arxiv.org/pdf/1905.10437.pdf
echo "        ✓ Downloaded (arXiv 1905.10437)"

# TFT - Published in Intl Journal of Forecasting (NOT on arXiv)
echo "  [3/4] Temporal Fusion Transformer (TFT)..."
echo "        ⚠ NOT on arXiv - published in Intl J. Forecasting"
echo "        → URL: https://www.sciencedirect.com/science/article/pii/S0169207021000637"
echo "        → Manual download required (paywalled)"

# PatchTST - arXiv 2211.14730 (best guess based on timing)
echo "  [4/4] PatchTST: A Time Series is Worth 64 Words..."
# Try to download - might not exist at this ID
if wget -q -O time-series/2211.14730_PatchTST.pdf https://arxiv.org/pdf/2211.14730.pdf 2>/dev/null; then
    echo "        ✓ Downloaded (arXiv 2211.14730)"
else
    echo "        ⚠ arXiv ID uncertain - manual search required"
    echo "        → Search: 'A Time Series is Worth 64 Words PatchTST arXiv'"
fi

echo ""

# ============================================================================
# SENSOR FUSION PAPERS
# ============================================================================

echo "🔗 Sensor Fusion Papers"
echo "------------------------"

# Deep Learning for Inertial Positioning - arXiv 2303.03757
echo "  [1/4] Deep Learning for Inertial Positioning..."
wget -q -O sensor-fusion/2303.03757_DeepLearning_InertialPositioning.pdf https://arxiv.org/pdf/2303.03757.pdf
echo "        ✓ Downloaded (arXiv 2303.03757)"

# Sensor Fusion Survey - arXiv 2307.00014
echo "  [2/4] Sensor Fusion Survey..."
wget -q -O sensor-fusion/2307.00014_SensorFusion_Survey.pdf https://arxiv.org/pdf/2307.00014.pdf
echo "        ✓ Downloaded (arXiv 2307.00014)"

# Multi-sensor Fusion for Embodied AI - arXiv 2506.19769 (FUTURE ID - likely invalid)
echo "  [3/4] Multi-sensor Fusion for Embodied AI..."
if wget -q -O sensor-fusion/2506.19769_MultiSensor_EmbodiedAI.pdf https://arxiv.org/pdf/2506.19769.pdf 2>/dev/null; then
    echo "        ✓ Downloaded (arXiv 2506.19769)"
else
    echo "        ⚠ arXiv 2506.19769 does not exist (future ID)"
    echo "        → Verify or find correct paper"
    rm -f sensor-fusion/2506.19769_MultiSensor_EmbodiedAI.pdf 2>/dev/null || true
fi

# Radar + Vision Deep Fusion - arXiv 2406.00714 (FUTURE ID - likely invalid)
echo "  [4/4] Radar + Vision Deep Fusion..."
if wget -q -O sensor-fusion/2406.00714_RadarVision_Fusion.pdf https://arxiv.org/pdf/2406.00714.pdf 2>/dev/null; then
    echo "        ✓ Downloaded (arXiv 2406.00714)"
else
    echo "        ⚠ arXiv 2406.00714 does not exist (future ID)"
    echo "        → Verify or find correct paper"
    rm -f sensor-fusion/2406.00714_RadarVision_Fusion.pdf 2>/dev/null || true
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo "📊 Download Summary"
echo "-------------------"
downloaded=$(find . -name "*.pdf" -type f | wc -l)
echo "✓ Downloaded: $downloaded papers"
echo "⚠ Manual action required: 2-4 papers (see above)"
echo ""
echo "Next steps:"
echo "  1. Manually download TFT from ScienceDirect (paywalled)"
echo "  2. Verify/find correct arXiv IDs for uncertain papers"
echo "  3. Update PAPERS_TO_ACQUIRE.md with final status"
echo ""
echo "✅ Script complete!"
