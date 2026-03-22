defmodule Maiden.SensorRuntime.Directives.EnqueueTransitionJob do
  @moduledoc """
  Runtime directive: enqueue deferred transition processing via JobQueue boundary.
  """

  @enforce_keys [:event]
  defstruct [:event, opts: []]

  @type t :: %__MODULE__{
          event: map(),
          opts: keyword()
        }
end
