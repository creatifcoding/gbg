defmodule Maiden.EnterpriseRuntime.Boundaries.JobQueue do
  @moduledoc """
  Port contract for deferred transition job boundary (Oban side).
  """

  @callback enqueue_transition(event :: map(), opts :: keyword()) :: :ok | {:error, term()}
end
