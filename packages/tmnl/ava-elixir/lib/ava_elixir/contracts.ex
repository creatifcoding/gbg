defmodule AvaElixir.Contracts do
  @moduledoc """
  Typed boundary helpers for AVA <-> Elixir messaging.

  This module is the phase-1 contract anchor while we harden full schema
  validation against AVA domain payloads.
  """

  @required_view_spec_keys ~w(id name assemblage_id version channels)a

  @type subscription_ref :: reference() | String.t()
  @type view_spec :: map()

  @type validation_error ::
          {:missing_keys, [atom()]}
          | {:invalid_type, atom(), atom()}
          | {:invalid_value, atom(), atom()}

  @spec decode_view_spec_json(String.t()) :: {:ok, view_spec()} | {:error, term()}
  def decode_view_spec_json(json) when is_binary(json) do
    with {:ok, payload} <- Jason.decode(json),
         :ok <- validate_view_spec(payload) do
      {:ok, payload}
    end
  end

  @spec validate_view_spec(map()) :: :ok | {:error, validation_error()}
  def validate_view_spec(payload) when is_map(payload) do
    with :ok <- validate_required_keys(payload),
         :ok <- validate_non_empty_string(payload, :id),
         :ok <- validate_non_empty_string(payload, :name),
         :ok <- validate_non_empty_string(payload, :assemblage_id),
         :ok <- validate_positive_integer(payload, :version),
         :ok <- validate_list(payload, :channels) do
      :ok
    end
  end

  def validate_view_spec(_), do: {:error, {:invalid_type, :payload, :map}}

  @spec artifact_event(subscription_ref(), map()) :: {:ava_artifact, subscription_ref(), map()}
  def artifact_event(sub_ref, artifact) when is_map(artifact),
    do: {:ava_artifact, sub_ref, artifact}

  @spec error_event(subscription_ref(), String.t(), String.t()) ::
          {:ava_error, subscription_ref(), String.t(), String.t()}
  def error_event(sub_ref, code, reason)
      when is_binary(code) and is_binary(reason),
      do: {:ava_error, sub_ref, code, reason}

  @spec lag_event(subscription_ref(), non_neg_integer()) ::
          {:ava_lagged, subscription_ref(), non_neg_integer()}
  def lag_event(sub_ref, dropped_count) when is_integer(dropped_count) and dropped_count >= 0,
    do: {:ava_lagged, sub_ref, dropped_count}

  @spec validate_required_keys(map()) :: :ok | {:error, {:missing_keys, [atom()]}}
  defp validate_required_keys(payload) do
    missing =
      Enum.reject(@required_view_spec_keys, fn key ->
        Map.has_key?(payload, Atom.to_string(key)) or Map.has_key?(payload, key)
      end)

    case missing do
      [] -> :ok
      keys -> {:error, {:missing_keys, keys}}
    end
  end

  @spec validate_non_empty_string(map(), atom()) :: :ok | {:error, validation_error()}
  defp validate_non_empty_string(payload, key) do
    case field(payload, key) do
      value when is_binary(value) ->
        if String.trim(value) == "" do
          {:error, {:invalid_value, key, :empty_string}}
        else
          :ok
        end

      _ ->
        {:error, {:invalid_type, key, :string}}
    end
  end

  @spec validate_positive_integer(map(), atom()) :: :ok | {:error, validation_error()}
  defp validate_positive_integer(payload, key) do
    case field(payload, key) do
      value when is_integer(value) and value > 0 -> :ok
      value when is_integer(value) -> {:error, {:invalid_value, key, :must_be_positive}}
      _ -> {:error, {:invalid_type, key, :integer}}
    end
  end

  @spec validate_list(map(), atom()) :: :ok | {:error, validation_error()}
  defp validate_list(payload, key) do
    case field(payload, key) do
      value when is_list(value) -> :ok
      _ -> {:error, {:invalid_type, key, :list}}
    end
  end

  @spec field(map(), atom()) :: term()
  defp field(payload, key), do: payload[Atom.to_string(key)] || payload[key]
end
