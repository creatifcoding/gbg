defmodule Maiden.MachineAssetRuntime.Boundaries do
  @moduledoc """
  Boundary façade for strategy-emitted transition directives.
  """

  alias Maiden.MachineAssetRuntime.Boundaries.{NoopJobQueue, NoopMachineAssetStore}

  @app :maiden_machine_asset_runtime

  @spec persist_transition(map(), map(), keyword()) :: :ok | {:error, term()}
  def persist_transition(event, metadata, opts \\ []) when is_map(event) and is_map(metadata) do
    adapter = machine_asset_store_adapter()
    adapter.persist_transition(event, metadata, opts)
  end

  @spec enqueue_transition(map(), keyword()) :: :ok | {:error, term()}
  def enqueue_transition(event, opts \\ []) when is_map(event) do
    adapter = job_queue_adapter()
    adapter.enqueue_transition(event, opts)
  end

  @spec machine_asset_store_adapter() :: module()
  def machine_asset_store_adapter do
    Application.get_env(@app, :machine_asset_store_adapter, NoopMachineAssetStore)
  end

  @spec job_queue_adapter() :: module()
  def job_queue_adapter do
    Application.get_env(@app, :job_queue_adapter, NoopJobQueue)
  end
end
