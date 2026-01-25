# Python Environment Documentation (Living Doc)

**Last Updated**: 2025-12-16  
**Status**: Active  
**Context**: NixOS + uv + Python 3.13

---

## 🔧 Operational Context

### Environment Stack

```
NixOS 26.05
  ├─ Python 3.13.9 (from Nix store)
  ├─ uv 0.9.15 (package manager)
  └─ Nix devShells (tmnl-python module)
```

### Key Paths

| Component  | Path                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| Python     | `/nix/store/3lll9y925zz9393sa59h653xik66srjb-python3-3.13.9/bin/python3` |
| uv         | `/nix/store/qpjjd520lh2pjif58wmlrjd4a5mmm55w-uv-0.9.15/bin/uv`           |
| venv       | `experiments/iot-data-science/.venv/`                                    |
| Nix module | `nix/modules/python.nix`                                                 |

---

## 📦 Package Management with uv

### Why uv?

- **Fast**: Written in Rust, 10-100x faster than pip
- **Deterministic**: Lock files ensure reproducibility
- **Nix-friendly**: Works well in Nix environments
- **Modern**: Better dependency resolution than pip

### Virtual Environment

```bash
# Created with
cd experiments/iot-data-science
uv venv --python 3.13

# Activate
source .venv/bin/activate

# Deactivate
deactivate
```

### Installed Packages (Core)

```toml
# From pyproject.toml
dependencies = [
    "pandas>=2.0.0",
    "numpy>=1.24.0",
    "matplotlib>=3.7.0",
    "seaborn>=0.12.0",
    "scikit-learn>=1.3.0",
    "jupyter>=1.0.0",
    "ipykernel>=6.25.0",
    "plotly>=5.17.0",
    "dash>=2.14.0",
    "filterpy>=1.4.5",
]
```

### Current Package Versions (2025-12-16)

| Package      | Version | Purpose                   |
| ------------ | ------- | ------------------------- |
| numpy        | 2.3.5   | Numerical computing       |
| pandas       | 2.3.3   | Data analysis             |
| matplotlib   | 3.10.8  | Plotting                  |
| seaborn      | 0.13.2  | Statistical visualization |
| scikit-learn | 1.8.0   | Machine learning          |
| plotly       | 6.5.0   | Interactive plots         |
| dash         | 3.3.0   | Web dashboards            |
| filterpy     | 1.4.5   | Kalman filters            |
| jupyter      | 1.1.1   | Notebooks                 |
| jupyterlab   | 4.5.1   | IDE                       |

---

## 🐛 Known Issues & Solutions

### Issue 1: Missing System Libraries (libstdc++.so.6, libz.so.1)

**Symptom**:

```
ImportError: libstdc++.so.6: cannot open shared object file: No such file or directory
ImportError: libz.so.1: cannot open shared object file: No such file or directory
```

**Cause**: NumPy C-extensions need libstdc++ and zlib from system

**Solution**: Use `nix develop .#tmnl-python` shell (has `LD_LIBRARY_PATH` set)

```bash
# Don't run Python directly
python algorithms/kalman_filter.py  # ❌ FAILS

# Run in Nix shell
nix develop .#tmnl-python
python algorithms/kalman_filter.py  # ✅ WORKS
```

**Why**: `nix/modules/python.nix` sets:

```nix
LD_LIBRARY_PATH = "${pkgs.stdenv.cc.cc.lib}/lib:${pkgs.zlib}/lib";
nativeBuildInputs = [ ... zlib ];
```

This provides libstdc++ and zlib to the venv packages.

**Fixed**: 2025-12-16 - Added zlib to LD_LIBRARY_PATH and nativeBuildInputs

---

### Issue 2: Editable install fails with hatchling

**Symptom**:

```
ValueError: Unable to determine which files to ship inside the wheel
```

**Cause**: No Python package structure (no `iot_data_science/` dir)

**Solution**: Install dependencies directly, not as editable package

```bash
# Don't use
uv pip install -e .  # ❌ FAILS

# Use
uv pip install pandas numpy matplotlib ...  # ✅ WORKS
```

**Alternative**: If you need editable mode, create proper package:

```
experiments/iot-data-science/
├── iot_data_science/
│   ├── __init__.py
│   └── (modules)
└── pyproject.toml  # with [tool.hatch.build.targets.wheel]
```

---

## 🚀 Workflow

### Standard Development Cycle

```bash
# 1. Enter Nix shell (provides libstdc++ + tools)
cd packages/tmnl
nix develop .#tmnl-python

# 2. Activate venv
cd experiments/iot-data-science
source .venv/bin/activate

# 3. Work
python algorithms/kalman_filter.py
jupyter lab  # Or use mission-control: py-notebook

# 4. Deactivate when done
deactivate
exit  # Exit Nix shell
```

