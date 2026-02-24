defmodule Maiden.LineRuntime.LineFactory do
  @moduledoc """
  Shared line payload constructors for runtime tests and adapters.

  ISA-95 alignment: line is modeled as a production/work center under plant.
  """

  alias Maiden.LineRuntime.LineId

  @spec new_line(map() | keyword()) :: map()
  def new_line(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "line")
    line_id = Map.get(attrs, :line_id) || LineId.make(slug)

    %{
      line_id: line_id,
      name: Map.get(attrs, :name, "Line #{slug}"),
      status: Map.get(attrs, :status, "idle"),
      description: Map.get(attrs, :description, nil),
      location: Map.get(attrs, :location, nil),
      metadata: Map.get(attrs, :metadata, %{}),
      hierarchy_path:
        Map.get(attrs, :hierarchy_path, "/ENT-acme/SIT-main/PLT-main/#{line_id}"),
      enterprise_id: Map.get(attrs, :enterprise_id, nil),
      site_id: Map.get(attrs, :site_id, nil),
      area_id: Map.get(attrs, :area_id, nil),
      plant_id: Map.get(attrs, :plant_id, "PLT-main"),
      capacity: Map.get(attrs, :capacity, nil),
      line_type: Map.get(attrs, :line_type, nil),
      operating_hours_per_day: Map.get(attrs, :operating_hours_per_day, nil),
      created_at: Map.get(attrs, :created_at, DateTime.utc_now() |> DateTime.to_iso8601()),
      updated_at: Map.get(attrs, :updated_at, nil)
    }
  end

  @spec new_transition_event(map() | keyword()) :: map()
  def new_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "line")

    %{
      line_id: Map.get(attrs, :line_id) || LineId.make(slug),
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
