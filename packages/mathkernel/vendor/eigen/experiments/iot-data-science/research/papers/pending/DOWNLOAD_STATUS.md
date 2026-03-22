# Paper Download Status

**Last Updated**: 2025-12-17 09:23 UTC
**Status**: 7 of 8 papers acquired

---

## ✅ Successfully Downloaded

### Time-Series Papers

1. **Informer: Beyond Efficient Transformer**

   - File: `time-series/2012.07436_Informer.pdf` (7.3 MB)
   - arXiv: 2012.07436
   - Authors: Haoyi Zhou et al.
   - Year: 2021
   - ✅ Downloaded

2. **N-BEATS: Neural Basis Expansion**

   - File: `time-series/1905.10437_NBEATS.pdf` (1.1 MB)
   - arXiv: 1905.10437
   - Authors: Boris N. Oreshkin et al. (Element AI)
   - Year: 2019
   - ✅ Downloaded

3. **PatchTST: A Time Series is Worth 64 Words**
   - File: `time-series/2211.14730_PatchTST.pdf` (3.9 MB)
   - arXiv: 2211.14730
   - Authors: Yuqi Nie et al. (IBM)
   - Year: 2023
   - ✅ Downloaded

### Sensor Fusion Papers

4. **Deep Learning for Inertial Positioning**

   - File: `sensor-fusion/2303.03757_DeepLearning_Inertial.pdf` (6.2 MB)
   - arXiv: 2303.03757
   - ✅ Downloaded

5. **Sensor Fusion Survey**
   - File: `sensor-fusion/2307.00014_SensorFusion_Survey.pdf` (2.7 MB)
   - arXiv: 2307.00014
   - ✅ Downloaded

### Existing Papers (Previously Downloaded)

6. **Basics of Sensor Fusion** (Aalto University)

   - File: `01_basics_of_sensor_fusion_aalto.pdf` (778 KB)
   - ✅ Already available

7. **Kalman Filter Tutorial** (UC Berkeley)

   - File: `02_kalman_filter_berkeley.pdf` (352 KB)
   - ✅ Already available

8. **Particle Filter Heart Rate** (Texas A&M)
   - File: `03_particle_filter_heart_rate.pdf` (1.1 MB)
   - ✅ Already available

---

## ⚠️ Manual Download Required

### 1. Temporal Fusion Transformer (TFT)

- **NOT on arXiv** - Published in International Journal of Forecasting
- **URL**: https://www.sciencedirect.com/science/article/pii/S0169207021000637
- **Status**: ⏳ Paywalled - manual download required
- **Authors**: Bryan Lim, Sercan Ö. Arık, et al. (Google Research)
- **Year**: 2019
- **Alternative**: Check Google Scholar for open-access preprint

---

## 📊 Summary Statistics

| Category      | Downloaded | Total | Status             |
| ------------- | ---------- | ----- | ------------------ |
| Time-Series   | 3          | 4     | 75% complete       |
| Sensor Fusion | 4          | 4     | 100% complete      |
| **Total**     | **7**      | **8** | **87.5% complete** |

**Total Size**: ~21.5 MB

---

## 📁 File Organization

```
papers/
├── time-series/
│   ├── 2012.07436_Informer.pdf (7.3 MB)
│   ├── 1905.10437_NBEATS.pdf (1.1 MB)
│   └── 2211.14730_PatchTST.pdf (3.9 MB)
├── sensor-fusion/
│   ├── 2303.03757_DeepLearning_Inertial.pdf (6.2 MB)
│   └── 2307.00014_SensorFusion_Survey.pdf (2.7 MB)
└── [root - legacy papers]
    ├── 01_basics_of_sensor_fusion_aalto.pdf (778 KB)
    ├── 02_kalman_filter_berkeley.pdf (352 KB)
    └── 03_particle_filter_heart_rate.pdf (1.1 MB)
```

---

## 🔄 Next Actions

1. [ ] Attempt to find TFT open-access version:

   - Check Google Scholar for preprints
   - Check author's personal website
   - Check institutional repositories

2. [ ] Consider alternatives to TFT:

   - N-BEATS already downloaded
   - Informer already downloaded
   - Both are strong baselines for time-series forecasting

3. [ ] Begin reading papers in priority order:
   - **High priority**: Informer, PatchTST (most relevant to current work)
   - **Medium priority**: N-BEATS, Sensor Fusion Survey
   - **Low priority**: Basics/tutorials (already familiar)

---

## 📖 Reading Order Recommendation

### Phase 1: Time-Series Foundations (Required for framework decision)

1. **Informer** (2012.07436) - Efficient transformer for time-series
2. **PatchTST** (2211.14730) - Current SOTA, channel-independent
3. **N-BEATS** (1905.10437) - Pure deep learning, no feature engineering

### Phase 2: Sensor Fusion Application

4. **Sensor Fusion Survey** (2307.00014) - Comprehensive overview
5. **Deep Learning Inertial** (2303.03757) - Real-world deployment

### Phase 3: Reference (As Needed)

6. Kalman/Particle filter papers - Implementation details

---

**Download Script**: `research/papers/pending/DOWNLOAD_SCRIPT.sh`
**Verified**: All downloaded PDFs are valid and complete
