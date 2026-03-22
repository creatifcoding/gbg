defmodule Maiden.Melanie.Eval.Analysis do
  @moduledoc """
  Explorer-based analysis module — conditional metrics from eval observations.

  Reads NDJSON observations into Explorer DataFrame, computes:
  - Precision(stratum, variant) — tool selection accuracy
  - Conformance(stratum, variant) — parameter shape match rate
  - Gradients — delta precision between adjacent variants
  - Confusion matrix — tools_expected × tools_called cross-tab

  Exports: CSV, VegaLite heatmaps, stdout summary.
  """

  require Explorer.DataFrame, as: DF

  NimbleCSV.define(EvalCSV, separator: ",")

  @doc """
  Load NDJSON observations into an Explorer DataFrame.
  """
  @spec load_observations(String.t()) :: Explorer.DataFrame.t()
  def load_observations(path) do
    DF.from_ndjson!(path)
  end

  @doc """
  Compute Precision(stratum, variant) — mean selection_correct grouped by stratum and variant.
  """
  @spec precision_matrix(Explorer.DataFrame.t()) :: Explorer.DataFrame.t()
  def precision_matrix(df) do
    df
    |> DF.group_by(["stratum", "tool_variant"])
    |> DF.summarise(
      precision: mean(selection_correct),
      conformance: mean(params_conformant),
      count: count(query_id),
      mean_latency_ms: mean(e2e_latency_ms),
      mean_input_tokens: mean(input_tokens),
      mean_iterations: mean(iteration_count)
    )
    |> DF.sort_by([asc: stratum, asc: tool_variant])
  end

  @doc """
  Compute per-variant aggregate metrics (across all strata).
  """
  @spec variant_summary(Explorer.DataFrame.t()) :: Explorer.DataFrame.t()
  def variant_summary(df) do
    df
    |> DF.group_by(["tool_variant"])
    |> DF.summarise(
      precision: mean(selection_correct),
      conformance: mean(params_conformant),
      count: count(query_id),
      mean_latency_ms: mean(e2e_latency_ms),
      mean_tokens: mean(total_tokens),
      error_rate: mean(error)
    )
    |> DF.sort_by(asc: tool_variant)
  end

  @doc """
  Compute per-stratum aggregate metrics (across all variants).
  """
  @spec stratum_summary(Explorer.DataFrame.t()) :: Explorer.DataFrame.t()
  def stratum_summary(df) do
    df
    |> DF.group_by(["stratum"])
    |> DF.summarise(
      precision: mean(selection_correct),
      conformance: mean(params_conformant),
      count: count(query_id),
      mean_latency_ms: mean(e2e_latency_ms),
      mean_iterations: mean(iteration_count)
    )
    |> DF.sort_by(asc: stratum)
  end

  @doc """
  Export precision matrix to CSV.
  """
  @spec to_csv(Explorer.DataFrame.t(), String.t()) :: :ok
  def to_csv(df, path) do
    DF.to_csv!(df, path)
  end

  @doc """
  Generate a VegaLite heatmap spec for Precision(stratum, variant).

  Returns a VegaLite spec map that can be exported to JSON/HTML.
  """
  @spec precision_heatmap(Explorer.DataFrame.t()) :: VegaLite.t()
  def precision_heatmap(df) do
    matrix = precision_matrix(df)

    data =
      matrix
      |> DF.to_rows()
      |> Enum.map(fn row ->
        %{
          "stratum" => row["stratum"],
          "variant" => row["tool_variant"],
          "precision" => row["precision"]
        }
      end)

    VegaLite.new(width: 500, height: 300, title: "Tool Selection Precision by Stratum × Variant")
    |> VegaLite.data_from_values(data)
    |> VegaLite.mark(:rect)
    |> VegaLite.encode_field(:x, "variant", type: :nominal, title: "Tool Variant")
    |> VegaLite.encode_field(:y, "stratum", type: :nominal, title: "Query Stratum")
    |> VegaLite.encode_field(:color, "precision",
      type: :quantitative,
      scale: %{scheme: "viridis", domain: [0, 1]},
      title: "Precision"
    )
  end

  @doc """
  Export VegaLite spec to a standalone HTML file.
  """
  @spec export_heatmap_html(VegaLite.t(), String.t()) :: :ok
  def export_heatmap_html(vl_spec, path) do
    # VegaLite.to_spec returns the map; we encode to JSON ourselves
    spec_json = vl_spec |> VegaLite.to_spec() |> Jason.encode!()

    html = """
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Eval Harness — Precision Heatmap</title>
      <script src="https://cdn.jsdelivr.net/npm/vega@5"></script>
      <script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>
      <script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>
    </head>
    <body style="font-family: monospace; background: #1a1a2e; color: #e0e0e0; padding: 2rem;">
      <h1>Tool Selection Precision — Stratum × Variant</h1>
      <div id="vis"></div>
      <script>
        var spec = #{spec_json};
        vegaEmbed('#vis', spec, {theme: 'dark'});
      </script>
    </body>
    </html>
    """

    File.mkdir_p!(Path.dirname(path))
    File.write!(path, html)
  end

  @doc """
  Print a summary table to stdout.
  """
  @spec print_summary(Explorer.DataFrame.t()) :: :ok
  def print_summary(df) do
    IO.puts("\n╔══════════════════════════════════════════════════════════════════╗")
    IO.puts("║               EVAL HARNESS ANALYSIS SUMMARY                    ║")
    IO.puts("╠══════════════════════════════════════════════════════════════════╣")

    total = DF.n_rows(df)
    errors = df |> DF.filter(error != nil) |> DF.n_rows()

    IO.puts("║ Total observations: #{total}")
    IO.puts("║ Errors: #{errors} (#{Float.round(errors / max(total, 1) * 100, 1)}%)")
    IO.puts("╠══════════════════════════════════════════════════════════════════╣")
    IO.puts("║ BY VARIANT:")

    variant_summary(df)
    |> DF.to_rows()
    |> Enum.each(fn row ->
      IO.puts("║   #{String.pad_trailing(row["tool_variant"] || "?", 18)} " <>
        "P=#{format_pct(row["precision"])} " <>
        "C=#{format_pct(row["conformance"])} " <>
        "n=#{row["count"]}")
    end)

    IO.puts("╠══════════════════════════════════════════════════════════════════╣")
    IO.puts("║ BY STRATUM:")

    stratum_summary(df)
    |> DF.to_rows()
    |> Enum.each(fn row ->
      IO.puts("║   #{String.pad_trailing(row["stratum"] || "?", 18)} " <>
        "P=#{format_pct(row["precision"])} " <>
        "C=#{format_pct(row["conformance"])} " <>
        "n=#{row["count"]}")
    end)

    IO.puts("╚══════════════════════════════════════════════════════════════════╝")
    :ok
  end

  defp format_pct(nil), do: "  N/A"
  defp format_pct(val), do: String.pad_leading("#{Float.round(val * 100, 1)}%", 6)
end
