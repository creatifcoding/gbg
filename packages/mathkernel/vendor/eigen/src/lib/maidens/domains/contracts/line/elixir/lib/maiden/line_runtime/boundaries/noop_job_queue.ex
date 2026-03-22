defmodule Maiden.LineRuntime.Boundaries.NoopJobQueue do
  @moduledoc """
  Default no-op JobQueue adapter.

  Replace via `config :maiden_line_runtime, :job_queue_adapter, YourAdapter`.
  """

  @behaviour Maiden.LineRuntime.Boundaries.JobQueue

  @impl true
  def enqueue_transition(_event, _opts), do: :ok
end
