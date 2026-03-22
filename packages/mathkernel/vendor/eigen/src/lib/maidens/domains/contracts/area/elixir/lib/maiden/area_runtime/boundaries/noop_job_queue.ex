defmodule Maiden.AreaRuntime.Boundaries.NoopJobQueue do
  @moduledoc """
  Default no-op JobQueue adapter.
  """

  @behaviour Maiden.AreaRuntime.Boundaries.JobQueue

  @impl true
  def enqueue_transition(_event, _opts), do: :ok
end
