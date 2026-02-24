defmodule Maiden.MachineAssetRuntime.MachineAssetFactory do
  @moduledoc """
  Shared machine-asset payload constructors for runtime tests and adapters.

  ISA-95 alignment: machine asset is modeled as an equipment module under work-cell/line.
  """

  alias Maiden.MachineAssetRuntime.MachineAssetId

  @spec new_machine_asset(map() | keyword()) :: map()
  def new_machine_asset(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "machine")
    machine_id = Map.get(attrs, :machine_id) || MachineAssetId.make(slug)

    %{
      machine_id: machine_id,
      name: Map.get(attrs, :name, "Machine #{slug}"),
      status: Map.get(attrs, :status, "commissioned"),
      description: Map.get(attrs, :description, nil),
      location: Map.get(attrs, :location, nil),
      metadata: Map.get(attrs, :metadata, %{}),
      created_at: Map.get(attrs, :created_at, DateTime.utc_now() |> DateTime.to_iso8601()),
      updated_at: Map.get(attrs, :updated_at, nil),
      hierarchy_path:
        Map.get(
          attrs,
          :hierarchy_path,
          "/ENT-demo/SIT-demo/PLT-demo/LIN-demo/WCL-demo/#{machine_id}"
        ),
      enterprise_id: Map.get(attrs, :enterprise_id, "ENT-demo"),
      site_id: Map.get(attrs, :site_id, "SIT-demo"),
      plant_id: Map.get(attrs, :plant_id, "PLT-demo"),
      line_id: Map.get(attrs, :line_id, "LIN-demo"),
      work_cell_id: Map.get(attrs, :work_cell_id, nil),
      machine_type: Map.get(attrs, :machine_type, "CNC"),
      manufacturer: Map.get(attrs, :manufacturer, nil),
      model_number: Map.get(attrs, :model_number, nil),
      serial_number: Map.get(attrs, :serial_number, nil),
      installation_date: Map.get(attrs, :installation_date, nil),
      last_maintenance_date: Map.get(attrs, :last_maintenance_date, nil),
      next_maintenance_date: Map.get(attrs, :next_maintenance_date, nil)
    }
  end

  @spec new_machine_asset_transition_event(map() | keyword()) :: map()
  def new_machine_asset_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "machine")

    %{
      machine_id: Map.get(attrs, :machine_id) || MachineAssetId.make(slug),
      from: Map.fetch!(attrs, :from),
      to: Map.fetch!(attrs, :to),
      at: Map.fetch!(attrs, :at),
      reason: Map.get(attrs, :reason, nil),
      initiated_by: Map.get(attrs, :initiated_by, nil),
      notes: Map.get(attrs, :notes, nil)
    }
  end

  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)
  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
end
