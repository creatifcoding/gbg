defmodule Maiden.SensorRuntime.Boundaries do
  @moduledoc """
  Boundary façade for strategy-emitted transition directives.
  """

  alias Maiden.SensorRuntime.Boundaries.{NoopJobQueue, NoopSensorStore}

  @app :maiden_sensor_runtime

  @spec persist_transition(map(), map(), keyword()) :: :ok | {:error, term()}
  def persist_transition(event, metadata, opts \\ []) when is_map(event) and is_map(metadata) do
    adapter = sensor_store_adapter()
    adapter.persist_transition(event, metadata, opts)
  end

  @spec enqueue_transition(map(), keyword()) :: :ok | {:error, term()}
  def enqueue_transition(event, opts \\ []) when is_map(event) do
    adapter = job_queue_adapter()
    adapter.enqueue_transition(event, opts)
  end

  @spec sensor_store_adapter() :: module()
  def sensor_store_adapter do
    Application.get_env(@app, :sensor_store_adapter, NoopSensorStore)
  end

  @spec job_queue_adapter() :: module()
  def job_queue_adapter do
    Application.get_env(@app, :job_queue_adapter, NoopJobQueue)
  end
end
