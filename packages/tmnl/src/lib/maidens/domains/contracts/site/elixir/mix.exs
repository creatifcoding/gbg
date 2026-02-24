defmodule MaidenSiteRuntime.MixProject do
  use Mix.Project

  def project do
    [
      app: :maiden_site_runtime,
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
      {:jido, "~> 2.0"}
    ]
  end
end
