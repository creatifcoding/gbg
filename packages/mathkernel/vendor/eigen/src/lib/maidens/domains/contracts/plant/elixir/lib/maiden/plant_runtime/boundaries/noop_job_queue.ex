defmodule Maiden.PlantRuntime.Boundaries.NoopJobQueue do
  @moduledoc """
  Default no-op JobQueue adapter.
  """

  @behaviour Maiden.PlantRuntime.Boundaries.JobQueue

  @impl true
  def enqueue_transition(_event, _opts), do: :ok
end
