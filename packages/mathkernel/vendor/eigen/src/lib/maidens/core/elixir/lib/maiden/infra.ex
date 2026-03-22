defmodule Maiden.Infra do
  @moduledoc """
  Shared infrastructure for all Maiden agent runtimes.

  ## Modules

  - `Maiden.Infra.Auth` — Pi AuthStorage credential resolution + token lifecycle
  - `Maiden.Infra.Providers.OAuthAnthropic` — OAuth-aware ReqLLM provider for Anthropic

  ## Usage

  Every Maiden runtime that needs LLM access calls this at startup:

      # In Application.start/2 or test_helper.exs:
      Maiden.Infra.Auth.configure!()

  This resolves credentials from Pi's AuthStorage, validates token expiry,
  configures ReqLLM, and registers the OAuth-aware provider if needed.

  ## Architecture

  ```
  Pi AuthStorage (~/.pi/agent/auth.json)
      │
      ▼
  Maiden.Infra.Auth.configure!()
      │
      ├── resolve key (env var → auth.json fallback)
      ├── validate expiry (warn <5min, error if expired)
      ├── store in ReqLLM config
      └── register OAuthAnthropic provider (if OAuth token detected)
              │
              ├── attach/3:        Req.Request header transform
              └── attach_stream/4: Finch.Request header transform
                      │
                      ├── Remove: x-api-key
                      ├── Add:    Authorization: Bearer <token>
                      └── Add:    anthropic-beta: oauth-2025-04-20
  ```
  """
end
