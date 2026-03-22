defmodule Maiden.SiteRuntime.FSM do
  @moduledoc """
  Explicit site transition legality layer.
  """

  alias Maiden.SiteRuntime.Validators.SiteValidator

  @transitions %{
    "planned" => ["under_construction"],
    "under_construction" => ["operational"],
    "operational" => ["seasonal_shutdown", "closed"],
    "seasonal_shutdown" => ["operational"],
    "closed" => ["operational", "decommissioned"],
    "decommissioned" => []
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

  @spec validate_transition_for_jido(map(), keyword()) :: :ok | {:error, map()}
  def validate_transition_for_jido(payload, opts \\ []) when is_map(payload) do
    from = payload["from"] || payload[:from]
    to = payload["to"] || payload[:to]

    with :ok <- SiteValidator.transition_event_validate(payload, opts),
         true <- allowed?(from, to) do
      :ok
    else
      false ->
        {:error,
         %{
           validator: :fsm,
           message: "Illegal site transition",
           from: from,
           to: to,
           allowed_next: Map.get(@transitions, from, [])
         }}

      {:error, _} = error ->
        error
    end
  end
end
