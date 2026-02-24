defmodule Maiden.EquipmentStateRuntime.Boundaries.NoopEquipmentStateStore do
  @moduledoc """
  Default no-op EquipmentStateStore adapter.

  Replace via `config :maiden_equipment_state_runtime, :equipment_state_store_adapter, YourAdapter`.
  """

  @behaviour Maiden.EquipmentStateRuntime.Boundaries.EquipmentStateStore

  @impl true
  def persist_transition(_event, _metadata, _opts), do: :ok
end
