defmodule AvaElixir.MixProject do
  use Mix.Project

  def project do
    [
      app: :ava_elixir,
      version: "0.1.0",
      elixir: "~> 1.18",
      start_permanent: Mix.env() == :prod,
      elixirc_paths: elixirc_paths(Mix.env()),
      preferred_cli_env: ["phoenix.test": :test, "sidecar.test": :test],
      aliases: aliases(),
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger, :runtime_tools],
      mod: {AvaElixir.Application, []}
    ]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      {:jason, "~> 1.4"},
      {:telemetry, "~> 1.2"},
      {:phoenix, "~> 1.7"},
      {:phoenix_live_view, "~> 1.1"},
      {:phoenix_html, "~> 4.1"},
      {:phoenix_pubsub, "~> 2.1"},
      {:plug_cowboy, "~> 2.7"},
      {:ash, "~> 3.0"},
      {:ash_postgres, "~> 2.0"},
      {:oban, "~> 2.19"},
      {:ecto_sql, "~> 3.12"},
      {:postgrex, ">= 0.0.0"},
      {:gnat, "~> 1.10"},
      {:lazy_html, ">= 0.1.0", only: :test},
      {:rustler, "~> 0.37", runtime: false},
      {:deps_nix, "~> 2.0", only: :dev, runtime: false}
    ]
  end

  defp aliases do
    [
      "deps.get": ["deps.get", "deps.nix"],
      "deps.update": ["deps.update", "deps.nix"],
      "lint.nif": ["cmd bash scripts/check_nif_schedule.sh"],
      "artifact.build": ["cmd bash scripts/precompile_artifact.sh"],
      "artifact.verify": ["cmd bash scripts/verify_artifact.sh"],
      "hex.repair": ["cmd bash scripts/repair_hex_env.sh"],
      "phoenix.test": ["test test/phoenix"],
      "sidecar.test": ["test test/sidecar_mode_test.exs"],
      "phoenix.dev": ["phx.server"]
    ]
  end
end
