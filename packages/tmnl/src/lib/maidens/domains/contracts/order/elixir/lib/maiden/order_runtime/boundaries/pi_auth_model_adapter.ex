defmodule Maiden.OrderRuntime.Boundaries.PiAuthModelAdapter do
  @moduledoc """
  Live model adapter that delegates credential resolution to pi AuthStorage
  via the Bun bridge script.

  Flow:
  1. Elixir passes provider/model/prompt/options to `order-model-bridge.ts`
  2. Bridge resolves credentials from `~/.pi/agent/auth.json` using AuthStorage
  3. Bridge calls provider API (OpenAI/Anthropic or configured gateway)
  4. Elixir receives normalized result payload
  """

  @behaviour Maiden.OrderRuntime.Boundaries.ModelAdapter

  @bridge_script Path.expand("../../../../../scripts/order-model-bridge.ts", __DIR__)
  @default_timeout 90_000

  @impl true
  def infer_model(prompt, opts) when is_binary(prompt) and (is_map(opts) or is_list(opts)) do
    options = normalize_options(opts)

    payload = %{
      provider: resolve_provider(options),
      model: resolve_model(options),
      prompt: prompt,
      options: options
    }

    with {:ok, encoded_payload} <- Jason.encode(payload),
         {:ok, stdout} <- run_bridge(encoded_payload, options),
         {:ok, decoded} <- Jason.decode(stdout),
         {:ok, result} <- decode_bridge_result(decoded) do
      {:ok, result}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  def infer_model(_prompt, _opts), do: {:error, :invalid_prompt}

  defp run_bridge(encoded_payload, options) do
    timeout = resolve_timeout(options)

    args = ["run", resolve_bridge_script(options)]

    env =
      []
      |> put_env_if_present("ORDER_MODEL_BRIDGE_INPUT", encoded_payload)
      |> put_env_if_present(
        "ORDER_MODEL_AUTH_STORAGE_PATH",
        get_string(options, :auth_storage_path) || System.get_env("ORDER_MODEL_AUTH_STORAGE_PATH")
      )
      |> put_env_if_present(
        "ORDER_MODEL_GATEWAY_URL",
        get_string(options, :gateway_url) || System.get_env("ORDER_MODEL_GATEWAY_URL")
      )
      |> put_env_if_present("ORDER_OPENAI_BASE_URL", System.get_env("ORDER_OPENAI_BASE_URL"))
      |> put_env_if_present("ORDER_ANTHROPIC_BASE_URL", System.get_env("ORDER_ANTHROPIC_BASE_URL"))
      |> put_env_if_present("ORDER_MODEL_BRIDGE_DEBUG", System.get_env("ORDER_MODEL_BRIDGE_DEBUG"))

    task =
      Task.async(fn ->
        try do
          {:ok,
           System.cmd("bun", args,
             stderr_to_stdout: true,
             env: env
           )}
        rescue
          error -> {:error, {:bridge_exception, Exception.message(error)}}
        end
      end)

    case Task.yield(task, timeout) || Task.shutdown(task, :brutal_kill) do
      {:ok, {:ok, {stdout, 0}}} ->
        {:ok, stdout}

      {:ok, {:ok, {stdout, _exit_code}}} ->
        {:error, {:bridge_failed, String.trim(stdout)}}

      {:ok, {:error, reason}} ->
        {:error, reason}

      nil ->
        {:error, {:bridge_timeout, timeout}}
    end
  end

  defp resolve_bridge_script(options) do
    get_string(options, :bridge_script) || @bridge_script
  end

  defp decode_bridge_result(%{"ok" => true, "result" => result}) when is_map(result),
    do: {:ok, atomize_result_keys(result)}

  defp decode_bridge_result(%{"ok" => false, "error" => error} = payload),
    do: {:error, {:provider_error, error, Map.get(payload, "details")}}

  defp decode_bridge_result(payload), do: {:error, {:invalid_bridge_payload, payload}}

  defp atomize_result_keys(result) do
    Enum.reduce(result, %{}, fn {key, value}, acc ->
      Map.put(acc, normalize_result_key(key), value)
    end)
  end

  defp normalize_result_key("provider"), do: :provider
  defp normalize_result_key("model"), do: :model
  defp normalize_result_key("content"), do: :content
  defp normalize_result_key("usage"), do: :usage
  defp normalize_result_key("id"), do: :id
  defp normalize_result_key(key), do: key

  defp resolve_provider(options) do
    get_string(options, :provider) || get_provider_from_model(get_string(options, :model)) ||
      System.get_env("ORDER_LIVE_PROVIDER") || "openai"
  end

  defp resolve_model(options) do
    model = get_string(options, :model) || System.get_env("ORDER_LIVE_MODEL") || ""

    case String.split(model, ["/", ":"], parts: 2) do
      [_provider, actual_model] when actual_model != "" -> actual_model
      _ -> model
    end
  end

  defp get_provider_from_model(nil), do: nil

  defp get_provider_from_model(model) when is_binary(model) do
    case String.split(model, ["/", ":"], parts: 2) do
      [provider, _] when provider != "" -> provider
      _ -> nil
    end
  end

  defp resolve_timeout(options) do
    case get_integer(options, :timeout_ms) || get_integer(options, :timeout) do
      timeout when is_integer(timeout) and timeout > 0 -> timeout
      _ -> @default_timeout
    end
  end

  defp normalize_options(options) when is_map(options), do: options
  defp normalize_options(options) when is_list(options), do: Map.new(options)

  defp get_string(options, key) when is_map(options) do
    case Map.get(options, key) || Map.get(options, Atom.to_string(key)) do
      value when is_binary(value) -> value
      _ -> nil
    end
  end

  defp get_integer(options, key) when is_map(options) do
    case Map.get(options, key) || Map.get(options, Atom.to_string(key)) do
      value when is_integer(value) -> value
      value when is_binary(value) ->
        case Integer.parse(value) do
          {parsed, ""} -> parsed
          _ -> nil
        end

      _ -> nil
    end
  end

  defp put_env_if_present(env, _key, nil), do: env
  defp put_env_if_present(env, _key, ""), do: env
  defp put_env_if_present(env, key, value), do: [{key, value} | env]
end
