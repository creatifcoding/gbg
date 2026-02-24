defmodule Maiden.OrderRuntime.Persistence.Repo do
  @moduledoc """
  Ecto repository for ORDER runtime persistence adapters.

  Started lazily by `Maiden.OrderRuntime.Persistence.PostgresStorage`.
  """

  use Ecto.Repo,
    otp_app: :maiden_order_runtime,
    adapter: Ecto.Adapters.Postgres
end
