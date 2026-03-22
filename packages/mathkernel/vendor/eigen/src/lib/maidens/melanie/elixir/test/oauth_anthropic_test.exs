defmodule Maiden.Melanie.Runtime.Providers.OAuthAnthropicTest do
  use ExUnit.Case, async: true

  alias Maiden.Infra.Providers.OAuthAnthropic
  alias Maiden.Melanie.Runtime.AuthBridge

  describe "AuthBridge.resolve_anthropic_key/0" do
    test "resolves from ANTHROPIC_API_KEY env var when set" do
      System.put_env("ANTHROPIC_API_KEY", "sk-ant-api-test-key-123")

      assert {:ok, "sk-ant-api-test-key-123"} = AuthBridge.resolve_anthropic_key()

      System.delete_env("ANTHROPIC_API_KEY")
    end

    test "falls back to Pi AuthStorage when env var empty" do
      System.delete_env("ANTHROPIC_API_KEY")

      case AuthBridge.resolve_anthropic_key() do
        {:ok, key} ->
          assert is_binary(key)
          assert byte_size(key) > 0

        {:error, reason} ->
          # Acceptable if no auth.json exists
          assert match?(:no_anthropic_credential, reason) or
                   match?({:auth_storage_not_found, _}, reason)
      end
    end
  end

  describe "AuthBridge.oauth_token?/1" do
    test "identifies OAuth tokens" do
      assert AuthBridge.oauth_token?("sk-ant-oat01-abc123")
      assert AuthBridge.oauth_token?("sk-ant-oat99-xyz")
    end

    test "rejects direct API keys" do
      refute AuthBridge.oauth_token?("sk-ant-api03-abc123")
      refute AuthBridge.oauth_token?("sk-not-an-oauth-token")
      refute AuthBridge.oauth_token?("random-string")
    end
  end

  describe "AuthBridge.check_token_expiry/0" do
    test "returns seconds remaining or error" do
      case AuthBridge.check_token_expiry() do
        {:ok, seconds} ->
          assert is_integer(seconds)
          assert seconds > 0

        {:error, reason} ->
          assert reason in [:expired, :no_expiry_info]
      end
    end
  end

  describe "OAuthAnthropic header transformation — Req.Request" do
    test "provider replaces upstream in registry for attach/3 path" do
      # The Req path (non-streaming) flows through attach/3 which
      # delegates to upstream, then post-processes headers.
      # We verify this indirectly by confirming the provider is registered
      # and that the live tests pass (tested in melanie_react_test.exs).
      #
      # Direct unit testing of attach/3 requires a valid LLMDB.Model struct
      # which needs the full ReqLLM catalog — tested via integration instead.
      OAuthAnthropic.register!()
      {:ok, module} = ReqLLM.Providers.get(:anthropic)
      assert module == OAuthAnthropic

      # Restore
      OAuthAnthropic.unregister!()
    end
  end

  describe "OAuthAnthropic header transformation — Finch.Request" do
    test "transforms x-api-key to Bearer for OAuth tokens in Finch request" do
      oauth_token = "sk-ant-oat01-test-oauth-finch-token"

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
        body: "{\"model\":\"claude-sonnet-4-20250514\",\"max_tokens\":1024}"
      }

      # Use persistent_term directly (what OAuthAnthropic.register_token does internally)
      :persistent_term.put(:melanie_oauth_token, oauth_token)

      # Transform via the interceptor helper
      transformed = OAuthAnthropic.transform_finch_request(finch_request)

      # Verify x-api-key is gone
      refute Enum.any?(transformed.headers, fn {k, _} -> k == "x-api-key" end)

      # Verify Authorization: Bearer is present
      assert {"authorization", "Bearer " <> ^oauth_token} =
               Enum.find(transformed.headers, fn {k, _} -> k == "authorization" end)

      # Verify anthropic-beta includes oauth flag
      {_, beta_value} = Enum.find(transformed.headers, fn {k, _} -> k == "anthropic-beta" end)
      assert String.contains?(beta_value, "oauth-2025-04-20")

      # Cleanup
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

      :persistent_term.put(:melanie_oauth_token, oauth_token)
      transformed = OAuthAnthropic.transform_finch_request(finch_request)

      {_, beta_value} = Enum.find(transformed.headers, fn {k, _} -> k == "anthropic-beta" end)
      assert String.contains?(beta_value, "prompt-caching-2024-07-31")
      assert String.contains?(beta_value, "oauth-2025-04-20")

      :persistent_term.erase(:melanie_oauth_token)
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

      # No OAuth token registered → no transformation
      :persistent_term.erase(:melanie_oauth_token)
      transformed = OAuthAnthropic.transform_finch_request(finch_request)

      # x-api-key should still be there
      assert {"x-api-key", ^api_key} =
               Enum.find(transformed.headers, fn {k, _} -> k == "x-api-key" end)

      # No Authorization header should be added
      refute Enum.any?(transformed.headers, fn {k, _} -> k == "authorization" end)
    end
  end

  describe "OAuthAnthropic provider registration" do
    test "registers as :anthropic provider" do
      # Save original
      {:ok, original} = ReqLLM.Providers.get(:anthropic)

      try do
        OAuthAnthropic.register!()

        {:ok, registered} = ReqLLM.Providers.get(:anthropic)
        assert registered == OAuthAnthropic
      after
        # Restore original
        ReqLLM.Providers.register(original)
      end
    end

    test "unregister restores upstream provider" do
      # Ensure we start from OAuth state
      OAuthAnthropic.register!()
      {:ok, registered} = ReqLLM.Providers.get(:anthropic)
      assert registered == OAuthAnthropic

      OAuthAnthropic.unregister!()
      {:ok, restored} = ReqLLM.Providers.get(:anthropic)
      assert restored == ReqLLM.Providers.Anthropic

      # Re-register for other tests (test_helper sets this up)
      OAuthAnthropic.register!()
    end
  end
end
