defmodule Maiden.SensorRuntime.SensorFactory do
  @moduledoc """
  Shared sensor payload constructors for runtime tests and adapters.

  ISA-95 alignment: sensor is a control-module lane under machine/equipment.
  """

  alias Maiden.SensorRuntime.SensorId

  @spec new_sensor(map() | keyword()) :: map()
  def new_sensor(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "sensor")
    sensor_id = Map.get(attrs, :sensor_id) || SensorId.make(slug)

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
          "/ENT-acme/SIT-main/PLT-main/LIN-main/WCL-main/MCH-demo/#{sensor_id}"
        ),
      enterprise_id: Map.get(attrs, :enterprise_id, "ENT-acme"),
      site_id: Map.get(attrs, :site_id, "SIT-main"),
      area_id: Map.get(attrs, :area_id, nil),
      plant_id: Map.get(attrs, :plant_id, "PLT-main"),
      line_id: Map.get(attrs, :line_id, "LIN-main"),
      work_cell_id: Map.get(attrs, :work_cell_id, "WCL-main"),
      machine_id: Map.get(attrs, :machine_id, "MCH-demo"),
      created_at: Map.get(attrs, :created_at, DateTime.utc_now() |> DateTime.to_iso8601()),
      updated_at: Map.get(attrs, :updated_at, nil)
    }
  end

  @spec new_transition_event(map() | keyword()) :: map()
  def new_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "sensor")

    %{
      sensor_id: Map.get(attrs, :sensor_id) || SensorId.make(slug),
      from: Map.fetch!(attrs, :from),
      to: Map.fetch!(attrs, :to),
      at: Map.fetch!(attrs, :at),
      action: Map.get(attrs, :action, nil),
      reason: Map.get(attrs, :reason, nil),
      initiated_by: Map.get(attrs, :initiated_by, nil)
    }
  end

  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)
  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
end
