defmodule Maiden.AlarmRuntime.FSM do
  @moduledoc """
  Explicit alarm transition legality layer.
  """

  alias Maiden.AlarmRuntime.Validators.AlarmValidator

  @transitions %{
    "unacknowledged" => ["acknowledged", "shelved", "suppressed", "out_of_service"],
    "acknowledged" => ["cleared", "shelved", "suppressed", "out_of_service"],
    "shelved" => ["unacknowledged", "acknowledged", "out_of_service"],
    "suppressed" => ["unacknowledged", "acknowledged", "out_of_service"],
    "cleared" => ["unacknowledged"],
    "out_of_service" => ["unacknowledged", "cleared"]
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

    with :ok <- AlarmValidator.transition_event_validate(payload, opts),
         true <- allowed?(from, to) do
      :ok
    else
      false ->
        {:error,
         %{
           validator: :fsm,
           message: "Illegal alarm transition",
           from: from,
           to: to,
           allowed_next: Map.get(@transitions, from, [])
         }}

      {:error, _} = error ->
        error
    end
  end
end
