defmodule Maiden.DeviceRuntime.Directives.PersistTransition do
  @moduledoc """
  Runtime directive: persist a validated transition via DeviceStore boundary.
  """

  @enforce_keys [:event, :metadata]
  defstruct [:event, :metadata]

  @type t :: %__MODULE__{
          event: map(),
          metadata: map()
        }
end
