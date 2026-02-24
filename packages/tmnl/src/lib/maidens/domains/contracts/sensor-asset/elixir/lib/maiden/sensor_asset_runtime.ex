defmodule Maiden.SensorAssetRuntime do
  @moduledoc """
  Sensor-asset runtime contract namespace for Effect ↔ Elixir/Jido interop.

  ISA-95 alignment:
  - Sensor assets model control modules at L0, orchestrated by L3 runtime policies.

  Persistence lane:
  - `snapshot/2` stores agent checkpoints through `Jido.Persist.hibernate/2`.
  - `thaw/2` restores agent checkpoints through `Jido.Persist.thaw/3`.

  Default storage is ETS for deterministic local tests.
  """

  alias Maiden.SensorAssetRuntime.Agent

  @default_storage {Jido.Storage.ETS, [table: :maiden_sensor_asset_runtime]}

  @type storage_config :: {module(), keyword()}

  @spec snapshot(struct(), keyword()) :: :ok | {:error, term()}
  def snapshot(agent, opts \\ []) do
    Jido.Persist.hibernate(resolve_storage(opts), agent)
  end

  @spec thaw(String.t(), keyword()) :: {:ok, struct()} | {:error, term()}
  def thaw(agent_id, opts \\ []) when is_binary(agent_id) do
    Jido.Persist.thaw(resolve_storage(opts), Agent, agent_id)
  end

  @spec delete_snapshot(String.t(), keyword()) :: :ok | {:error, term()}
  def delete_snapshot(agent_id, opts \\ []) when is_binary(agent_id) do
    {adapter, adapter_opts} = resolve_storage(opts)
    adapter.delete_checkpoint({Agent, agent_id}, adapter_opts)
  end

  @spec storage(keyword()) :: storage_config()
  def storage(opts \\ []), do: resolve_storage(opts)

  defp resolve_storage(opts) do
    case Keyword.get(opts, :storage) do
      {adapter, adapter_opts} when is_atom(adapter) and is_list(adapter_opts) ->
        {adapter, adapter_opts}

      nil ->
        merge_default_storage(opts)
    end
  end

  defp merge_default_storage(opts) do
    {adapter, adapter_opts} = @default_storage

    case Keyword.get(opts, :table) do
      nil -> {adapter, adapter_opts}
      table -> {adapter, Keyword.put(adapter_opts, :table, table)}
    end
  end
end
