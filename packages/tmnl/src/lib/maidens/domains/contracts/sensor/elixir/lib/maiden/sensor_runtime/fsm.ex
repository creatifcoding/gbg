defmodule Maiden.SensorRuntime.FSM do
  @moduledoc """
  Explicit sensor transition legality layer.

  Mirrors `src/lib/maidens/domains/contracts/sensor/ts/sensor.contract.ts`.
  """

  alias Maiden.SensorRuntime.Validators.SensorValidator

  @transitions %{
    "active" => ["calibrating", "needs_calibration", "faulted", "offline"],
    "calibrating" => ["active", "faulted"],
    "needs_calibration" => ["calibrating"],
    "faulted" => ["active", "offline", "decommissioned"],
    "offline" => ["active", "decommissioned"],
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

  @spec validate_transition_for_runtime(map(), keyword()) :: :ok | {:error, map()}
  def validate_transition_for_runtime(payload, opts \\ []) when is_map(payload) do
    from = payload["from"] || payload[:from]
    to = payload["to"] || payload[:to]

    with :ok <- SensorValidator.transition_event_validate(payload, opts),
         true <- legal_transition?(from, to) do
      :ok
    else
      false ->
        {:error,
         %{
           validator: :fsm,
           message: "Illegal sensor transition",
           from: from,
           to: to,
           allowed_next: Map.get(@transitions, from, [])
         }}

      {:error, _} = error ->
        error
    end
  end

  @spec validate_transition_for_jido(map(), keyword()) :: :ok | {:error, map()}
  def validate_transition_for_jido(payload, opts \\ []) do
    validate_transition_for_runtime(payload, opts)
  end
end
