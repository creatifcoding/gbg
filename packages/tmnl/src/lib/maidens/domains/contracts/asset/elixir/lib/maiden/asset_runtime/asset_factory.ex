defmodule Maiden.AssetRuntime.AssetFactory do
  @moduledoc """
  Shared asset payload constructors for runtime tests and adapters.

  ISA-95 alignment:
  - enterprise → site → area → plant → line → workcell → machine
  - sensor/device attach beneath machine.
  """

  alias Maiden.AssetRuntime.AssetId

  @hierarchy_keys [
    :enterprise_id,
    :site_id,
    :area_id,
    :plant_id,
    :line_id,
    :work_cell_id,
    :machine_id
  ]

  @required_by_kind %{
    "enterprise" => [:enterprise_id],
    "site" => [:enterprise_id, :site_id],
    "area" => [:enterprise_id, :site_id, :area_id],
    "plant" => [:enterprise_id, :site_id, :area_id, :plant_id],
    "line" => [:enterprise_id, :site_id, :area_id, :plant_id, :line_id],
    "workcell" => [:enterprise_id, :site_id, :area_id, :plant_id, :line_id, :work_cell_id],
    "machine" => [
      :enterprise_id,
      :site_id,
      :area_id,
      :plant_id,
      :line_id,
      :work_cell_id,
      :machine_id
    ],
    "sensor" => [
      :enterprise_id,
      :site_id,
      :area_id,
      :plant_id,
      :line_id,
      :work_cell_id,
      :machine_id
    ],
    "device" => [
      :enterprise_id,
      :site_id,
      :area_id,
      :plant_id,
      :line_id,
      :work_cell_id,
      :machine_id
    ]
  }

  @self_key_by_kind %{
    "enterprise" => :enterprise_id,
    "site" => :site_id,
    "area" => :area_id,
    "plant" => :plant_id,
    "line" => :line_id,
    "workcell" => :work_cell_id,
    "machine" => :machine_id
  }

  @parent_key_by_kind %{
    "site" => :enterprise_id,
    "area" => :site_id,
    "plant" => :area_id,
    "line" => :plant_id,
    "workcell" => :line_id,
    "machine" => :work_cell_id,
    "sensor" => :machine_id,
    "device" => :machine_id
  }

  @spec new_asset(map() | keyword()) :: map()
  def new_asset(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    kind = Map.get(attrs, :kind, "machine")
    slug = Map.get(attrs, :slug, "asset")
    asset_id = Map.get(attrs, :asset_id) || AssetId.make(kind, slug)

    base =
      %{
        enterprise_id: Map.get(attrs, :enterprise_id, "ENT-demo"),
        site_id: Map.get(attrs, :site_id, "SIT-demo"),
        area_id: Map.get(attrs, :area_id, "ARA-demo"),
        plant_id: Map.get(attrs, :plant_id, "PLT-demo"),
        line_id: Map.get(attrs, :line_id, "LIN-demo"),
        work_cell_id: Map.get(attrs, :work_cell_id, "WCL-demo"),
        machine_id: Map.get(attrs, :machine_id, "MCH-demo")
      }
      |> maybe_put_self_id(kind, asset_id)
      |> nullify_descendants(kind)

    parent_id =
      case kind do
        "enterprise" -> nil
        _ -> Map.get(base, Map.get(@parent_key_by_kind, kind), Map.get(attrs, :parent_id))
      end

    hierarchy_path =
      Map.get(attrs, :hierarchy_path) ||
        default_hierarchy_path(kind, base, asset_id)

    %{
      asset_id: asset_id,
      name: Map.get(attrs, :name, "Asset #{slug}"),
      kind: kind,
      status: Map.get(attrs, :status, "active"),
      description: Map.get(attrs, :description, nil),
      location: Map.get(attrs, :location, nil),
      properties: Map.get(attrs, :properties, %{}),
      metadata: Map.get(attrs, :metadata, %{}),
      parent_id: Map.get(attrs, :parent_id, parent_id),
      hierarchy_path: hierarchy_path,
      enterprise_id: base.enterprise_id,
      site_id: base.site_id,
      area_id: base.area_id,
      plant_id: base.plant_id,
      line_id: base.line_id,
      work_cell_id: base.work_cell_id,
      machine_id: base.machine_id,
      created_at: Map.get(attrs, :created_at, DateTime.utc_now() |> DateTime.to_iso8601()),
      updated_at: Map.get(attrs, :updated_at, nil)
    }
  end

  @spec new_transition_event(map() | keyword()) :: map()
  def new_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    kind = Map.get(attrs, :kind, "machine")
    id_kind = Map.get(attrs, :id_kind, kind)
    slug = Map.get(attrs, :slug, "asset")

    %{
      asset_id: Map.get(attrs, :asset_id) || AssetId.make(id_kind, slug),
      kind: kind,
      from: Map.fetch!(attrs, :from),
      to: Map.fetch!(attrs, :to),
      action: Map.get(attrs, :action, nil),
      at: Map.fetch!(attrs, :at),
      reason: Map.get(attrs, :reason, nil),
      initiated_by: Map.get(attrs, :initiated_by, nil)
    }
  end

  defp maybe_put_self_id(base, kind, asset_id) do
    case Map.get(@self_key_by_kind, kind) do
      nil -> base
      self_key -> Map.put(base, self_key, asset_id)
    end
  end

  defp nullify_descendants(base, kind) do
    required = Map.get(@required_by_kind, kind, [])

    Enum.reduce(@hierarchy_keys, base, fn key, acc ->
      if key in required do
        acc
      else
        Map.put(acc, key, nil)
      end
    end)
  end

  defp default_hierarchy_path(kind, hierarchy, asset_id) do
    required = Map.get(@required_by_kind, kind, [])

    ids =
      required
      |> Enum.map(&Map.get(hierarchy, &1))
      |> Enum.filter(&is_binary/1)
      |> append_if_needed(asset_id)

    "/" <> Enum.join(ids, "/")
  end

  defp append_if_needed(ids, asset_id) do
    case List.last(ids) do
      ^asset_id -> ids
      _ -> ids ++ [asset_id]
    end
  end

  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)
  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
end
