defmodule Maiden.LineRuntime.LineId do
  @moduledoc """
  Canonical Line ID builder for Elixir runtime.

  Format: `LIN-{slug}`
  Example: `LIN-assembly-line-01`
  """

  @regex ~r/^LIN-[a-zA-Z0-9-]+$/

  @type t :: String.t()

  @spec make(String.t()) :: t()
  def make(slug) when is_binary(slug) do
    candidate = "LIN-" <> normalize_slug(slug)

    if valid?(candidate) do
      candidate
    else
      raise ArgumentError, "invalid line_id generated from slug: #{inspect(slug)}"
    end
  end

  @spec valid?(String.t()) :: boolean()
  def valid?(id) when is_binary(id), do: Regex.match?(@regex, id)
  def valid?(_), do: false

  @spec normalize_slug(String.t()) :: String.t()
  def normalize_slug(slug) when is_binary(slug) do
    slug
    |> String.trim()
    |> String.downcase()
    |> String.replace(~r/\s+/, "-")
    |> String.replace(~r/[^a-z0-9-]/, "-")
    |> String.replace(~r/-+/, "-")
    |> String.trim("-")
    |> ensure_non_empty_slug(slug)
  end

  defp ensure_non_empty_slug("", original_slug),
    do: raise(ArgumentError, "invalid slug for LineId: #{inspect(original_slug)}")

  defp ensure_non_empty_slug(value, _original_slug), do: value
end
