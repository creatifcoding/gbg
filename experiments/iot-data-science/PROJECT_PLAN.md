# IoT Smoke Detection - Extended Work Plan

## ALL FOUR NEXT STEPS

### 1. Deploy as REST API ✅ (Starting now)
**Goal**: Create FastAPI endpoint for real-time inference

**Tasks**:
- [x] Install FastAPI + uvicorn
- [ ] Create API server with /predict endpoint
- [ ] Add health check endpoint
- [ ] Model loading on startup
- [ ] Request validation
- [ ] Response formatting
- [ ] API documentation (auto-generated)
- [ ] Docker containerization

### 2. Export to ONNX for Embedded Systems ✅ (Starting now)
**Goal**: Convert JAX model to ONNX for edge deployment

**Tasks**:
- [x] Install onnx + onnxruntime
- [ ] Convert Equinox model to ONNX format
- [ ] Validate ONNX model (compare outputs)
- [ ] Optimize for inference (quantization)
- [ ] Test on different platforms
- [ ] Create C++ inference example
- [ ] Benchmark latency

### 3. Train Ensemble Models ✅ (Starting now)
**Goal**: Reduce CNT over-reliance with diverse models

**Tasks**:
- [x] Install scikit-learn, xgboost
- [ ] Train Random Forest (100 trees)
- [ ] Train XGBoost (gradient boosting)
- [ ] Train Neural Network with different architecture
- [ ] Create voting ensemble
- [ ] Feature importance comparison
- [ ] Performance comparison
- [ ] Save all models

### 4. Add Time-Series Features + SHAP ✅ (Starting now)
**Goal**: Better feature engineering and explainability

**Tasks**:
- [x] Install shap
- [ ] Create derivatives (rate of change)
- [ ] Add autocorrelation features
- [ ] Rolling statistics (mean, std, min, max)
- [ ] Train model with new features
- [ ] SHAP value analysis
- [ ] Waterfall plots
- [ ] Feature interaction analysis

---

## Execution Order

1. **Install all dependencies** (Step 0)
2. **ONNX Export** (fastest, standalone)
3. **REST API** (uses existing model)
4. **Ensemble Models** (requires training)
5. **Time-Series + SHAP** (most complex)

---

**Estimated Time**: 2-3 hours total
**Current Status**: Installing dependencies...
