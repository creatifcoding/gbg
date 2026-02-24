defmodule Maiden.AlarmRuntime.AlarmId do
  alias Maiden.AlarmRuntime.Support.UUIDv4
  @moduledoc """
  Canonical Alarm ID builder.

  Format: `<SLUG>-<UUIDv4>`
  Example: `ALM-HIGH-TEMP-550e8400-e29b-41d4-a716-446655440000`
  """

  @slug_regex ~r/^[A-Z][A-Z0-9_-]*$/

  @type t :: String.t()

  @spec make(String.t(), String.t() | nil) :: t()
  def make(slug, uuid \\ nil) when is_binary(slug) do
    normalized_slug = normalize_slug(slug)
    normalized_uuid = normalize_uuid(uuid || Uniq.UUID.uuid4())
    "#{normalized_slug}-#{normalized_uuid}"
  end

  @spec valid?(String.t()) :: boolean()
  def valid?(id) when is_binary(id) do
    case parse_id_parts(id) do
      {:ok, slug, uuid} -> Regex.match?(@slug_regex, slug) and uuid_v4?(uuid)
      :error -> false
    end
  end

  def valid?(_), do: false

  @spec normalize_slug(String.t()) :: String.t()
  def normalize_slug(slug) when is_binary(slug) do
    slug
    |> String.trim()
    |> String.upcase()
    |> String.replace(~r/\s+/, "-")
    |> String.replace(~r/[^A-Z0-9_-]/, "-")
    |> ensure_valid_slug()
  end

  @spec normalize_uuid(String.t()) :: String.t()
  def normalize_uuid(uuid) when is_binary(uuid) do
    normalized = uuid |> String.trim()

    case UUIDv4.cast(normalized) do
      {:ok, canonical} -> canonical
      :error -> raise ArgumentError, "invalid UUIDv4 for AlarmId: #{inspect(uuid)}"
    end
  end

  defp parse_id_parts(id) when is_binary(id) do
    length = byte_size(id)

    if length > 37 do
      slug_size = length - 37
      <<slug::binary-size(slug_size), "-", uuid::binary-size(36)>> = id
      {:ok, slug, uuid}
    else
      :error
    end
  end

  defp uuid_v4?(uuid), do: match?({:ok, _}, UUIDv4.cast(uuid))

  defp ensure_valid_slug(slug) do
    if Regex.match?(@slug_regex, slug) do
      slug
    else
      raise ArgumentError, "invalid slug for AlarmId: #{inspect(slug)}"
    end
  end
end
