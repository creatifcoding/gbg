defmodule Maiden.MachineAssetRuntime.FSM do
  @moduledoc """
  Explicit machine-asset transition legality layer.

  Mirrors `src/lib/maidens/domains/contracts/machine-asset/ts/machine-asset.contract.ts`.
  """

  alias Maiden.MachineAssetRuntime.Validators.MachineAssetValidator

  @transitions %{
    "commissioned" => ["operational"],
    "operational" => ["idle", "faulted", "scheduled_maintenance", "retired"],
    "idle" => ["operational", "faulted", "scheduled_maintenance", "retired"],
    "faulted" => ["scheduled_maintenance", "unscheduled_maintenance"],
    "scheduled_maintenance" => ["operational", "decommissioned"],
    "unscheduled_maintenance" => ["operational"],
    "retired" => ["decommissioned"],
    "decommissioned" => []
  }

  @spec transitions() :: map()
  def transitions, do: @transitions

  @spec legal_transition?(String.t(), String.t()) :: boolean()
  def legal_transition?(from, to) when is_binary(from) and is_binary(to) do
    @transitions
    |> Map.get(from, [])
    |> Enum.member?(to)
  end

  def legal_transition?(_, _), do: false

  @spec allowed?(String.t(), String.t()) :: boolean()
  def allowed?(from, to), do: legal_transition?(from, to)

  @spec validate_transition_for_jido(map(), keyword()) :: :ok | {:error, term()}
  def validate_transition_for_jido(payload, opts \\ []) when is_map(payload) do
    from = payload["from"] || payload[:from]
    to = payload["to"] || payload[:to]

    with :ok <- MachineAssetValidator.transition_event_validate(payload, opts),
         true <- legal_transition?(from, to) do
      :ok
    else
      false ->
        {:error,
         %{
           validator: :fsm,
           from: from,
           to: to,
           allowed_next: Map.get(@transitions, from, [])
         }}

      {:error, _} = error ->
        error
    end
  end

  @spec validate_transition_for_runtime(map(), keyword()) :: :ok | {:error, term()}
  def validate_transition_for_runtime(payload, opts \\ []) when is_map(payload) do
    validate_transition_for_jido(payload, opts)
  end
end
