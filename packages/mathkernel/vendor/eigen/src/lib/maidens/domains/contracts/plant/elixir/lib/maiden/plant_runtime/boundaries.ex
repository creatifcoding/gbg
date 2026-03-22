defmodule Maiden.PlantRuntime.Boundaries do
  @moduledoc """
  Boundary façade for strategy-emitted transition directives.
  """

  alias Maiden.PlantRuntime.Boundaries.{NoopJobQueue, NoopPlantStore}

  @app :maiden_plant_runtime

  @spec persist_transition(map(), map(), keyword()) :: :ok | {:error, term()}
  def persist_transition(event, metadata, opts \\ []) when is_map(event) and is_map(metadata) do
    adapter = plant_store_adapter()
    adapter.persist_transition(event, metadata, opts)
  end

  @spec enqueue_transition(map(), keyword()) :: :ok | {:error, term()}
  def enqueue_transition(event, opts \\ []) when is_map(event) do
    adapter = job_queue_adapter()
    adapter.enqueue_transition(event, opts)
  end

  @spec plant_store_adapter() :: module()
  def plant_store_adapter do
    Application.get_env(@app, :plant_store_adapter, NoopPlantStore)
  end

  @spec job_queue_adapter() :: module()
  def job_queue_adapter do
    Application.get_env(@app, :job_queue_adapter, NoopJobQueue)
  end
end
