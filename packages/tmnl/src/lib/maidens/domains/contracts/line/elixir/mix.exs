defmodule MaidenLineRuntime.MixProject do
  use Mix.Project

  def project do
    [
      app: :maiden_line_runtime,
      version: "0.1.0",
      elixir: "~> 1.16",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger]
    ]
  end

  defp deps do
    [
      {:jason, "~> 1.4"},
      {:exonerate, "~> 1.1", runtime: false},
      {:ex_json_schema, "~> 0.11.2"},
      {:jido, "~> 2.0"}
    ]
  end
end
