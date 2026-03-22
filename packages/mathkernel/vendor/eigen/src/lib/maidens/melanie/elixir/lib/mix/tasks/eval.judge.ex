defmodule Mix.Tasks.Eval.Judge do
  @shortdoc "Run LLM-as-judge quality scoring on eval observations"
  @moduledoc """
  Reads eval observations from NDJSON, runs quality scoring via LLM-as-judge,
  and writes updated observations with backfilled quality fields.

  ## Usage

      # Judge 20% subsample (default)
      mix eval.judge --input eval/results/latest.ndjson

      # Judge all observations
      mix eval.judge --input eval/results/latest.ndjson --judge-all

      # Custom sample rate
      mix eval.judge --input eval/results/latest.ndjson --sample-rate 0.5
  """

  use Mix.Task

  alias Maiden.Melanie.Eval.Judge

  @impl Mix.Task
  def run(args) do
    {opts, _, _} =
      OptionParser.parse(args,
        strict: [
          input: :string,
          output: :string,
          sample_rate: :float,
          judge_all: :boolean,
          model: :string,
          concurrency: :integer
        ]
      )

    Mix.Task.run("app.start")

    input_path = Keyword.fetch!(opts, :input)
    output_path = Keyword.get(opts, :output, String.replace(input_path, ".ndjson", ".judged.ndjson"))

    unless File.exists?(input_path) do
      Mix.raise("Input file not found: #{input_path}")
    end

    IO.puts("▶ Reading observations from #{input_path}")

    observations =
      input_path
      |> File.read!()
      |> String.split("\n", trim: true)
      |> Enum.map(&Jason.decode!/1)

    IO.puts("  #{length(observations)} observations loaded")

    judge_opts = [
      sample_rate: Keyword.get(opts, :sample_rate, 0.2),
      judge_all: Keyword.get(opts, :judge_all, false)
    ]

    IO.puts("▶ Running judge pass...")
    judged = Judge.judge(observations, judge_opts)

    # Count how many were actually judged
    judged_count =
      Enum.count(judged, fn obs -> obs["answer_quality_score"] != nil end)

    IO.puts("  #{judged_count} observations judged")

    # Write output
    File.mkdir_p!(Path.dirname(output_path))
    content = Enum.map_join(judged, "\n", &Jason.encode!/1)
    File.write!(output_path, content <> "\n")

    IO.puts("✓ Written to #{output_path}")
  end
end
