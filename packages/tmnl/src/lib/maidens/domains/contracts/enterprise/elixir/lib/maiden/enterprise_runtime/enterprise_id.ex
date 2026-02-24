defmodule Maiden.EnterpriseRuntime.EnterpriseId do
  @moduledoc """
  Canonical Enterprise ID builder.

  Format: `ENT-<slug>` where slug is lowercase alphanumeric + hyphen.
  """

  @slug_regex ~r/^[a-z0-9-]+$/

  @type t :: String.t()

  @spec make(String.t()) :: t()
  def make(slug) when is_binary(slug) do
    "ENT-" <> normalize_slug(slug)
  end

  @spec valid?(String.t()) :: boolean()
  def valid?(id) when is_binary(id) do
    case String.split(id, "ENT-", parts: 2) do
      ["", slug] -> Regex.match?(@slug_regex, slug)
      _ -> false
    end
  end

  def valid?(_), do: false

  @spec normalize_slug(String.t()) :: String.t()
  def normalize_slug(slug) when is_binary(slug) do
    slug
    |> String.trim()
    |> String.downcase()
    |> String.replace(~r/\s+/, "-")
    |> String.replace(~r/[^a-z0-9-]/, "-")
    |> ensure_valid_slug()
  end

  defp ensure_valid_slug(slug) do
    if Regex.match?(@slug_regex, slug) and slug != "" do
      slug
    else
      raise ArgumentError, "invalid slug for EnterpriseId: #{inspect(slug)}"
    end
  end
end
