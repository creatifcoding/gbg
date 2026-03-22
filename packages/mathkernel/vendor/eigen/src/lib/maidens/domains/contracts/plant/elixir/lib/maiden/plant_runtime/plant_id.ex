defmodule Maiden.PlantRuntime.PlantId do
  @moduledoc """
  Plant identifier constructor + validator (`PLT-{slug}`).
  """

  @pattern ~r/^PLT-[a-zA-Z0-9-]+$/

  @spec make(String.t()) :: String.t()
  def make(slug) when is_binary(slug) do
    normalized =
      slug
      |> String.trim()
      |> String.downcase()
      |> String.replace(~r/\s+/, "-")
      |> String.replace(~r/[^a-z0-9-]/, "-")
      |> String.replace(~r/-+/, "-")
      |> String.trim("-")

    "PLT-" <> normalized
  end

  @spec valid?(String.t()) :: boolean()
  def valid?(value) when is_binary(value), do: Regex.match?(@pattern, value)
  def valid?(_), do: false
end
