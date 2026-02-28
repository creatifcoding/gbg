defmodule Maiden.Melanie.Runtime.AuthBridge do
  @moduledoc """
  Melanie-specific auth bridge — delegates to shared `Maiden.Infra.Auth`.

  Kept as a thin wrapper for backward compatibility with existing test_helper.exs
  and any Melanie-specific auth extensions in the future.
  """

  defdelegate resolve_anthropic_key(), to: Maiden.Infra.Auth
  defdelegate oauth_token?(), to: Maiden.Infra.Auth
  defdelegate oauth_token?(key), to: Maiden.Infra.Auth
  defdelegate check_token_expiry(), to: Maiden.Infra.Auth
  defdelegate configure!(), to: Maiden.Infra.Auth
end
