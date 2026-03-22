defmodule Maiden.SiteRuntime.Validators.SiteValidator do
  @moduledoc """
  Elixir validator behavior for Site lane scaffold.

  This skeleton keeps validation deterministic while the full schema-engine bridge
  (ExJsonSchema / Exonerate) is wired in a follow-up lane.
  """

  alias Maiden.SiteRuntime.SiteId

  @site_statuses ~w(planned under_construction operational seasonal_shutdown closed decommissioned)
  @transition_actions ~w(BeginConstruction Commission SeasonalShutdown Reopen Close Decommission)

  @timestamp_pattern ~r/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
  @enterprise_id_pattern ~r/^ENT-[a-zA-Z0-9-]+$/

  @type engine :: :auto

  @spec engine_status() :: %{preferred: :skeleton, exonerate_compatible: false}
  def engine_status do
    %{preferred: :skeleton, exonerate_compatible: false}
  end

  @spec site_validate(map(), keyword()) :: :ok | {:error, map()}
  def site_validate(payload, _opts \\ []) when is_map(payload) do
    with :ok <- require_binary(payload, "site_id", &SiteId.valid?/1),
         :ok <- require_binary(payload, "name", &(String.trim(&1) != "")),
         :ok <- require_member(payload, "status", @site_statuses),
         :ok <- require_binary(payload, "enterprise_id", &Regex.match?(@enterprise_id_pattern, &1)),
         :ok <- require_binary(payload, "timezone", &(String.trim(&1) != "")),
         :ok <- require_binary(payload, "hierarchy_path", &(String.trim(&1) != "")),
         :ok <- require_binary(payload, "created_at", &Regex.match?(@timestamp_pattern, &1)),
         :ok <- optional_binary(payload, "updated_at", &Regex.match?(@timestamp_pattern, &1)),
         :ok <- optional_binary(payload, "address", &(String.trim(&1) != "")),
         :ok <- optional_binary(payload, "city", &(String.trim(&1) != "")),
         :ok <- optional_binary(payload, "state", &(String.trim(&1) != "")),
         :ok <- optional_binary(payload, "country", &(String.trim(&1) != "")),
         :ok <- optional_binary(payload, "postal_code", &(String.trim(&1) != "")),
         :ok <- optional_binary(payload, "description", &(String.trim(&1) != "")),
         :ok <- optional_map(payload, "location"),
         :ok <- optional_map(payload, "metadata") do
      :ok
    end
  end

  @spec transition_event_validate(map(), keyword()) :: :ok | {:error, map()}
  def transition_event_validate(payload, _opts \\ []) when is_map(payload) do
    with :ok <- require_binary(payload, "site_id", &SiteId.valid?/1),
         :ok <- require_member(payload, "from", @site_statuses),
         :ok <- require_member(payload, "to", @site_statuses),
         :ok <- optional_member(payload, "action", @transition_actions),
         :ok <- require_binary(payload, "at", &Regex.match?(@timestamp_pattern, &1)) do
      :ok
    end
  end

  @spec agent_state_validate(map(), keyword()) :: :ok | {:error, map()}
  def agent_state_validate(payload, opts \\ []) when is_map(payload) do
    site_validate(payload, opts)
  end

  defp require_binary(payload, key, predicate) do
    case Map.get(payload, key) do
      value when is_binary(value) ->
        if predicate.(value) do
          :ok
        else
          {:error, %{validator: :skeleton, field: key, reason: :invalid_or_missing}}
        end

      _ ->
        {:error, %{validator: :skeleton, field: key, reason: :invalid_or_missing}}
    end
  end

  defp require_member(payload, key, allowed) do
    case Map.get(payload, key) do
      value when is_binary(value) ->
        if value in allowed do
          :ok
        else
          {:error, %{validator: :skeleton, field: key, reason: :invalid_enum, allowed: allowed}}
        end

      _ ->
        {:error, %{validator: :skeleton, field: key, reason: :invalid_enum, allowed: allowed}}
    end
  end

  defp optional_member(payload, key, allowed) do
    case Map.get(payload, key) do
      nil ->
        :ok

      value when is_binary(value) ->
        if value in allowed do
          :ok
        else
          {:error, %{validator: :skeleton, field: key, reason: :invalid_enum, allowed: allowed}}
        end

      _ ->
        {:error, %{validator: :skeleton, field: key, reason: :invalid_enum, allowed: allowed}}
    end
  end

  defp optional_binary(payload, key, predicate) do
    case Map.get(payload, key) do
      nil ->
        :ok

      value when is_binary(value) ->
        if predicate.(value) do
          :ok
        else
          {:error, %{validator: :skeleton, field: key, reason: :invalid_string}}
        end

      _ ->
        {:error, %{validator: :skeleton, field: key, reason: :invalid_string}}
    end
  end

  defp optional_map(payload, key) do
    case Map.get(payload, key) do
      nil -> :ok
      value when is_map(value) -> :ok
      _ -> {:error, %{validator: :skeleton, field: key, reason: :invalid_map}}
    end
  end
end
