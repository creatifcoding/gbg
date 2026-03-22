defmodule Maiden.AreaRuntime.AreaFactory do
  @moduledoc """
  Shared area payload constructors for runtime tests and adapters.

  ISA-95 alignment:
  - Area belongs under Site directly or under Plant depending lane model.
  """

  alias Maiden.AreaRuntime.AreaId

  @spec new_area(map() | keyword()) :: map()
  def new_area(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "area")
    area_id = Map.get(attrs, :area_id) || AreaId.make(slug)
    enterprise_id = Map.get(attrs, :enterprise_id, "ENT-demo")
    site_id = Map.get(attrs, :site_id, "SIT-demo")
    plant_id = Map.get(attrs, :plant_id, nil)

    %{
      area_id: area_id,
      name: Map.get(attrs, :name, "Area #{slug}"),
      status: Map.get(attrs, :status, "active"),
      enterprise_id: enterprise_id,
      site_id: site_id,
      area_type: Map.get(attrs, :area_type, nil),
      building: Map.get(attrs, :building, nil),
      floor: Map.get(attrs, :floor, nil),
      zone: Map.get(attrs, :zone, nil),
      description: Map.get(attrs, :description, nil),
      location: Map.get(attrs, :location, nil),
      metadata: Map.get(attrs, :metadata, %{}),
      hierarchy_path:
        Map.get(attrs, :hierarchy_path, default_hierarchy_path(enterprise_id, site_id, plant_id, area_id)),
      created_at: Map.get(attrs, :created_at, DateTime.utc_now() |> DateTime.to_iso8601()),
      updated_at: Map.get(attrs, :updated_at, nil)
    }
  end

  @spec new_transition_event(map() | keyword()) :: map()
  def new_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "area")

    %{
      area_id: Map.get(attrs, :area_id) || AreaId.make(slug),
      from: Map.fetch!(attrs, :from),
      to: Map.fetch!(attrs, :to),
      at: Map.fetch!(attrs, :at),
      reason: Map.get(attrs, :reason, nil),
      by: Map.get(attrs, :by, nil)
    }
  end

  defp default_hierarchy_path(enterprise_id, site_id, plant_id, area_id)
       when is_binary(plant_id) and plant_id != "" do
    "/#{enterprise_id}/#{site_id}/#{plant_id}/#{area_id}"
  end

  defp default_hierarchy_path(enterprise_id, site_id, _plant_id, area_id) do
    "/#{enterprise_id}/#{site_id}/#{area_id}"
  end

  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)
  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
end
