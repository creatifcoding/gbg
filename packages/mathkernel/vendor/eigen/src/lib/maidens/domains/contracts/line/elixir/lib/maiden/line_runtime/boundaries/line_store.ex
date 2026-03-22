defmodule Maiden.LineRuntime.Boundaries.LineStore do
  @moduledoc """
  Port contract for Line persistence boundary.

  Runtime strategies emit transition directives; this port is the handoff seam.
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
