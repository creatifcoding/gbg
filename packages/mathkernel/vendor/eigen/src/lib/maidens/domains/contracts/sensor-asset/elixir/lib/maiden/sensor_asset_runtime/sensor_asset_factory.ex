defmodule Maiden.SensorAssetRuntime.SensorAssetFactory do
  @moduledoc """
  Shared sensor-asset payload constructors for runtime tests and adapters.

  ISA-95 alignment: sensor assets model control modules (leaf instrumentation points).
  """

  alias Maiden.SensorAssetRuntime.SensorAssetId

  @spec new_sensor_asset(map() | keyword()) :: map()
  def new_sensor_asset(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "sensor")
    sensor_id = Map.get(attrs, :sensor_id) || SensorAssetId.make(slug)

    %{
      sensor_id: sensor_id,
      name: Map.get(attrs, :name, "Sensor #{slug}"),
      status: Map.get(attrs, :status, "active"),
      sensor_type: Map.get(attrs, :sensor_type, "other"),
      unit: Map.get(attrs, :unit, "unitless"),
      sample_rate_ms: Map.get(attrs, :sample_rate_ms, nil),
      threshold_high: Map.get(attrs, :threshold_high, nil),
      threshold_critical: Map.get(attrs, :threshold_critical, nil),
      threshold_low: Map.get(attrs, :threshold_low, nil),
      threshold_critical_low: Map.get(attrs, :threshold_critical_low, nil),
      last_calibration_date: Map.get(attrs, :last_calibration_date, nil),
      next_calibration_date: Map.get(attrs, :next_calibration_date, nil),
      opc_ua_node_id: Map.get(attrs, :opc_ua_node_id, nil),
      description: Map.get(attrs, :description, nil),
      location: Map.get(attrs, :location, nil),
      metadata: Map.get(attrs, :metadata, %{}),
      hierarchy_path:
        Map.get(
          attrs,
          :hierarchy_path,
          "/ENT-demo/SIT-demo/PLT-demo/LIN-demo/WCL-demo/MCH-demo/#{sensor_id}"
        ),
      enterprise_id: Map.get(attrs, :enterprise_id, "ENT-demo"),
      site_id: Map.get(attrs, :site_id, "SIT-demo"),
      area_id: Map.get(attrs, :area_id, nil),
      plant_id: Map.get(attrs, :plant_id, "PLT-demo"),
      line_id: Map.get(attrs, :line_id, "LIN-demo"),
      work_cell_id: Map.get(attrs, :work_cell_id, nil),
      machine_id: Map.get(attrs, :machine_id, "MCH-demo"),
      created_at: Map.get(attrs, :created_at, DateTime.utc_now() |> DateTime.to_iso8601()),
      updated_at: Map.get(attrs, :updated_at, nil)
    }
  end

  @spec new_sensor_asset_transition_event(map() | keyword()) :: map()
  def new_sensor_asset_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "sensor")

    %{
      sensor_id: Map.get(attrs, :sensor_id) || SensorAssetId.make(slug),
      from: Map.fetch!(attrs, :from),
      to: Map.fetch!(attrs, :to),
      action: Map.get(attrs, :action, nil),
      at: Map.fetch!(attrs, :at),
      reason: Map.get(attrs, :reason, nil),
      initiated_by: Map.get(attrs, :initiated_by, nil)
    }
  end

  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)
  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
end
