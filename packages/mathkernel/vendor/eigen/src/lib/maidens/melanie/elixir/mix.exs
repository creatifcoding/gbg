defmodule Maiden.Melanie.MixProject do
  use Mix.Project

  def project do
    [
      app: :maiden_melanie,
      version: "0.1.0",
      elixir: "~> 1.17",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      elixirc_paths: elixirc_paths(Mix.env()),
      aliases: aliases()
    ]
  end

  def application do
    [
      extra_applications: [:logger]
    ]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      # Shared Maiden infrastructure (auth, OAuth provider)
      {:maiden_infra, path: "../../core/elixir"},
      # Core agent framework (stable 2.0.0)
      {:jido, "~> 2.0"},
      # AI integration — ReAct, CoT, tool calling, LLM directives
      # Note: 2.0.0-rc.0 is the latest, paired with jido 2.0
      {:jido_ai, "2.0.0-rc.0"},
      # JSON codec
      {:jason, "~> 1.4"},

      # ── Eval harness (dev/test only) ──────────────────────────────────────
      # DataFrame analysis with native NDJSON support (Polars/Rust NIF)
      {:explorer, "~> 0.10", only: [:dev, :test]},
      # GenStage-based parallel execution with backpressure
      {:flow, "~> 1.2", only: [:dev, :test]},
      # Vega-Lite chart generation (heatmaps, precision surfaces)
      {:vega_lite, "~> 0.1", only: [:dev, :test]},
      # CSV export (compile-time parser, zero runtime deps)
      {:nimble_csv, "~> 1.2", only: [:dev, :test]}
    ]
  end

  defp aliases do
    [
      test: "test --trace"
    ]
  end
end
