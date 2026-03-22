# Dataset Download Instructions

## Automated Download (Kaggle CLI) - RECOMMENDED

### 1. Get Kaggle API Credentials

1. Go to https://www.kaggle.com/settings/account
2. Scroll to "API" section
3. Click "Create New Token"
4. This downloads `kaggle.json`

### 2. Install Credentials

```bash
mkdir -p ~/.kaggle
mv ~/Downloads/kaggle.json ~/.kaggle/
chmod 600 ~/.kaggle/kaggle.json
```

### 3. Download Dataset (Automated)

```bash
cd experiments/iot-data-science
source .venv/bin/activate
kaggle datasets download -d gauravduttakiit/sensorfusion-smoke-detection-classification -p datasets/
cd datasets
unzip sensorfusion-smoke-detection-classification.zip
rm sensorfusion-smoke-detection-classification.zip
```

**Expected result**: `datasets/smoke_detection_iot.csv` (62,630 rows, ~6MB)

---

## Manual Download (Browser)

1. Go to: https://www.kaggle.com/datasets/gauravduttakiit/sensorfusion-smoke-detection-classification
2. Click "Download" button (requires Kaggle login)
3. Move downloaded file to: `experiments/iot-data-science/datasets/smoke_detection_iot.csv`

---

## Verification

```bash
cd experiments/iot-data-science
ls -lh datasets/smoke_detection_iot.csv
# Should show ~6MB file

head -5 datasets/smoke_detection_iot.csv
# Should show header + 4 data rows with sensor readings
```

---

## After Download

Run the exploratory data analysis notebook:

```bash
nix develop .#tmnl-python
cd experiments/iot-data-science
source .venv/bin/activate
jupyter lab notebooks/01_exploratory_data_analysis.ipynb
```
