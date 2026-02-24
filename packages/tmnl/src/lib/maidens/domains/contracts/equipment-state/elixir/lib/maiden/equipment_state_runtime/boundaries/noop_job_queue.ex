defmodule Maiden.EquipmentStateRuntime.Boundaries.NoopJobQueue do
  @moduledoc """
  Default no-op JobQueue adapter.

  Replace via `config :maiden_equipment_state_runtime, :job_queue_adapter, YourAdapter`.
  """

  @behaviour Maiden.EquipmentStateRuntime.Boundaries.JobQueue

  @impl true
  def enqueue_transition(_event, _opts), do: :ok
end
