defmodule Maiden.OrderRuntime.Directives.PersistTransition do
  @moduledoc """
  Runtime directive: persist a validated transition via OrderStore boundary.
  """

  @enforce_keys [:event, :metadata]
  defstruct [:event, :metadata]

  @type t :: %__MODULE__{
          event: map(),
          metadata: map()
        }
end
