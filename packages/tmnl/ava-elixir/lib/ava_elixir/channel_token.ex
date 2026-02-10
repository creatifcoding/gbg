defmodule AvaElixir.ChannelToken do
  @moduledoc """
  Short-lived token issuer/verifier for Phoenix channel authentication.
  """

  @salt "channel auth"

  @spec issue(String.t(), keyword()) :: {:ok, String.t()}
  def issue(user_id, opts \\ []) when is_binary(user_id) do
    signed_at = Keyword.get(opts, :signed_at, System.os_time(:second))

    token =
      Phoenix.Token.sign(
        AvaElixirWeb.Endpoint,
        @salt,
        %{user_id: user_id},
        signed_at: signed_at
      )

    {:ok, token}
  end

  @spec verify(String.t(), keyword()) :: {:ok, %{user_id: String.t()}} | {:error, term()}
  def verify(token, opts \\ [])

  def verify(token, opts) when is_binary(token) do
    max_age = Keyword.get(opts, :max_age, token_ttl_seconds())

    case Phoenix.Token.verify(AvaElixirWeb.Endpoint, @salt, token, max_age: max_age) do
      {:ok, %{"user_id" => user_id}} -> {:ok, %{user_id: user_id}}
      {:ok, %{user_id: user_id}} -> {:ok, %{user_id: user_id}}
      {:ok, _} -> {:error, :invalid_token_payload}
      {:error, reason} -> {:error, reason}
    end
  end

  def verify(_token, _opts), do: {:error, :invalid_token}

  @spec token_ttl_seconds() :: pos_integer()
  def token_ttl_seconds do
    Application.get_env(:ava_elixir, :channel_token_ttl_seconds, 300)
  end
end
