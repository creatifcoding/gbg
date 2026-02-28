defmodule Maiden.Melanie.Runtime.Providers.OAuthAnthropic do
  @moduledoc """
  Melanie-specific alias — delegates to shared `Maiden.Infra.Providers.OAuthAnthropic`.

  Kept for backward compatibility with existing tests. New code should
  reference `Maiden.Infra.Providers.OAuthAnthropic` directly.
  """

  defdelegate register!(), to: Maiden.Infra.Providers.OAuthAnthropic
  defdelegate unregister!(), to: Maiden.Infra.Providers.OAuthAnthropic
  defdelegate transform_finch_request(request), to: Maiden.Infra.Providers.OAuthAnthropic
end
