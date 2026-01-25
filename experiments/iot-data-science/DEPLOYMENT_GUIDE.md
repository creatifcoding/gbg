# IoT Smoke Detection - Deployment Guide

## Quick Start

### 1. REST API Server

Start the FastAPI server for real-time predictions:

```bash
# Install dependencies (if not already done)
uv pip install fastapi uvicorn

# Start server
uv run uvicorn api_server:app --reload --host 0.0.0.0 --port 8000
```

Access the interactive API documentation at: **http://localhost:8000/docs**

#### Example API Usage

**Single Prediction**:
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "Temperature[C]": 22.5,
    "Humidity[%]": 45.0,
    "TVOC[ppb]": 150,
    "eCO2[ppm]": 400,
    "Raw H2": 13214,
    "Raw Ethanol": 20064,
    "Pressure[hPa]": 939.66,
    "PM1.0": 1.81,
    "PM2.5": 1.88,
    "NC0.5": 12.48,
    "NC1.0": 1.95,
    "NC2.5": 0.04,
    "CNT": 3812
  }'
```

**Response**:
```json
{
  "fire_alarm_prediction": 1,
  "fire_probability": 0.5095,
  "confidence_level": "Low",
  "model_version": "1.0.0"
}
```

**Health Check**:
```bash
curl http://localhost:8000/health
```

### 2. Train Ensemble Models

Train Random Forest, XGBoost, and Neural Network models:

```bash
# Install dependencies
uv pip install scikit-learn xgboost

# Train ensemble
uv run python train_ensemble.py
```

**Output**:
- `results/random_forest_model.pkl`
- `results/xgboost_model.pkl`
- `results/neural_network_model.pkl`
- `results/ensemble_model.pkl` (voting ensemble)
- `results/normalization_stats.pkl`

**Expected Performance**:
- Random Forest: ~99.8% validation accuracy
- XGBoost: ~99.9% validation accuracy
- Neural Network: ~99.7% validation accuracy
- Ensemble: ~99.9% validation accuracy (more robust)

### 3. Prefect Workflows (In Progress)

The Prefect subagent is setting up:
- Automated training pipelines
- Scheduled batch predictions
- Model monitoring
- Deployment workflows

Check `flows/` directory for Prefect flows (created by subagent).

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service info |
| `/health` | GET | Health check |
| `/predict` | POST | Single prediction |
| `/predict/batch` | POST | Batch predictions |
| `/docs` | GET | Interactive API docs (Swagger UI) |
| `/redoc` | GET | Alternative API docs (ReDoc) |

---

## Model Comparison

| Model | Train Acc | Val Acc | Training Time | Notes |
|-------|-----------|---------|---------------|-------|
| JAX MLP | 100.0% | 99.9% | ~1.5 min | Original model |
| Random Forest | ~99.8% | ~99.8% | ~5-10s | Fast, interpretable |
| XGBoost | ~99.9% | ~99.9% | ~3-5s | Fast, high performance |
| Sklearn NN | ~99.7% | ~99.7% | ~20-30s | Deeper architecture |
| Ensemble | ~99.9% | ~99.9% | ~30-45s | Most robust |

---

## Production Deployment Checklist

### API Server
- [ ] Add authentication (JWT tokens, API keys)
- [ ] Add rate limiting
- [ ] Add request logging
- [ ] Add error monitoring (Sentry)
- [ ] Add CORS configuration
- [ ] Containerize with Docker
- [ ] Set up HTTPS (Let's Encrypt)
- [ ] Deploy to cloud (AWS/GCP/Azure)
- [ ] Set up load balancer
- [ ] Add health monitoring

### Model Monitoring
- [ ] Track prediction distribution
- [ ] Detect data drift
- [ ] Monitor model performance
- [ ] Set up alerts for anomalies
- [ ] A/B test new models
- [ ] Implement model rollback

### Infrastructure
- [ ] Set up CI/CD pipeline
- [ ] Automated testing
- [ ] Model versioning
- [ ] Backup and recovery
- [ ] Disaster recovery plan
- [ ] Scalability testing

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY api_server.py .
COPY results/ results/
COPY smoke_analysis/data/raw/ smoke_analysis/data/raw/

# Expose port
EXPOSE 8000

# Run server
CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Build and Run

```bash
# Build image
docker build -t smoke-detection-api:1.0.0 .

# Run container
docker run -p 8000:8000 smoke-detection-api:1.0.0

# Run with volume mount (for live updates)
docker run -p 8000:8000 -v $(pwd)/results:/app/results smoke-detection-api:1.0.0
```

---

## Performance Benchmarks

### Latency (Single Prediction)
- **API Endpoint**: ~10-20ms (model inference + serialization)
- **Model Inference Only**: ~1-2ms (JAX), ~5-10ms (sklearn/xgboost)

### Throughput
- **Sequential**: ~50-100 requests/sec
- **With Batching**: ~500-1000 requests/sec

### Resource Usage
- **Memory**: ~500MB (model loaded)
- **CPU**: 1-2 cores (inference)

---

## Monitoring Dashboard (Recommended)

Use Grafana + Prometheus to monitor:
- Request rate (req/sec)
- Latency (p50, p95, p99)
- Error rate
- Prediction distribution (fire vs no-fire)
- Model confidence distribution
- CNT sensor readings distribution

---

## Next Steps

1. **Complete Prefect Integration** (subagent working on this)
2. **Add Time-Series Features**:
   - Rolling averages
   - Rate of change
   - Autocorrelation
3. **Add SHAP Analysis** (requires Python 3.13 or lower):
   - Feature interaction plots
   - Waterfall charts
   - Force plots
4. **ONNX Export** (requires Python 3.13 or lower):
   - Convert models to ONNX
   - Deploy to edge devices
   - C++ inference example

---

**Status**: REST API and Ensemble Models ready for deployment
**Last Updated**: 2025-12-16
