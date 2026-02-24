defmodule MaidenSensorRuntime.MixProject do
  use Mix.Project

  def project do
    [
      app: :maiden_sensor_runtime,
      version: "0.1.0",
      elixir: "~> 1.16",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger, :jido]
    ]
  end

  defp deps do
    [
      {:jido, "~> 2.0"}
    ]
  end
end
