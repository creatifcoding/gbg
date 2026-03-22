defmodule Maiden.WorkcellRuntime.WorkcellFactory do
  @moduledoc """
  Shared WorkCell payload constructors for runtime tests and adapters.
  """

  alias Maiden.WorkcellRuntime.WorkcellId

  @spec new_workcell(map() | keyword()) :: map()
  def new_workcell(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "workcell")

    workcell_id = Map.get(attrs, :workcell_id) || WorkcellId.make(slug)

    %{
      workcell_id: workcell_id,
      line_id: Map.get(attrs, :line_id, "LIN-main-01"),
      name: Map.get(attrs, :name, "WorkCell #{slug}"),
      status: Map.get(attrs, :status, "idle"),
      cell_type: Map.get(attrs, :cell_type, nil),
      cycle_time_seconds: Map.get(attrs, :cycle_time_seconds, nil),
      position: Map.get(attrs, :position, nil),
      description: Map.get(attrs, :description, nil),
      location: Map.get(attrs, :location, nil),
      metadata: Map.get(attrs, :metadata, %{}),
      hierarchy_path:
        Map.get(attrs, :hierarchy_path, "/ENT-acme/SIT-main/PLT-01/LIN-main-01/#{workcell_id}"),
      enterprise_id: Map.get(attrs, :enterprise_id, nil),
      site_id: Map.get(attrs, :site_id, nil),
      area_id: Map.get(attrs, :area_id, nil),
      plant_id: Map.get(attrs, :plant_id, nil),
      created_at: Map.get(attrs, :created_at, DateTime.utc_now() |> DateTime.to_iso8601()),
      updated_at: Map.get(attrs, :updated_at, nil)
    }
  end

  @spec new_transition_event(map() | keyword()) :: map()
  def new_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "workcell")

    %{
      workcell_id: Map.get(attrs, :workcell_id) || WorkcellId.make(slug),
      from: Map.fetch!(attrs, :from),
      to: Map.fetch!(attrs, :to),
      at: Map.fetch!(attrs, :at),
      reason: Map.get(attrs, :reason, nil),
      initiated_by: Map.get(attrs, :initiated_by, nil)
    }
  end

  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)
  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
end
