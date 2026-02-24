defmodule Maiden.OrderRuntime.Boundaries.OrderStore do
  @moduledoc """
  Port contract for Order persistence boundary (Ash/Ecto side).

  Runtime strategies emit transition directives; this port is the handoff seam
  into Ash resources / Ecto transactions.
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
