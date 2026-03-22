defmodule Mix.Tasks.Eval.Run do
  @shortdoc "Run the tool effectivity eval harness"
  @moduledoc """
  Runs Melanie's tool effectivity evaluation harness.

  ## Usage

      # Dry run — show budget estimate only
      mix eval.run --dry-run --variant lean --composition core_3

      # Diagonal slice — cheapest meaningful signal
      mix eval.run --diagonal --concurrency 3

      # Specific variant and composition
      mix eval.run --variant rich --composition core_5

      # Full matrix with budget cap
      mix eval.run --all --max-cost 25.00 --concurrency 5

      # Budget-capped run
      mix eval.run --variant lean,rich --composition core_3,core_5 --max-cost 5.00

  ## Flags

  - `--variant` — comma-separated variant names (minimal,lean,rich,rich_examples,over_specified)
  - `--composition` — comma-separated composition names (core_3,core_5,core_5_decoys,scaled_15)
  - `--all` — run full matrix (all variants × all compositions)
  - `--diagonal` — one variant per stratum (cheapest meaningful signal)
  - `--dry-run` — compute and display budget, don't execute
  - `--concurrency` — max parallel AgentServers (default 5)
  - `--max-cost` — budget cap in USD (abort if estimate exceeds)
  - `--timeout` — per-query timeout in ms (default 90000)
  - `--output` — NDJSON output path (default eval/results/<timestamp>.ndjson)
  - `--corpus` — corpus directory (default eval/corpus)
  """

  use Mix.Task

  alias Maiden.Melanie.Eval.{Budget, Harness, VariantRegistry}

  @impl Mix.Task
  def run(args) do
    {opts, _, _} =
      OptionParser.parse(args,
        strict: [
          variant: :string,
          composition: :string,
          all: :boolean,
          diagonal: :boolean,
          dry_run: :boolean,
          concurrency: :integer,
          max_cost: :float,
          timeout: :integer,
          output: :string,
          corpus: :string
        ],
        aliases: [v: :variant, c: :composition, n: :concurrency, o: :output]
      )

    # Start necessary applications
    Mix.Task.run("app.start")

    # Configure Anthropic credentials via Pi OAuth bridge (if no env var set)
    unless System.get_env("ANTHROPIC_API_KEY") do
      Maiden.Melanie.Runtime.AuthBridge.configure!()
    end

    # Parse options
    variants = parse_variants(opts)
    compositions = parse_compositions(opts)
    concurrency = Keyword.get(opts, :concurrency, 5)
    timeout = Keyword.get(opts, :timeout, 90_000)
    corpus_dir = Keyword.get(opts, :corpus, corpus_path())

    timestamp = DateTime.utc_now() |> DateTime.to_iso8601(:basic) |> String.replace(~r/[^0-9T]/, "")
    output_path = Keyword.get(opts, :output, Path.join(results_path(), "#{timestamp}.ndjson"))

    # Compute budget
    budget =
      Budget.estimate(
        corpus_size: corpus_size(corpus_dir),
        variants: variants,
        compositions: Enum.map(compositions, &{String.to_atom(&1), VariantRegistry.tool_count(&1)}),
        concurrency: concurrency
      )

    IO.puts(Budget.format(budget))

    # Dry run exits here
    if Keyword.get(opts, :dry_run, false) do
      IO.puts("\n✓ Dry run complete. Budget JSON:")
      IO.puts(Jason.encode!(Budget.to_json(budget), pretty: true))
      :ok
    else
      # Budget cap check
      max_cost = Keyword.get(opts, :max_cost)

      if max_cost && budget.estimated_cost_usd > max_cost do
        Mix.raise(
          "Budget exceeded: estimated $#{budget.estimated_cost_usd} > cap $#{max_cost}. " <>
            "Use --dry-run to inspect, or increase --max-cost."
        )
      end

      # Run the harness for each (variant, composition) pair
      total = length(variants) * length(compositions)
      counter = :counters.new(1, [:atomics])

      IO.puts("\n▶ Starting eval run: #{total} configuration(s), #{concurrency} concurrent\n")

      for variant <- variants, composition <- compositions do
        IO.puts("  ┌─ Variant: #{variant} × Composition: #{composition}")

        tool_modules = VariantRegistry.resolve!(variant, composition)

        result =
          Harness.run(
            corpus_dir: corpus_dir,
            variant: variant,
            composition: composition,
            tool_modules: tool_modules,
            output_path: output_path,
            concurrency: concurrency,
            timeout: timeout,
            on_progress: fn obs ->
              :counters.add(counter, 1, 1)
              n = :counters.get(counter, 1)
              status = if obs.error, do: "✗", else: "✓"
              IO.write("  │ #{status} [#{n}] #{obs.query_id} (#{obs.e2e_latency_ms}ms)\n")
            end
          )

        case result do
          {:ok, %{observations: count}} ->
            IO.puts("  └─ ✓ #{count} observations written\n")

          {:error, reason} ->
            IO.puts("  └─ ✗ Error: #{inspect(reason)}\n")
        end
      end

      total_obs = :counters.get(counter, 1)
      IO.puts("═══════════════════════════════════════")
      IO.puts("  Total observations: #{total_obs}")
      IO.puts("  Output: #{output_path}")
      IO.puts("═══════════════════════════════════════")
    end
  end

  # ── Private ──────────────────────────────────────────────────────────────

  defp parse_variants(opts) do
    cond do
      Keyword.get(opts, :all, false) -> VariantRegistry.variant_atoms()
      Keyword.get(opts, :diagonal, false) -> [:lean]
      true ->
        case Keyword.get(opts, :variant) do
          nil -> [:lean]
          str -> str |> String.split(",") |> Enum.map(&String.to_atom/1)
        end
    end
  end

  defp parse_compositions(opts) do
    cond do
      Keyword.get(opts, :all, false) -> VariantRegistry.composition_names()
      Keyword.get(opts, :diagonal, false) -> ["core_3"]
      true ->
        case Keyword.get(opts, :composition) do
          nil -> ["core_3"]
          str -> String.split(str, ",")
        end
    end
  end

  defp corpus_path do
    Path.join(File.cwd!(), "eval/corpus")
  end

  defp results_path do
    Path.join(File.cwd!(), "eval/results")
  end

  defp corpus_size(dir) do
    case File.ls(dir) do
      {:ok, files} ->
        files
        |> Enum.filter(&String.ends_with?(&1, ".json"))
        |> Enum.reduce(0, fn file, acc ->
          case File.read(Path.join(dir, file)) do
            {:ok, contents} ->
              case Jason.decode(contents) do
                {:ok, list} when is_list(list) -> acc + length(list)
                _ -> acc
              end
            _ -> acc
          end
        end)
      _ -> 75
    end
  end
end
