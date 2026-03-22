defmodule Maiden.Melanie.Eval.Harness do
  @moduledoc """
  Core eval harness — executes the (query × variant × composition) matrix.

  Each probe: boot AgentServer → register tools → ask_sync → capture snapshot → match → observe.
  Uses Flow for parallel execution with backpressure and work-stealing concurrency.
  """

  alias Maiden.Melanie.Eval.{Corpus, Matchers, Observation}

  require Logger

  @default_timeout 90_000
  @default_concurrency 5

  @doc """
  Run the eval harness over a corpus with given variant/composition settings.

  ## Options

  - `:corpus_dir` — path to corpus JSON files
  - `:variant` — variant atom (:lean, :rich, etc.) applied to tool descriptions
  - `:composition` — composition name string
  - `:tool_modules` — list of tool module atoms to register
  - `:output_path` — NDJSON output file path
  - `:concurrency` — max parallel AgentServers (default 5)
  - `:timeout` — per-query timeout in ms (default 90_000)
  - `:on_progress` — optional callback fn(observation) for progress reporting
  """
  @spec run(keyword()) :: {:ok, %{observations: non_neg_integer(), path: String.t()}} | {:error, term()}
  def run(opts) do
    ensure_jido_started()

    corpus_dir = Keyword.fetch!(opts, :corpus_dir)
    variant = Keyword.fetch!(opts, :variant)
    composition = Keyword.fetch!(opts, :composition)
    tool_modules = Keyword.fetch!(opts, :tool_modules)
    output_path = Keyword.fetch!(opts, :output_path)
    concurrency = Keyword.get(opts, :concurrency, @default_concurrency)
    timeout = Keyword.get(opts, :timeout, @default_timeout)
    on_progress = Keyword.get(opts, :on_progress, fn _obs -> :ok end)

    with {:ok, queries} <- Corpus.load(corpus_dir) do
      File.mkdir_p!(Path.dirname(output_path))
      file = File.open!(output_path, [:write, :utf8])

      try do
        count =
          queries
          |> Flow.from_enumerable(stages: concurrency, max_demand: 1)
          |> Flow.map(fn query ->
            try do
              run_single_query(query, tool_modules, variant, composition, timeout)
            catch
              kind, reason ->
                error_msg = "#{kind}: #{inspect(reason)}"
                Logger.error("[harness] Query #{query.id} crashed: #{error_msg}")

                Observation.from_error(query, error_msg, 0,
                  variant: to_string(variant),
                  composition: composition
                )
            end
          end)
          |> Flow.map(fn observation ->
            try do
              line = observation |> Observation.to_ndjson_map() |> Jason.encode!()
              IO.write(file, line <> "\n")
              on_progress.(observation)
              observation
            rescue
              e ->
                Logger.error("[harness] Write failed: #{Exception.message(e)}")
                observation
            end
          end)
          |> Enum.count()

        {:ok, %{observations: count, path: output_path}}
      after
        File.close(file)
      end
    end
  end

  @doc """
  Run a single query against an AgentServer and return an Observation.
  """
  @spec run_single_query(map(), [module()], atom(), String.t(), non_neg_integer()) ::
          Observation.t()
  def run_single_query(query, tool_modules, variant, composition, timeout \\ @default_timeout) do
    start_ms = System.monotonic_time(:millisecond)

    try do
      {:ok, pid} = start_agent_server(tool_modules)

      result = Maiden.Melanie.Runtime.Agent.ask_sync(pid, query.query, timeout: timeout)

      e2e_ms = System.monotonic_time(:millisecond) - start_ms

      case result do
        {:ok, _answer} ->
          snapshot = get_snapshot(pid)
          tools_called = extract_tool_calls(snapshot)
          match_result = Matchers.evaluate(tools_called, query.gold)

          Observation.from_snapshot(query, snapshot, match_result, e2e_ms,
            variant: to_string(variant),
            composition: composition
          )

        {:error, reason} ->
          Observation.from_error(query, inspect(reason), e2e_ms,
            variant: to_string(variant),
            composition: composition
          )
      end
    rescue
      e ->
        e2e_ms = System.monotonic_time(:millisecond) - start_ms

        Observation.from_error(query, Exception.message(e), e2e_ms,
          variant: to_string(variant),
          composition: composition
        )
    end
  end

  # -- Private ----------------------------------------------------------------

  defp ensure_jido_started do
    case Jido.start_link(name: Jido.Default) do
      {:ok, _pid} -> :ok
      {:error, {:already_started, _pid}} -> :ok
      {:error, reason} -> raise "Failed to start Jido.Default: #{inspect(reason)}"
    end
  end

  defp start_agent_server(tool_modules) do
    child_spec =
      {Jido.AgentServer, agent: Maiden.Melanie.Runtime.Agent, jido: Jido.Default}
      |> Supervisor.child_spec(restart: :temporary)

    case DynamicSupervisor.start_child(Jido.Default.AgentSupervisor, child_spec) do
      {:ok, pid} ->
        Enum.each(tool_modules, fn mod ->
          case Jido.AI.register_tool(pid, mod, timeout: 5_000, validate: true) do
            {:ok, _agent} -> :ok
            :ok -> :ok
            {:error, reason} ->
              Logger.warning("[harness] Failed to register tool #{inspect(mod)}: #{inspect(reason)}")
          end
        end)

        {:ok, pid}

      error ->
        error
    end
  end

  defp get_snapshot(pid) do
    case Jido.AgentServer.status(pid) do
      {:ok, status} -> status.snapshot || %{details: %{}}
      _ -> %{details: %{}}
    end
  end

  defp extract_tool_calls(snapshot) do
    details = get_field(snapshot, :details) || %{}
    conversation = get_field(details, :conversation) || []

    conversation
    |> Enum.flat_map(fn msg ->
      role = get_field(msg, :role)
      tcs = get_field(msg, :tool_calls)

      if role in [:assistant, "assistant"] && is_list(tcs) do
        Enum.map(tcs, fn tc ->
          %{
            name: get_field(tc, :name) || get_field(tc, :function) || "unknown",
            arguments: get_field(tc, :arguments) || get_field(tc, :input) || %{}
          }
        end)
      else
        []
      end
    end)
  end

  defp get_field(%{__struct__: _} = struct, key), do: Map.get(struct, key)
  defp get_field(map, key) when is_map(map), do: map[key] || map[to_string(key)]
  defp get_field(_, _), do: nil
end
