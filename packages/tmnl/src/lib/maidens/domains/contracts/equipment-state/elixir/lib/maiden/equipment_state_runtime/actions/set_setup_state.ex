defmodule Maiden.EquipmentStateRuntime.Actions.SetSetupState do
  @moduledoc """
  Explicit transition action: <supported> -> setup.
  """

  use Jido.Action,
    name: "set_setup_state",
    description: "Set equipment state to setup",
    schema: [
      equipment_state_id: [type: :string, required: true],
      machine_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      at: [type: :string, required: true],
      reason: [type: :string],
      operator_id: [type: :string],
      notes: [type: :string]
    ]

  @allowed_from ["running", "idle", "planned_downtime", "unplanned_downtime", "blocked"]

  @impl true
  def run(params, context) when is_map(params) do
    equipment_state_id = fetch_param(params, :equipment_state_id)
    from = fetch_param(params, :from)
    to = fetch_param(params, :to)

    cond do
      from not in @allowed_from or to != "setup" ->
        {:error, "SetSetupState requires to=setup and valid source state"}

      context.state[:equipment_state_id] != equipment_state_id ->
        {:error, "equipment_state_id mismatch between transition payload and agent state"}

      true ->
        {:ok,
         %{
           state: "setup",
           reason: fetch_param(params, :reason),
           started_at: fetch_param(params, :at),
           ended_at: nil,
           operator_id: fetch_param(params, :operator_id),
           notes: fetch_param(params, :notes)
         }}
    end
  end

  def run(_params, _context),
    do: {:error, "SetSetupState requires to=setup and valid source state"}

  defp fetch_param(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))
end
