defmodule Maiden.EnterpriseRuntime.FSM do
  @moduledoc """
  Explicit enterprise transition legality layer.
  """

  alias Maiden.EnterpriseRuntime.Validators.EnterpriseValidator

  @transitions %{
    "active" => ["restructuring", "merged", "dissolved"],
    "restructuring" => ["active", "dissolved"],
    "merged" => [],
    "dissolved" => []
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

    with :ok <- EnterpriseValidator.transition_event_validate(payload, opts),
         true <- allowed?(from, to) do
      :ok
    else
      false ->
        {:error,
         %{
           validator: :fsm,
           message: "Illegal enterprise transition",
           from: from,
           to: to,
           allowed_next: Map.get(@transitions, from, [])
         }}

      {:error, _} = error ->
        error
    end
  end
end
