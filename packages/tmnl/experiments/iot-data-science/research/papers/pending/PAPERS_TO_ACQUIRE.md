# Papers to Acquire

**Created**: 2025-12-17
**Status**: Pending Download

---

## Time-Series Architecture Papers

### 1. Temporal Fusion Transformer (TFT)

- **Authors**: Bryan Lim et al. (Google Research)
- **Year**: 2019
- **arXiv**: Need to search
- **Why**: SOTA interpretable time-series forecasting
- **Status**: ⏳ arXiv ID needed

### 2. Informer: Beyond Efficient Transformer

- **Authors**: Haoyi Zhou et al.
- **Year**: 2021
- **arXiv**: Need to find
- **Why**: Efficient long-sequence time-series
- **Status**: ⏳ arXiv ID needed

### 3. PatchTST

- **Authors**: IBM Research
- **Year**: 2023
- **arXiv**: Need to find
- **Why**: Current SOTA for time-series
- **Status**: ⏳ arXiv ID needed

### 4. N-BEATS

- **Authors**: Element AI
- **Year**: 2019
- **arXiv**: Need to find
- **Why**: Pure deep learning for forecasting
- **Status**: ⏳ arXiv ID needed

---

## Sensor Fusion Papers (Already Documented)

### 5. Deep Learning for Inertial Positioning

- **arXiv**: 2303.03757
- **URL**: https://arxiv.org/abs/2303.03757
- **Status**: ⏳ Ready to download

### 6. Multi-sensor Fusion for Embodied AI

- **arXiv**: 2506.19769
- **URL**: https://arxiv.org/abs/2506.19769
- **Note**: Future arXiv ID - may need verification
- **Status**: ⏳ Need to verify existence

### 7. Radar + Vision Deep Fusion

- **arXiv**: 2406.00714
- **URL**: https://arxiv.org/abs/2406.00714
- **Note**: Future arXiv ID - may need verification
- **Status**: ⏳ Need to verify existence

### 8. Sensor Fusion Survey

- **arXiv**: 2307.00014
- **URL**: https://arxiv.org/abs/2307.00014
- **Status**: ⏳ Ready to download

---

## Download Script (Once arXiv IDs Found)

```bash
# Navigate to papers directory
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/experiments/iot-data-science/papers/

# Create organized subdirectories
mkdir -p time-series deep-learning sensor-fusion

# Download sensor fusion papers (known arXiv IDs)
wget -O sensor-fusion/2303.03757_DeepLearning_InertialPositioning.pdf https://arxiv.org/pdf/2303.03757.pdf
wget -O sensor-fusion/2307.00014_SensorFusion_Survey.pdf https://arxiv.org/pdf/2307.00014.pdf

# Verify future arXiv IDs exist, then download:
wget -O sensor-fusion/2506.19769_MultiSensor_EmbodiedAI.pdf https://arxiv.org/pdf/2506.19769.pdf
wget -O sensor-fusion/2406.00714_RadarVision_Fusion.pdf https://arxiv.org/pdf/2406.00714.pdf

# Time-series papers (need arXiv IDs first)
# wget -O time-series/YYYY_TFT.pdf https://arxiv.org/pdf/XXXX.XXXXX.pdf
# wget -O time-series/YYYY_Informer.pdf https://arxiv.org/pdf/XXXX.XXXXX.pdf
# wget -O time-series/YYYY_PatchTST.pdf https://arxiv.org/pdf/XXXX.XXXXX.pdf
# wget -O time-series/YYYY_NBEATS.pdf https://arxiv.org/pdf/XXXX.XXXXX.pdf
```

---

## Next Steps

1. [ ] Search for time-series paper arXiv IDs
2. [ ] Verify future arXiv IDs exist (2506.19769, 2406.00714)
3. [ ] Run download script
4. [ ] Update this document with download status
5. [ ] Move to `papers/downloaded/` when complete
