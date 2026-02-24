defmodule Maiden.AreaRuntime.AreaId do
  @moduledoc """
  Area identifier constructor + validator (`ARA-{slug}`).
  """

  @pattern ~r/^ARA-[a-zA-Z0-9-]+$/

  @spec make(String.t()) :: String.t()
  def make(slug) when is_binary(slug) do
    normalized =
      slug
      |> String.trim()
      |> String.upcase()
      |> String.replace(~r/\s+/, "-")
      |> String.replace(~r/[^A-Z0-9-]/, "-")
      |> String.replace(~r/-+/, "-")
      |> String.trim("-")

    if String.starts_with?(normalized, "ARA-") do
      normalized
    else
      "ARA-" <> normalized
    end
  end

  @spec valid?(String.t()) :: boolean()
  def valid?(value) when is_binary(value), do: Regex.match?(@pattern, value)
  def valid?(_), do: false
end
