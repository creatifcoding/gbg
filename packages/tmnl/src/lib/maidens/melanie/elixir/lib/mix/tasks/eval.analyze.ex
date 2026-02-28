defmodule Mix.Tasks.Eval.Analyze do
  @shortdoc "Analyze eval observations and produce metrics"
  @moduledoc """
  Reads eval NDJSON observations and computes conditional metrics.

  ## Usage

      # Print summary to stdout
      mix eval.analyze --input eval/results/latest.ndjson

      # Export CSV files
      mix eval.analyze --input eval/results/latest.ndjson --format csv --output-dir eval/reports/

      # Export VegaLite heatmap HTML
      mix eval.analyze --input eval/results/latest.ndjson --format html --output-dir eval/reports/
  """

  use Mix.Task

  alias Maiden.Melanie.Eval.Analysis

  @impl Mix.Task
  def run(args) do
    {opts, _, _} =
      OptionParser.parse(args,
        strict: [
          input: :string,
          format: :string,
          output_dir: :string
        ]
      )

    Mix.Task.run("app.start")

    input_path = Keyword.fetch!(opts, :input)
    format = Keyword.get(opts, :format, "table")
    output_dir = Keyword.get(opts, :output_dir, "eval/reports")

    unless File.exists?(input_path) do
      Mix.raise("Input file not found: #{input_path}")
    end

    IO.puts("▶ Loading observations from #{input_path}")
    df = Analysis.load_observations(input_path)
    IO.puts("  #{Explorer.DataFrame.n_rows(df)} observations loaded")

    case format do
      "table" ->
        Analysis.print_summary(df)

      "csv" ->
        File.mkdir_p!(output_dir)

        precision_path = Path.join(output_dir, "precision_matrix.csv")
        Analysis.precision_matrix(df) |> Analysis.to_csv(precision_path)
        IO.puts("✓ Precision matrix → #{precision_path}")

        variant_path = Path.join(output_dir, "variant_summary.csv")
        Analysis.variant_summary(df) |> Analysis.to_csv(variant_path)
        IO.puts("✓ Variant summary → #{variant_path}")

        stratum_path = Path.join(output_dir, "stratum_summary.csv")
        Analysis.stratum_summary(df) |> Analysis.to_csv(stratum_path)
        IO.puts("✓ Stratum summary → #{stratum_path}")

      "html" ->
        File.mkdir_p!(output_dir)

        heatmap_path = Path.join(output_dir, "precision_heatmap.html")
        df |> Analysis.precision_heatmap() |> Analysis.export_heatmap_html(heatmap_path)
        IO.puts("✓ Precision heatmap → #{heatmap_path}")

        # Also print summary
        Analysis.print_summary(df)

      other ->
        Mix.raise("Unknown format: #{other}. Use 'table', 'csv', or 'html'.")
    end
  end
end
