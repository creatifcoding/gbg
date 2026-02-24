defmodule Maiden.AlarmRuntime.Boundaries do
  @moduledoc """
  Boundary façade for strategy-emitted transition directives.

  Decouples Jido strategy execution from Ash/Ecto persistence and Oban queueing.
  """

  alias Maiden.AlarmRuntime.Boundaries.{NoopJobQueue, NoopAlarmStore}

  @app :maiden_alarm_runtime

  @spec persist_transition(map(), map(), keyword()) :: :ok | {:error, term()}
  def persist_transition(event, metadata, opts \\ []) when is_map(event) and is_map(metadata) do
    adapter = alarm_store_adapter()
    adapter.persist_transition(event, metadata, opts)
  end

  @spec enqueue_transition(map(), keyword()) :: :ok | {:error, term()}
  def enqueue_transition(event, opts \\ []) when is_map(event) do
    adapter = job_queue_adapter()
    adapter.enqueue_transition(event, opts)
  end

  @spec alarm_store_adapter() :: module()
  def alarm_store_adapter do
    Application.get_env(@app, :alarm_store_adapter, NoopAlarmStore)
  end

  @spec job_queue_adapter() :: module()
  def job_queue_adapter do
    Application.get_env(@app, :job_queue_adapter, NoopJobQueue)
  end
end
