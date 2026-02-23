defmodule MyApp.MixProject do
  use Mix.Project

  def project do
    [
      app: :my_app,
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
      # Elixir validator behavior (compile-time generated validators)
      {:exonerate, "~> 1.1", runtime: false},
      # Elixir validator behavior (runtime fallback validator)
      {:ex_json_schema, "~> 0.11.2"}
    ]
  end
end
