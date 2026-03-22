defmodule Maiden.AlarmRuntime.Directives.PersistTransition do
  @moduledoc """
  Runtime directive: persist a validated transition via AlarmStore boundary.
  """

  @enforce_keys [:event, :metadata]
  defstruct [:event, :metadata]

  @type t :: %__MODULE__{
          event: map(),
          metadata: map()
        }
end
