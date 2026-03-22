defmodule Maiden.LineRuntime.FSM do
  @moduledoc """
  Explicit line transition legality layer.

  Mirrors `src/lib/maidens/domains/contracts/line/ts/line.contract.ts`.
  """

  alias Maiden.LineRuntime.Validators.LineValidator

  @transitions %{
    "idle" => ["running", "changeover", "maintenance", "decommissioned"],
    "running" => ["idle", "changeover", "starved", "blocked", "maintenance"],
    "changeover" => ["idle", "running", "maintenance"],
    "starved" => ["running", "blocked", "idle", "maintenance"],
    "blocked" => ["running", "starved", "idle", "maintenance"],
    "maintenance" => ["idle", "running", "decommissioned"],
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

  @spec validate_transition_for_runtime(map(), keyword()) :: :ok | {:error, term()}
  def validate_transition_for_runtime(payload, opts \\ []) when is_map(payload) do
    from = payload["from"] || payload[:from]
    to = payload["to"] || payload[:to]

    with :ok <- LineValidator.transition_event_validate(payload, opts),
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
end
