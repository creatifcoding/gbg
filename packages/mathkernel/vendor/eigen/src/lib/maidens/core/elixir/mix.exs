defmodule Maiden.Infra.MixProject do
  use Mix.Project

  def project do
    [
      app: :maiden_infra,
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
      {:jason, "~> 1.4"},
      # ReqLLM for provider registration (OAuth wrapper)
      {:req_llm, "~> 1.0"},
      # Jido AI for model config
      {:jido_ai, "~> 2.0.0-rc.0"}
    ]
  end

  defp aliases do
    [
      test: "test --trace"
    ]
  end
end
