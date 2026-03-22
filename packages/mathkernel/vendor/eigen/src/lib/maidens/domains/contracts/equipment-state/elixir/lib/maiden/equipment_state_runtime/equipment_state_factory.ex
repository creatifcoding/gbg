defmodule Maiden.EquipmentStateRuntime.EquipmentStateFactory do
  @moduledoc """
  Shared equipment-state payload constructors for runtime tests and adapters.
  """

  alias Maiden.EquipmentStateRuntime.EquipmentStateId

  @spec new_equipment_state(map() | keyword()) :: map()
  def new_equipment_state(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "EST")

    equipment_state_id =
      Map.get(attrs, :equipment_state_id) ||
        EquipmentStateId.make(slug, Map.get(attrs, :uuid))

    %{
      equipment_state_id: equipment_state_id,
      machine_id: Map.get(attrs, :machine_id, "MCH-UNKNOWN"),
      state: Map.get(attrs, :state, "running"),
      reason: Map.get(attrs, :reason, nil),
      started_at: Map.get(attrs, :started_at, DateTime.utc_now() |> DateTime.to_iso8601()),
      ended_at: Map.get(attrs, :ended_at, nil),
      operator_id: Map.get(attrs, :operator_id, nil),
      notes: Map.get(attrs, :notes, nil),
      metadata: Map.get(attrs, :metadata, %{})
    }
  end

  @spec new_transition_event(map() | keyword()) :: map()
  def new_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "EST")

    %{
      equipment_state_id:
        Map.get(attrs, :equipment_state_id) ||
          EquipmentStateId.make(slug, Map.get(attrs, :uuid)),
      machine_id: Map.fetch!(attrs, :machine_id),
      from: Map.fetch!(attrs, :from),
      to: Map.fetch!(attrs, :to),
      at: Map.fetch!(attrs, :at),
      reason: Map.get(attrs, :reason, nil),
      operator_id: Map.get(attrs, :operator_id, nil),
      notes: Map.get(attrs, :notes, nil)
    }
  end

  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)
  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
end
