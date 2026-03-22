defmodule Maiden.OrderRuntime.Boundaries.NoopJobQueue do
  @moduledoc """
  Default no-op JobQueue adapter.

  Replace via `config :maiden_order_runtime, :job_queue_adapter, YourAdapter`.
  """

  @behaviour Maiden.OrderRuntime.Boundaries.JobQueue

  @impl true
  def enqueue_transition(_event, _opts), do: :ok
end
