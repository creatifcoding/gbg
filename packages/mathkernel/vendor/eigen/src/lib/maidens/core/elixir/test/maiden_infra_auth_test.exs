defmodule Maiden.Infra.AuthTest do
  use ExUnit.Case, async: true

  alias Maiden.Infra.Auth
  alias Maiden.Infra.Providers.OAuthAnthropic

  # ─── Credential Resolution ──────────────────────────────────────────────

  describe "resolve_anthropic_key/0" do
    test "resolves from ANTHROPIC_API_KEY env var when set" do
      System.put_env("ANTHROPIC_API_KEY", "sk-ant-api03-test-key-123")
      assert {:ok, "sk-ant-api03-test-key-123"} = Auth.resolve_anthropic_key()
      System.delete_env("ANTHROPIC_API_KEY")
    end

    test "falls back to Pi AuthStorage when env var absent" do
      System.delete_env("ANTHROPIC_API_KEY")

      case Auth.resolve_anthropic_key() do
        {:ok, key} ->
          assert is_binary(key)
          assert byte_size(key) > 0

        {:error, reason} ->
          assert match?({:no_credential, "anthropic"}, reason) or
                   match?({:auth_storage_not_found, _}, reason)
      end
    end
  end

  describe "resolve_provider_key/1" do
    test "resolves known provider" do
      case Auth.resolve_provider_key("anthropic") do
        {:ok, key} -> assert is_binary(key) and byte_size(key) > 0
        {:error, _} -> :ok
      end
    end

    test "returns error for unknown provider" do
      assert {:error, {:no_credential, "nonexistent-provider-xyz"}} =
               Auth.resolve_provider_key("nonexistent-provider-xyz")
    end
  end

  # ─── Token Type Detection ───────────────────────────────────────────────

  describe "oauth_token?/1" do
    test "identifies OAuth tokens" do
      assert Auth.oauth_token?("sk-ant-oat01-abc123")
      assert Auth.oauth_token?("sk-ant-oat99-xyz")
    end

    test "rejects direct API keys" do
      refute Auth.oauth_token?("sk-ant-api03-abc123")
      refute Auth.oauth_token?("sk-not-an-oauth-token")
      refute Auth.oauth_token?("random-string")
    end
  end

  # ─── Token Expiry ───────────────────────────────────────────────────────

  describe "check_token_expiry/0" do
    test "returns seconds remaining or error" do
      case Auth.check_token_expiry() do
        {:ok, seconds} ->
          assert is_integer(seconds)
          assert seconds > 0

        {:error, reason} ->
          assert reason in [:expired, :no_expiry_info]
      end
    end
  end

  describe "auth_entry/1" do
    test "returns entry map for known provider" do
      case Auth.auth_entry("anthropic") do
        {:ok, entry} ->
          assert is_map(entry)
          assert Map.has_key?(entry, "access")
          assert Map.has_key?(entry, "type")

        {:error, _} ->
          :ok
      end
    end

    test "returns error for unknown provider" do
      assert {:error, {:no_entry, "nonexistent-xyz"}} = Auth.auth_entry("nonexistent-xyz")
    end
  end

  # ─── Finch.Request Header Transformation ────────────────────────────────

  describe "OAuthAnthropic Finch header transform" do
    test "transforms x-api-key to Bearer for OAuth tokens" do
      oauth_token = "sk-ant-oat01-test-finch-token"

      finch_request = %Finch.Request{
        scheme: :https,
        host: "api.anthropic.com",
        port: 443,
        method: "POST",
        path: "/v1/messages",
        query: nil,
        headers: [
          {"content-type", "application/json"},
          {"x-api-key", oauth_token},
          {"anthropic-version", "2023-06-01"},
          {"Accept", "text/event-stream"}
        ],
        body: "{}"
      }

      :persistent_term.put(:melanie_oauth_token, oauth_token)
      Application.put_env(:req_llm, :anthropic_api_key, oauth_token)

      transformed = OAuthAnthropic.transform_finch_request(finch_request)

      # x-api-key removed
      refute Enum.any?(transformed.headers, fn {k, _} -> k == "x-api-key" end)

      # Authorization: Bearer present
      assert {"authorization", "Bearer " <> ^oauth_token} =
               Enum.find(transformed.headers, fn {k, _} -> k == "authorization" end)

      # anthropic-beta includes oauth flag
      {_, beta} = Enum.find(transformed.headers, fn {k, _} -> k == "anthropic-beta" end)
      assert String.contains?(beta, "oauth-2025-04-20")

      :persistent_term.erase(:melanie_oauth_token)
    end

    test "preserves existing anthropic-beta flags" do
      oauth_token = "sk-ant-oat01-test"

      finch_request = %Finch.Request{
        scheme: :https,
        host: "api.anthropic.com",
        port: 443,
        method: "POST",
        path: "/v1/messages",
        query: nil,
        headers: [
          {"x-api-key", oauth_token},
          {"anthropic-beta", "prompt-caching-2024-07-31"},
          {"anthropic-version", "2023-06-01"}
        ],
        body: nil
      }

      Application.put_env(:req_llm, :anthropic_api_key, oauth_token)
      transformed = OAuthAnthropic.transform_finch_request(finch_request)

      {_, beta} = Enum.find(transformed.headers, fn {k, _} -> k == "anthropic-beta" end)
      assert String.contains?(beta, "prompt-caching-2024-07-31")
      assert String.contains?(beta, "oauth-2025-04-20")
    end

    test "passes through non-OAuth tokens unchanged" do
      api_key = "sk-ant-api03-direct-key"

      finch_request = %Finch.Request{
        scheme: :https,
        host: "api.anthropic.com",
        port: 443,
        method: "POST",
        path: "/v1/messages",
        query: nil,
        headers: [
          {"x-api-key", api_key},
          {"anthropic-version", "2023-06-01"}
        ],
        body: nil
      }

      # No OAuth token in config
      Application.put_env(:req_llm, :anthropic_api_key, api_key)
      :persistent_term.erase(:melanie_oauth_token)

      transformed = OAuthAnthropic.transform_finch_request(finch_request)

      assert {"x-api-key", ^api_key} =
               Enum.find(transformed.headers, fn {k, _} -> k == "x-api-key" end)

      refute Enum.any?(transformed.headers, fn {k, _} -> k == "authorization" end)
    end
  end

  # ─── Provider Registration ──────────────────────────────────────────────

  describe "OAuthAnthropic provider registration" do
    test "registers as :anthropic provider" do
      {:ok, original} = ReqLLM.Providers.get(:anthropic)

      try do
        OAuthAnthropic.register!()
        {:ok, registered} = ReqLLM.Providers.get(:anthropic)
        assert registered == OAuthAnthropic
      after
        ReqLLM.Providers.register(original)
      end
    end

    test "unregister restores upstream provider" do
      OAuthAnthropic.register!()
      {:ok, registered} = ReqLLM.Providers.get(:anthropic)
      assert registered == OAuthAnthropic

      OAuthAnthropic.unregister!()
      {:ok, restored} = ReqLLM.Providers.get(:anthropic)
      assert restored == ReqLLM.Providers.Anthropic
    end
  end
end
