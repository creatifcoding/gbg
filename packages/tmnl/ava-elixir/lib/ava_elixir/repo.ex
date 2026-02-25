defmodule AvaElixir.Repo do
  @moduledoc false

  use AshPostgres.Repo,
    otp_app: :ava_elixir
end
