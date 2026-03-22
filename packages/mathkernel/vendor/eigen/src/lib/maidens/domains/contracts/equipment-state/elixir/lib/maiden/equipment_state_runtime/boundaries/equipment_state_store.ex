defmodule Maiden.EquipmentStateRuntime.Boundaries.EquipmentStateStore do
  @moduledoc """
  Port contract for EquipmentState persistence boundary (Ash/Ecto side).

  Runtime strategies emit transition directives; this port is the handoff seam
  into Ash resources / Ecto transactions.
  """

  @callback persist_transition(event :: map(), metadata :: map(), opts :: keyword()) ::
              :ok | {:error, term()}
end
