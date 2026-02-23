defmodule MyApp.OrderFSM do
  @moduledoc """
  Explicit Order transition legality layer.

  Provenance:
  - JSON Schema contract validates payload shape/types.
  - FSM adjacency legality is enforced here in Elixir code.
  - Mirrors Jido FSM strategy transition map semantics.
  """

  alias MyApp.Validators.OrderValidator

  @transitions %{
    "pending" => ["confirmed", "cancelled"],
    "confirmed" => ["shipped", "cancelled"],
    "shipped" => ["delivered"],
    "delivered" => [],
    "cancelled" => []
  }

  @spec transitions() :: map()
  def transitions, do: @transitions

  @spec allowed?(String.t(), String.t()) :: boolean()
  def allowed?(from, to) when is_binary(from) and is_binary(to) do
    from
    |> Map.get(@transitions, [])
    |> Enum.member?(to)
  end

  def allowed?(_, _), do: false

  @spec validate_transition_for_jido(map(), keyword()) :: :ok | {:error, term()}
  def validate_transition_for_jido(payload, opts \\ []) when is_map(payload) do
    with :ok <- OrderValidator.transition_event_validate(payload, opts),
         true <- allowed?(payload["from"], payload["to"]) do
      :ok
    else
      false ->
        {:error,
         %{
           validator: :fsm,
           message: "Illegal order transition",
           from: payload["from"],
           to: payload["to"],
           allowed_next: Map.get(@transitions, payload["from"], [])
         }}

      {:error, _} = error ->
        error
    end
  end
end
