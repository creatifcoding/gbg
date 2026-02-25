defmodule AvaElixir.Repo do
  @moduledoc false

  use AshPostgres.Repo,
    otp_app: :ava_elixir,
    warn_on_missing_ash_functions?: false

  @spec min_pg_version() :: Version.t()
  def min_pg_version, do: %Version{major: 13, minor: 0, patch: 0}
end
