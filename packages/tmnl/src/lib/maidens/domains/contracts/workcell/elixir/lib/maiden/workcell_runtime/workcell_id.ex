defmodule Maiden.WorkcellRuntime.WorkcellId do
  @moduledoc """
  Workcell identifier helper matching canonical TS contract pattern.

  Pattern: `WCL-{slug}` where slug is alphanumeric with hyphens.
  """

  @pattern ~r/^WCL-[a-zA-Z0-9-]+$/

  @spec make(String.t()) :: String.t()
  def make(slug) when is_binary(slug) do
    "WCL-" <> normalize_slug(slug)
  end

  @spec valid?(String.t()) :: boolean()
  def valid?(value) when is_binary(value), do: Regex.match?(@pattern, value)
  def valid?(_), do: false

  @spec pattern() :: Regex.t()
  def pattern, do: @pattern

  defp normalize_slug(slug) do
    slug
    |> String.trim()
    |> String.downcase()
    |> String.replace(~r/\s+/, "-")
    |> String.replace(~r/[^a-z0-9-]/, "-")
    |> String.replace(~r/-+/, "-")
    |> String.trim("-")
  end
end