### Installing New Packages

```bash
# In Nix shell with venv activated
uv pip install <package>

# Update pyproject.toml manually
# (or use `uv add <package>` if using uv project mode)
```

### Upgrading Packages

```bash
# Upgrade all
uv pip install --upgrade pandas numpy matplotlib seaborn scikit-learn jupyter plotly dash filterpy

# Upgrade specific
uv pip install --upgrade numpy
```

---

## 📊 Mission Control Scripts

From `nix/modules/python.nix`:

| Script         | Command        | Purpose            |
| -------------- | -------------- | ------------------ |
| `py-lint`      | `ruff check .` | Lint Python code   |
| `py-typecheck` | `mypy .`       | Type checking      |
| `py-notebook`  | `jupyter lab`  | Launch Jupyter Lab |

**Usage** (from within `nix develop .#tmnl-python`):

```bash
py-lint
py-typecheck
py-notebook
```

---

## 🔄 Reproducibility

### Lock Files (Future)

Currently using `pyproject.toml` without locks. For reproducibility:

```bash
# Generate lock file
uv pip freeze > requirements.lock

# Install from lock
uv pip install -r requirements.lock
```

### Nix Flake Lock

The Nix flake (`flake.lock`) locks Python version and uv version.

```bash
# Update Nix dependencies
nix flake update

# Update only Python module
nix flake lock --update-input nixpkgs
```

---

## 🧪 Testing Setup

### Running Algorithm Tests

```bash
# In Nix shell + venv
cd experiments/iot-data-science

# Test Kalman filter
python algorithms/kalman_filter.py

# Test particle filter
python algorithms/particle_filter.py

# Expected output: Statistics and sensor fusion examples
```

### Jupyter Notebooks

```bash
# Start Jupyter Lab
cd experiments/iot-data-science
jupyter lab  # Opens browser at localhost:8888

# Or use notebook interface
jupyter notebook notebooks/01_exploratory_data_analysis.ipynb
```

### IPython Kernel

```bash
# Register kernel (if needed)
python -m ipykernel install --user --name iot-sensor --display-name "IoT Sensor (Python 3.13)"

# List kernels
jupyter kernelspec list

# Remove kernel
jupyter kernelspec uninstall iot-sensor
```

---

## 📚 Package Documentation

### Quick Reference

**NumPy**:

```python
import numpy as np
arr = np.array([1, 2, 3])
```

**Pandas**:

```python
import pandas as pd
df = pd.read_csv('data.csv')
```

**Matplotlib**:

```python
import matplotlib.pyplot as plt
plt.plot([1, 2, 3])
plt.show()
```

**FilterPy** (Kalman):

```python
from filterpy.kalman import KalmanFilter
kf = KalmanFilter(dim_x=2, dim_z=1)
```

---

## 🔮 Future Improvements

### Planned

- [ ] Add `uv.lock` for dependency locking
- [ ] Create proper Python package structure for editable installs
- [ ] Add pytest configuration
- [ ] Add pre-commit hooks
- [ ] Docker container for non-Nix users

### Considered

- Move to `poetry` instead of `uv` (if lock files become critical)
- Add `pyright` for better type checking than `mypy`
- Integrate with VS Code Python extension

---

## 📝 Change Log

### 2025-12-16

- Initial setup with uv + Python 3.13
- Created venv at `.venv/`
- Installed core data science stack (124 packages)
- Documented libstdc++ issue and Nix shell solution
- Created `pyproject.toml` for dependency tracking

---

## 🆘 Troubleshooting

### "Command not found: uv"

**Solution**: Enter Nix shell

```bash
nix develop .#tmnl-python
```

### "No module named 'numpy'"

**Solution**: Activate venv

```bash
source experiments/iot-data-science/.venv/bin/activate
```

### "ImportError: libstdc++.so.6"

**Solution**: Must be in Nix shell (see Issue 1 above)

### "Jupyter kernel dies immediately"

**Cause**: Kernel not using venv Python

**Solution**: Install ipykernel in venv, register kernel

```bash
source .venv/bin/activate
python -m ipykernel install --user --name iot-sensor
# Then select "IoT Sensor" kernel in Jupyter
```

---

## 🔗 References

- [uv Documentation](https://github.com/astral-sh/uv)
- [Nix Python Development](https://nixos.wiki/wiki/Python)
- [NixOS Manual: Python](https://nixos.org/manual/nixpkgs/stable/#python)

---

**Maintainer**: Prime + Val  
**Contact**: See parent repo README
