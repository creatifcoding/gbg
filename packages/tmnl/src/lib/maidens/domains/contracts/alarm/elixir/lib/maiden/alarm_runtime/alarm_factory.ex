defmodule Maiden.AlarmRuntime.AlarmFactory do
  @moduledoc """
  Shared alarm payload constructors for runtime tests and adapters.
  """

  alias Maiden.AlarmRuntime.AlarmId

  @spec new_alarm(map() | keyword()) :: map()
  def new_alarm(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "ALM")

    alarm_id =
      Map.get(attrs, :alarm_id) ||
        AlarmId.make(slug, Map.get(attrs, :uuid))

    %{
      alarm_id: alarm_id,
      device_id: Map.get(attrs, :device_id, "DEV-UNKNOWN"),
      asset_id: Map.get(attrs, :asset_id, nil),
      severity: Map.get(attrs, :severity, "warning"),
      state: Map.get(attrs, :state, "unacknowledged"),
      message: Map.get(attrs, :message, nil),
      triggered_at: Map.get(attrs, :triggered_at, DateTime.utc_now() |> DateTime.to_iso8601()),
      acknowledged_at: Map.get(attrs, :acknowledged_at, nil),
      acknowledged_by: Map.get(attrs, :acknowledged_by, nil),
      cleared_at: Map.get(attrs, :cleared_at, nil),
      shelved_until: Map.get(attrs, :shelved_until, nil),
      suppression_reason: Map.get(attrs, :suppression_reason, nil)
    }
  end

  @spec new_transition_event(map() | keyword()) :: map()
  def new_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "ALM")

    %{
      alarm_id: Map.get(attrs, :alarm_id) || AlarmId.make(slug, Map.get(attrs, :uuid)),
      from: Map.fetch!(attrs, :from),
      to: Map.fetch!(attrs, :to),
      at: Map.fetch!(attrs, :at),
      reason: Map.get(attrs, :reason, nil),
      by: Map.get(attrs, :by, nil),
      shelved_until: Map.get(attrs, :shelved_until, nil)
    }
  end

  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)
  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
end
