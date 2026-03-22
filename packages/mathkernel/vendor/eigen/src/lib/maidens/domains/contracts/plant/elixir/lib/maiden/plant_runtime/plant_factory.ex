defmodule Maiden.PlantRuntime.PlantFactory do
  @moduledoc """
  Shared plant payload constructors for runtime tests and adapters.

  ISA-95 alignment: plant is Site/Area operational scope and parent of line/work-center lanes.
  """

  alias Maiden.PlantRuntime.PlantId

  @spec new_plant(map() | keyword()) :: map()
  def new_plant(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "plant")
    plant_id = Map.get(attrs, :plant_id) || PlantId.make(slug)

    %{
      plant_id: plant_id,
      name: Map.get(attrs, :name, "Plant #{slug}"),
      status: Map.get(attrs, :status, "commissioning"),
      timezone: Map.get(attrs, :timezone, "UTC"),
      site_code: Map.get(attrs, :site_code, nil),
      description: Map.get(attrs, :description, nil),
      location: Map.get(attrs, :location, nil),
      metadata: Map.get(attrs, :metadata, %{}),
      hierarchy_path:
        Map.get(attrs, :hierarchy_path, "/ENT-acme/SIT-main/AREA-main/#{plant_id}"),
      enterprise_id: Map.get(attrs, :enterprise_id, "ENT-acme"),
      site_id: Map.get(attrs, :site_id, "SIT-main"),
      area_id: Map.get(attrs, :area_id, "AREA-main"),
      created_at: Map.get(attrs, :created_at, DateTime.utc_now() |> DateTime.to_iso8601()),
      updated_at: Map.get(attrs, :updated_at, nil)
    }
  end

  @spec new_transition_event(map() | keyword()) :: map()
  def new_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "plant")

    %{
      plant_id: Map.get(attrs, :plant_id) || PlantId.make(slug),
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
