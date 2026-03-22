defmodule Maiden.OrderRuntime do
  @moduledoc """
  Order-domain runtime contract namespace for Effect ↔ Elixir/Jido interop.

  Persistence lane:
  - `snapshot/2` stores agent checkpoints through `Jido.Persist.hibernate/2`.
  - `thaw/2` restores agent checkpoints through `Jido.Persist.thaw/3`.

  Default storage is ETS for deterministic local tests.
  """

  alias Maiden.OrderRuntime.Agent
  alias Maiden.OrderRuntime.Persistence.PostgresStorage

  @default_storage {Jido.Storage.ETS, [table: :maiden_order_runtime]}

  @type storage_config :: {module(), keyword()}

  @doc """
  Persist agent snapshot.

  Options:
  - `:storage` => `{adapter, opts}` override
  - `:table` => ETS table override when using default ETS storage
  """
  @spec snapshot(struct(), keyword()) :: :ok | {:error, term()}
  def snapshot(agent, opts \\ []) do
    Jido.Persist.hibernate(resolve_storage(opts), agent)
  end

  @doc """
  Restore an OrderRuntime agent by id from snapshot storage.

  Options:
  - `:storage` => `{adapter, opts}` override
  - `:table` => ETS table override when using default ETS storage
  """
  @spec thaw(String.t(), keyword()) :: {:ok, struct()} | {:error, term()}
  def thaw(agent_id, opts \\ []) when is_binary(agent_id) do
    Jido.Persist.thaw(resolve_storage(opts), Agent, agent_id)
  end

  @doc """
  Delete persisted snapshot for an agent id.
  """
  @spec delete_snapshot(String.t(), keyword()) :: :ok | {:error, term()}
  def delete_snapshot(agent_id, opts \\ []) when is_binary(agent_id) do
    {adapter, adapter_opts} = resolve_storage(opts)
    adapter.delete_checkpoint({Agent, agent_id}, adapter_opts)
  end

  @doc """
  Resolve storage tuple for persistence operations.
  """
  @spec storage(keyword()) :: storage_config()
  def storage(opts \\ []), do: resolve_storage(opts)

  defp resolve_storage(opts) do
    case Keyword.get(opts, :storage) do
      {adapter, adapter_opts} when is_atom(adapter) and is_list(adapter_opts) ->
        {adapter, adapter_opts}

      nil ->
        resolve_default_storage(opts)
    end
  end

  defp resolve_default_storage(opts) do
    case storage_adapter_from_opts(opts) do
      :postgres ->
        PostgresStorage.storage_from_config(Keyword.drop(opts, [:storage, :table, :adapter]))

      _ ->
        merge_default_storage(opts)
    end
  end

  defp storage_adapter_from_opts(opts) do
    case Keyword.get(opts, :adapter) do
      :postgres -> :postgres
      :ets -> :ets
      "postgres" -> :postgres
      "ets" -> :ets
      nil -> default_storage_adapter_from_env()
      other -> raise ArgumentError, "unsupported persistence adapter override: #{inspect(other)}"
    end
  end

  defp default_storage_adapter_from_env do
    case Application.get_env(:maiden_order_runtime, :persistence_adapter) do
      :postgres ->
        :postgres

      :ets ->
        :ets

      "postgres" ->
        :postgres

      "ets" ->
        :ets

      nil ->
        System.get_env("ORDER_PERSISTENCE_ADAPTER", "ets")
        |> String.downcase()
        |> case do
          "postgres" -> :postgres
          "ets" -> :ets
          other -> raise ArgumentError, "unsupported ORDER_PERSISTENCE_ADAPTER: #{inspect(other)}"
        end

      other ->
        raise ArgumentError,
              "invalid :maiden_order_runtime persistence_adapter config: #{inspect(other)}"
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
