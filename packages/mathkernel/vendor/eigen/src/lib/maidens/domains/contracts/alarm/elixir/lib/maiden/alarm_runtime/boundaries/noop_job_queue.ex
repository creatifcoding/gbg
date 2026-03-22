defmodule Maiden.AlarmRuntime.Boundaries.NoopJobQueue do
  @moduledoc """
  Default no-op JobQueue adapter.

  Replace via `config :maiden_alarm_runtime, :job_queue_adapter, YourAdapter`.
  """

  @behaviour Maiden.AlarmRuntime.Boundaries.JobQueue

  @impl true
  def enqueue_transition(_event, _opts), do: :ok
end
