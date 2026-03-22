{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "iot-data-science-modern";

  buildInputs = with pkgs; [
    # Python 3.11 with curated data science packages
    (python311.withPackages (ps: with ps; [
      # Database & Storage
      duckdb
      pyarrow
      
      # Data Processing (Rust-based, fast)
      polars
      
      # ML Framework (JAX ecosystem)
      jax
      jaxlib
      # Note: equinox and optax might need to be installed via pip if not in nixpkgs
      
      # Workflow Orchestration
      # prefect  # May need pip install if not in nixpkgs stable
      
      # Utilities
      pydantic
      python-dotenv
      rich  # Pretty printing
      
      # Development
      ipython
      jupyter
      pytest
      ruff
      mypy
    ]))
    
    # CLI Tools
    duckdb  # DuckDB CLI for interactive queries
    
    # Build tools (for pip install if needed)
    uv
  ];

  shellHook = ''
    echo "🦆 Modern Data Science Environment"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Database:     DuckDB (embedded OLAP)"
    echo "Processing:   Polars (Rust-based)"
    echo "ML Framework: JAX (functional, XLA)"
    echo "Storage:      PyArrow + Parquet"
    echo ""
    echo "Python: $(python --version)"
    echo "DuckDB: $(duckdb --version)"
    echo ""
    echo "📦 Missing from nixpkgs? Install via uv:"
    echo "   uv pip install equinox optax prefect"
    echo ""
    echo "💡 Quick start:"
    echo "   duckdb smoke.db        # Interactive SQL"
    echo "   python -m pytest       # Run tests"
    echo "   jupyter lab            # Notebook interface"
    echo ""
  '';

  # Environment variables
  PYTHONPATH = "";  # Clear to avoid conflicts
  UV_SYSTEM_PYTHON = "1";  # Allow uv to use system Python
}
