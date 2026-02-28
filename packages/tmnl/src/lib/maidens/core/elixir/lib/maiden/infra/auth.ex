defmodule Maiden.Infra.Auth do
  @moduledoc """
  Resolves LLM credentials from Pi's AuthStorage and configures
  the ReqLLM provider pipeline for OAuth-native authentication.

  Pi stores credentials in `~/.pi/agent/auth.json`:

      {
        "anthropic": {
          "type": "oauth",
          "access": "sk-ant-oat01-...",
          "refresh": "...",
          "expires": 1772175993602
        },
        "openai-codex": {
          "type": "oauth",
          "access": "eyJhbG...",
          ...
        }
      }

  ## Startup

      # In any Maiden runtime's Application.start/2 or test_helper.exs:
      Maiden.Infra.Auth.configure!()

  This will:
  1. Resolve the Anthropic API key (env var → Pi AuthStorage fallback)
  2. Store it in ReqLLM's application config
  3. If the key is an OAuth token, register the OAuth-aware Anthropic provider
  """

  require Logger

  alias Maiden.Infra.Providers.OAuthAnthropic

  @auth_storage_path Path.expand("~/.pi/agent/auth.json")
  @oauth_prefix "sk-ant-oat"

  # ─── Public API ──────────────────────────────────────────────────────────

  @doc """
  Resolve the Anthropic API key from available sources.

  Precedence:
  1. `ANTHROPIC_API_KEY` environment variable (non-empty)
  2. Pi AuthStorage (`~/.pi/agent/auth.json` → `anthropic.access`)
  """
  @spec resolve_anthropic_key() :: {:ok, String.t()} | {:error, term()}
  def resolve_anthropic_key do
    case System.get_env("ANTHROPIC_API_KEY") do
      key when is_binary(key) and byte_size(key) > 0 ->
        {:ok, key}

      _ ->
        resolve_from_auth_storage("anthropic")
    end
  end

  @doc """
  Resolve any provider's credential from Pi AuthStorage.

  Reads `~/.pi/agent/auth.json` → `provider_name.access`.
  """
  @spec resolve_provider_key(String.t()) :: {:ok, String.t()} | {:error, term()}
  def resolve_provider_key(provider_name) when is_binary(provider_name) do
    resolve_from_auth_storage(provider_name)
  end

  @doc """
  Full configuration sequence:

  1. Resolves Anthropic credentials
  2. Stores them in ReqLLM's config
  3. Registers OAuth provider if needed
  4. Validates token expiry

  Returns `:ok` on success, `{:error, reason}` on failure.
  """
  @spec configure!() :: :ok | {:error, term()}
  def configure! do
    with {:ok, key} <- resolve_anthropic_key(),
         :ok <- validate_token(key),
         :ok <- store_key(key),
         :ok <- maybe_register_oauth_provider(key) do
      Logger.info("[Maiden.Infra.Auth] Anthropic credentials configured (#{credential_type(key)})")
      :ok
    end
  end

  @doc """
  Returns true if the given key (or resolved key) is an OAuth token.
  """
  @spec oauth_token?() :: boolean()
  def oauth_token? do
    case resolve_anthropic_key() do
      {:ok, key} -> oauth_token?(key)
      _ -> false
    end
  end

  @spec oauth_token?(String.t()) :: boolean()
  def oauth_token?(key) when is_binary(key), do: String.starts_with?(key, @oauth_prefix)

  @doc """
  Check token expiry from Pi AuthStorage metadata.
  Returns `{:ok, seconds_remaining}` or `{:error, reason}`.
  """
  @spec check_token_expiry() :: {:ok, integer()} | {:error, :expired | :no_expiry_info}
  def check_token_expiry do
    check_token_expiry("anthropic")
  end

  @spec check_token_expiry(String.t()) :: {:ok, integer()} | {:error, :expired | :no_expiry_info}
  def check_token_expiry(provider_name) do
    auth_path = System.get_env("PI_AUTH_STORAGE_PATH") || @auth_storage_path

    with {:ok, content} <- File.read(auth_path),
         {:ok, data} <- Jason.decode(content),
         %{"expires" => expires} when is_number(expires) <- Map.get(data, provider_name, %{}) do
      now_ms = System.system_time(:millisecond)
      remaining_ms = expires - now_ms

      if remaining_ms > 0 do
        {:ok, div(remaining_ms, 1000)}
      else
        {:error, :expired}
      end
    else
      _ -> {:error, :no_expiry_info}
    end
  end

  @doc """
  Read the full auth entry for a provider (type, access, expires).
  Useful for diagnostics.
  """
  @spec auth_entry(String.t()) :: {:ok, map()} | {:error, term()}
  def auth_entry(provider_name) do
    auth_path = System.get_env("PI_AUTH_STORAGE_PATH") || @auth_storage_path

    with {:ok, content} <- File.read(auth_path),
         {:ok, data} <- Jason.decode(content),
         %{} = entry when map_size(entry) > 0 <- Map.get(data, provider_name) do
      {:ok, entry}
    else
      {:error, :enoent} -> {:error, {:auth_storage_not_found, auth_path}}
      {:error, %Jason.DecodeError{} = err} -> {:error, {:parse_error, err}}
      _ -> {:error, {:no_entry, provider_name}}
    end
  end

  # ─── Private ─────────────────────────────────────────────────────────────

  defp resolve_from_auth_storage(provider_name) do
    auth_path = System.get_env("PI_AUTH_STORAGE_PATH") || @auth_storage_path

    with {:ok, content} <- File.read(auth_path),
         {:ok, data} <- Jason.decode(content),
         %{"access" => access} when is_binary(access) and byte_size(access) > 0 <-
           Map.get(data, provider_name, %{}) do
      {:ok, access}
    else
      {:error, :enoent} ->
        {:error, {:auth_storage_not_found, auth_path}}

      {:error, %Jason.DecodeError{} = err} ->
        {:error, {:auth_storage_parse_error, err}}

      _ ->
        {:error, {:no_credential, provider_name}}
    end
  end

  defp validate_token(key) do
    if oauth_token?(key) do
      case check_token_expiry() do
        {:ok, seconds} when seconds > 300 ->
          Logger.debug("[Maiden.Infra.Auth] OAuth token valid for #{div(seconds, 60)} minutes")
          :ok

        {:ok, seconds} ->
          Logger.warning(
            "[Maiden.Infra.Auth] OAuth token expires in #{seconds}s — consider refreshing"
          )

          :ok

        {:error, :expired} ->
          {:error, :oauth_token_expired}

        {:error, :no_expiry_info} ->
          :ok
      end
    else
      :ok
    end
  end

  defp store_key(key) do
    if Code.ensure_loaded?(ReqLLM) do
      ReqLLM.put_key(:anthropic_api_key, key)
    end

    Application.put_env(:jido_ai, :models, anthropic: [api_key: key])
    :ok
  end

  defp maybe_register_oauth_provider(key) do
    if oauth_token?(key) do
      OAuthAnthropic.register!()
    else
      :ok
    end
  end

  defp credential_type(key) do
    if oauth_token?(key), do: "OAuth token", else: "API key"
  end
end
