defmodule Maiden.EquipmentStateRuntime.FSM do
  @moduledoc """
  Explicit equipment-state transition legality layer.
  """

  alias Maiden.EquipmentStateRuntime.Validators.EquipmentStateValidator

  @transitions %{
    "running" => ["idle", "planned_downtime", "unplanned_downtime", "setup", "blocked"],
    "idle" => ["running", "planned_downtime", "unplanned_downtime", "setup", "blocked"],
    "planned_downtime" => ["idle", "running", "unplanned_downtime", "setup"],
    "unplanned_downtime" => ["idle", "running", "planned_downtime", "setup"],
    "setup" => ["running", "idle", "unplanned_downtime", "blocked"],
    "blocked" => ["running", "idle", "unplanned_downtime", "setup"]
  }

  @spec transitions() :: map()
  def transitions, do: @transitions

  @spec allowed?(String.t(), String.t()) :: boolean()
  def allowed?(from, to) when is_binary(from) and is_binary(to) do
    @transitions
    |> Map.get(from, [])
    |> Enum.member?(to)
  end

  def allowed?(_, _), do: false

  @spec validate_transition_for_jido(map(), keyword()) :: :ok | {:error, term()}
  def validate_transition_for_jido(payload, opts \\ []) when is_map(payload) do
    from = payload["from"] || payload[:from]
    to = payload["to"] || payload[:to]

    with :ok <- EquipmentStateValidator.transition_event_validate(payload, opts),
         true <- allowed?(from, to) do
      :ok
    else
      false ->
        {:error,
         %{
           validator: :fsm,
           message: "Illegal equipment-state transition",
           from: from,
           to: to,
           allowed_next: Map.get(@transitions, from, [])
         }}

      {:error, _} = error ->
        error
    end
  end
end
