defmodule AvaElixir.MixProject do
  use Mix.Project

  def project do
    [
      app: :ava_elixir,
      version: "0.1.0",
      elixir: "~> 1.18",
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps()
    ]
  end

  # Run "mix help compile.app" to learn about applications.
  def application do
    [
      extra_applications: [:logger],
      mod: {AvaElixir.Application, []}
    ]
  end

  # Run "mix help deps" to learn about dependencies.
  defp deps do
    [
      {:jason, "~> 1.4"},
      {:telemetry, "~> 1.2"},
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
      "artifact.verify": ["cmd bash scripts/verify_artifact.sh"]
    ]
  end
end
