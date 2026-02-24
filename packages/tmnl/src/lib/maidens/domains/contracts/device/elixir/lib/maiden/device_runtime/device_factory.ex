defmodule Maiden.DeviceRuntime.DeviceFactory do
  @moduledoc """
  Shared device payload constructors for runtime tests and adapters.

  ISA-95 alignment: device is modeled as control-module under machine/work-cell hierarchy.
  """

  alias Maiden.DeviceRuntime.DeviceId

  @spec new_device(map() | keyword()) :: map()
  def new_device(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "device")
    device_id = Map.get(attrs, :device_id) || DeviceId.make(slug)

    %{
      device_id: device_id,
      name: Map.get(attrs, :name, "Device #{slug}"),
      status: Map.get(attrs, :status, "provisioned"),
      device_type: Map.get(attrs, :device_type, "other"),
      control_mode: Map.get(attrs, :control_mode, nil),
      rated_power: Map.get(attrs, :rated_power, nil),
      power_unit: Map.get(attrs, :power_unit, nil),
      last_command_at: Map.get(attrs, :last_command_at, nil),
      opc_ua_node_id: Map.get(attrs, :opc_ua_node_id, nil),
      description: Map.get(attrs, :description, nil),
      location: Map.get(attrs, :location, nil),
      metadata: Map.get(attrs, :metadata, %{}),
      hierarchy_path:
        Map.get(attrs, :hierarchy_path, "/ENT-acme/SIT-main/PLT-main/LIN-main/WCL-main/MCH-main/#{device_id}"),
      enterprise_id: Map.get(attrs, :enterprise_id, nil),
      site_id: Map.get(attrs, :site_id, nil),
      area_id: Map.get(attrs, :area_id, nil),
      plant_id: Map.get(attrs, :plant_id, "PLT-main"),
      line_id: Map.get(attrs, :line_id, "LIN-main"),
      work_cell_id: Map.get(attrs, :work_cell_id, "WCL-main"),
      machine_id: Map.get(attrs, :machine_id, "MCH-main"),
      created_at: Map.get(attrs, :created_at, DateTime.utc_now() |> DateTime.to_iso8601()),
      updated_at: Map.get(attrs, :updated_at, nil)
    }
  end

  @spec new_transition_event(map() | keyword()) :: map()
  def new_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "device")

    %{
      device_id: Map.get(attrs, :device_id) || DeviceId.make(slug),
      from: Map.fetch!(attrs, :from),
      to: Map.fetch!(attrs, :to),
      action: Map.get(attrs, :action, nil),
      at: Map.fetch!(attrs, :at),
      reason: Map.get(attrs, :reason, nil),
      initiated_by: Map.get(attrs, :initiated_by, nil)
    }
  end

  def stringify_keys(map) when is_map(map) do
    Enum.reduce(map, %{}, fn {key, value}, acc ->
      string_key = if is_atom(key), do: Atom.to_string(key), else: key
      Map.put(acc, string_key, stringify_nested(value))
    end)
  end

  defp stringify_nested(map) when is_map(map), do: stringify_keys(map)
  defp stringify_nested(list) when is_list(list), do: Enum.map(list, &stringify_nested/1)
  defp stringify_nested(value), do: value

  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)
  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
end
