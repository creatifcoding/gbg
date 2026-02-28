defmodule Maiden.Infra.Providers.OAuthAnthropic do
  @moduledoc """
  OAuth-aware Anthropic provider for ReqLLM.

  ## Problem

  ReqLLM's built-in Anthropic provider hardcodes `x-api-key` authentication
  in both the Req pipeline (`attach/3`) and the Finch streaming path
  (`attach_stream/4`). Pi's AuthStorage uses OAuth access tokens
  (`sk-ant-oat...`) which require:

  - `Authorization: Bearer <token>` header (not `x-api-key`)
  - `anthropic-beta: oauth-2025-04-20` header

  ## Solution

  This module implements `ReqLLM.Provider` by delegating every callback
  to the original `ReqLLM.Providers.Anthropic`, then post-processing
  authentication headers when the token is an OAuth token.

  Header transformation occurs on both paths:
  - **Req pipeline** (`attach/3`): `Req.Request` struct headers are a `%{name => [values]}` map
  - **Finch streaming** (`attach_stream/4`): `Finch.Request` struct headers are a `[{name, value}]` list

  ## Registration

      # Replaces :anthropic in ReqLLM's provider registry
      Maiden.Infra.Providers.OAuthAnthropic.register!()

      # Restore original
      Maiden.Infra.Providers.OAuthAnthropic.unregister!()

  Typically called by `Maiden.Infra.Auth.configure!/0`, not directly.

  ## Token Detection

  A token is OAuth if it starts with `sk-ant-oat`. Direct API keys
  (`sk-ant-api`) pass through unmodified.
  """

  use ReqLLM.Provider,
    id: :anthropic,
    default_base_url: "https://api.anthropic.com",
    default_env_key: "ANTHROPIC_API_KEY"

  require Logger

  @upstream ReqLLM.Providers.Anthropic
  @oauth_prefix "sk-ant-oat"
  @oauth_beta "oauth-2025-04-20"

  # ─── Registration ────────────────────────────────────────────────────────

  @doc """
  Register this module as the `:anthropic` provider, replacing the built-in.
  """
  def register! do
    {:ok, :anthropic} = ReqLLM.Providers.register(__MODULE__)
    Logger.info("[Maiden.Infra.OAuthAnthropic] Registered as :anthropic provider")
    :ok
  end

  @doc """
  Unregister and restore the original upstream provider.
  """
  def unregister! do
    {:ok, :anthropic} = ReqLLM.Providers.register(@upstream)
    Logger.info("[Maiden.Infra.OAuthAnthropic] Restored upstream :anthropic provider")
    :ok
  end

  # ─── Required Callbacks (delegated + auth transform) ─────────────────────

  @impl ReqLLM.Provider
  def prepare_request(operation, model_spec, prompt, opts) do
    @upstream.prepare_request(operation, model_spec, prompt, opts)
  end

  @impl ReqLLM.Provider
  def attach(request, model, user_opts) do
    request
    |> @upstream.attach(model, user_opts)
    |> maybe_transform_req_auth()
  end

  @impl ReqLLM.Provider
  def encode_body(request) do
    @upstream.encode_body(request)
  end

  @impl ReqLLM.Provider
  def decode_response(request_response) do
    @upstream.decode_response(request_response)
  end

  # ─── Optional Callbacks (delegated + auth transform) ─────────────────────

  @impl ReqLLM.Provider
  def extract_usage(body, model) do
    @upstream.extract_usage(body, model)
  end

  @impl ReqLLM.Provider
  def attach_stream(model, context, opts, finch_name) do
    case @upstream.attach_stream(model, context, opts, finch_name) do
      {:ok, %Finch.Request{} = finch_request} ->
        {:ok, maybe_transform_finch_auth(finch_request)}

      other ->
        other
    end
  end

  @impl ReqLLM.Provider
  def decode_stream_event(event, model) do
    @upstream.decode_stream_event(event, model)
  end

  @impl ReqLLM.Provider
  def translate_options(operation, model, opts) do
    @upstream.translate_options(operation, model, opts)
  end

  # ─── Public Test Interface ───────────────────────────────────────────────

  @doc """
  Transform a `%Finch.Request{}` struct for OAuth authentication.
  Public for testing — in production this is called by `attach_stream/4`.
  """
  @spec transform_finch_request(Finch.Request.t()) :: Finch.Request.t()
  def transform_finch_request(%Finch.Request{} = request) do
    maybe_transform_finch_auth(request)
  end

  # ─── Auth Header Transformation ──────────────────────────────────────────

  # Req.Request path — headers are %{name => [values]}
  defp maybe_transform_req_auth(%Req.Request{} = request) do
    case find_api_key_from_req(request.headers) do
      {:ok, token} when is_binary(token) ->
        if oauth_token?(token) do
          request
          |> remove_req_header("x-api-key")
          |> Req.Request.put_header("authorization", "Bearer #{token}")
          |> ensure_oauth_beta_req()
        else
          request
        end

      _ ->
        request
    end
  end

  # Finch.Request path — headers are [{name, value}]
  defp maybe_transform_finch_auth(%Finch.Request{headers: headers} = request) do
    case find_api_key_from_list(headers) do
      {:ok, token} when is_binary(token) ->
        if oauth_token?(token) do
          new_headers =
            headers
            |> reject_header("x-api-key")
            |> prepend_header("authorization", "Bearer #{token}")
            |> ensure_oauth_beta_list()

          %{request | headers: new_headers}
        else
          request
        end

      _ ->
        request
    end
  end

  # ─── Header Utilities ────────────────────────────────────────────────────

  defp oauth_token?(token), do: String.starts_with?(token, @oauth_prefix)

  defp find_api_key_from_req(%{} = headers) do
    case Map.get(headers, "x-api-key") do
      [token | _] when is_binary(token) -> {:ok, token}
      _ -> :not_found
    end
  end

  defp find_api_key_from_list(headers) when is_list(headers) do
    case Enum.find_value(headers, fn
           {"x-api-key", v} -> v
           _ -> nil
         end) do
      nil -> :not_found
      token -> {:ok, token}
    end
  end

  defp remove_req_header(%Req.Request{headers: headers} = request, key) do
    %{request | headers: Map.delete(headers, key)}
  end

  defp ensure_oauth_beta_req(%Req.Request{} = request) do
    existing = Map.get(request.headers, "anthropic-beta", []) |> List.first()
    beta_value = merge_beta_value(existing, @oauth_beta)
    Req.Request.put_header(request, "anthropic-beta", beta_value)
  end

  defp reject_header(headers, key) when is_list(headers) do
    downcased = String.downcase(key)
    Enum.reject(headers, fn {k, _v} -> String.downcase(k) == downcased end)
  end

  defp prepend_header(headers, key, value) when is_list(headers) do
    [{key, value} | headers]
  end

  defp ensure_oauth_beta_list(headers) when is_list(headers) do
    {beta_headers, other_headers} =
      Enum.split_with(headers, fn {k, _} -> String.downcase(k) == "anthropic-beta" end)

    existing_value =
      case beta_headers do
        [{_, v} | _] -> v
        [] -> nil
      end

    beta_value = merge_beta_value(existing_value, @oauth_beta)
    other_headers ++ [{"anthropic-beta", beta_value}]
  end

  defp merge_beta_value(nil, beta), do: beta

  defp merge_beta_value(existing, beta) when is_binary(existing) do
    if String.contains?(existing, beta), do: existing, else: "#{existing},#{beta}"
  end
end
