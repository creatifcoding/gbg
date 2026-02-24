defmodule Maiden.AlarmRuntime.Boundaries.JobQueue do
  @moduledoc """
  Port contract for deferred transition job boundary (Oban side).

  Keeps strategy orchestration decoupled from concrete Oban worker modules.
  """

  @callback enqueue_transition(event :: map(), opts :: keyword()) :: :ok | {:error, term()}
end
