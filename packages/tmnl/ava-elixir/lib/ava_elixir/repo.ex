defmodule AvaElixir.Repo do
  @moduledoc false

  use Ecto.Repo,
    otp_app: :ava_elixir,
    adapter: Ecto.Adapters.Postgres
end
