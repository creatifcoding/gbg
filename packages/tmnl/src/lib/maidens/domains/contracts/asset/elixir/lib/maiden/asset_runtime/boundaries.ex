defmodule Maiden.AssetRuntime.Boundaries do
  @moduledoc """
  Boundary façade for strategy-emitted transition directives.
  """

  alias Maiden.AssetRuntime.Boundaries.{NoopAssetStore, NoopJobQueue}

  @app :maiden_asset_runtime

  @spec persist_transition(map(), map(), keyword()) :: :ok | {:error, term()}
  def persist_transition(event, metadata, opts \\ []) when is_map(event) and is_map(metadata) do
    adapter = asset_store_adapter()
    adapter.persist_transition(event, metadata, opts)
  end

  @spec enqueue_transition(map(), keyword()) :: :ok | {:error, term()}
  def enqueue_transition(event, opts \\ []) when is_map(event) do
    adapter = job_queue_adapter()
    adapter.enqueue_transition(event, opts)
  end

  @spec asset_store_adapter() :: module()
  def asset_store_adapter do
    Application.get_env(@app, :asset_store_adapter, NoopAssetStore)
  end

  @spec job_queue_adapter() :: module()
  def job_queue_adapter do
    Application.get_env(@app, :job_queue_adapter, NoopJobQueue)
  end
end
