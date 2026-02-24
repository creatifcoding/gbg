defmodule Maiden.AlarmRuntime.Boundaries.AlarmStore do
  @moduledoc """
  Port contract for Alarm persistence boundary (Ash/Ecto side).

  Runtime strategies emit transition directives; this port is the handoff seam
  into Ash resources / Ecto transactions.
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
