defmodule Maiden.WorkcellRuntime.FSM do
  @moduledoc """
  Workcell lifecycle transition map aligned with canonical graph:
  `src/lib/iiot/machines/graphs/workcell-graph.ts` and
  `src/lib/maidens/domains/contracts/workcell/ts/workcell.contract.ts`.
  """

  alias Maiden.WorkcellRuntime.Validators.WorkcellValidator

  @transitions %{
    "idle" => ["setup", "maintenance", "decommissioned"],
    "setup" => ["running"],
    "running" => ["idle", "blocked", "faulted"],
    "blocked" => ["running"],
    "faulted" => ["idle", "maintenance"],
    "maintenance" => ["idle", "decommissioned"],
    "decommissioned" => []
  }

  @type state :: String.t()

  @spec states() :: [state()]
  def states, do: Map.keys(@transitions)

  @spec transitions() :: %{state() => [state()]}
  def transitions, do: @transitions

  @spec legal_transition?(state(), state()) :: boolean()
  def legal_transition?(from, to) when is_binary(from) and is_binary(to) do
    @transitions
    |> Map.get(from, [])
    |> Enum.member?(to)
  end

  def legal_transition?(_, _), do: false

  @spec validate_transition_for_runtime(map(), keyword()) :: :ok | {:error, map()}
  def validate_transition_for_runtime(payload, opts \\ []) when is_map(payload) do
    from = Map.get(payload, "from") || Map.get(payload, :from)
    to = Map.get(payload, "to") || Map.get(payload, :to)

    with :ok <- WorkcellValidator.transition_event_validate(payload, opts),
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
