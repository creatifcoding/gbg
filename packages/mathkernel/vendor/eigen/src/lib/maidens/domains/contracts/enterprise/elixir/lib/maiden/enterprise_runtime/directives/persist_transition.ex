defmodule Maiden.EnterpriseRuntime.Directives.PersistTransition do
  @moduledoc """
  Runtime directive: persist a validated transition via EnterpriseStore boundary.
  """

  @enforce_keys [:event, :metadata]
  defstruct [:event, :metadata]

  @type t :: %__MODULE__{
          event: map(),
          metadata: map()
        }
end
