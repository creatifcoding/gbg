defmodule Maiden.Melanie.Eval.Corpus do
  @moduledoc """
  Corpus loader — reads stratified query corpus from JSON files.

  Each corpus file is a JSON array of query objects with gold annotations.
  Queries are grouped by stratum for controlled evaluation.

  ## Strata

  - `:direct_lookup` — factual questions with clear single-tool answers
  - `:synthesis` — questions requiring search then summarization
  - `:relationship` — questions about connections between entities
  - `:ambiguous` — underspecified queries testing tool selection judgment
  - `:adversarial` — out-of-scope questions testing false positive resistance
  - `:multi_hop` — questions requiring multiple sequential tool calls
  """

  @type gold :: %{
          tool_sequence: [String.t()],
          param_shapes: %{optional(String.t()) => [String.t()]},
          should_not_call: [String.t()]
        }

  @type query :: %{
          id: String.t(),
          stratum: atom(),
          query: String.t(),
          gold: gold()
        }

  @valid_strata ~w(direct_lookup synthesis relationship ambiguous adversarial multi_hop)a

  @doc """
  Load the full corpus from a directory of JSON files.

  Each JSON file should be named after its stratum (e.g., `direct_lookup.json`)
  and contain an array of query objects.
  """
  @spec load(String.t()) :: {:ok, [query()]} | {:error, term()}
  def load(corpus_dir) do
    with {:ok, files} <- list_corpus_files(corpus_dir),
         {:ok, queries} <- load_files(files),
         :ok <- validate(queries) do
      {:ok, queries}
    end
  end

  @doc "Load corpus, raise on error."
  @spec load!(String.t()) :: [query()]
  def load!(corpus_dir) do
    case load(corpus_dir) do
      {:ok, queries} -> queries
      {:error, reason} -> raise "Corpus load failed: #{inspect(reason)}"
    end
  end

  @doc "Group queries by stratum."
  @spec group_by_stratum([query()]) :: %{atom() => [query()]}
  def group_by_stratum(queries) do
    Enum.group_by(queries, & &1.stratum)
  end

  @doc "Filter queries to a specific set of strata."
  @spec filter_strata([query()], [atom()]) :: [query()]
  def filter_strata(queries, strata) do
    Enum.filter(queries, &(&1.stratum in strata))
  end

  @doc "Select a diagonal slice — one query per stratum, rotating through."
  @spec diagonal_slice([query()]) :: [query()]
  def diagonal_slice(queries) do
    queries
    |> group_by_stratum()
    |> Enum.flat_map(fn {_stratum, qs} -> qs end)
  end

  # ── Private ──────────────────────────────────────────────────────────────

  defp list_corpus_files(dir) do
    case File.ls(dir) do
      {:ok, entries} ->
        files =
          entries
          |> Enum.filter(&String.ends_with?(&1, ".json"))
          |> Enum.map(&Path.join(dir, &1))

        if files == [], do: {:error, :no_corpus_files}, else: {:ok, files}

      {:error, reason} ->
        {:error, {:corpus_dir, reason}}
    end
  end

  defp load_files(files) do
    results =
      Enum.flat_map(files, fn file ->
        stratum = file |> Path.basename(".json") |> String.to_atom()

        with {:ok, contents} <- File.read(file),
             {:ok, raw_queries} <- Jason.decode(contents) do
          Enum.map(raw_queries, &parse_query(&1, stratum))
        else
          {:error, reason} -> raise "Failed to load #{file}: #{inspect(reason)}"
        end
      end)

    {:ok, results}
  end

  defp parse_query(raw, stratum) do
    gold = raw["gold"] || %{}

    %{
      id: raw["id"],
      stratum: stratum,
      query: raw["query"],
      gold: %{
        tool_sequence: gold["tool_sequence"] || [],
        param_shapes: parse_param_shapes(gold["param_shapes"] || %{}),
        should_not_call: gold["should_not_call"] || []
      }
    }
  end

  defp parse_param_shapes(shapes) when is_map(shapes) do
    Map.new(shapes, fn {tool_name, shape_list} ->
      {tool_name, List.wrap(shape_list)}
    end)
  end

  defp validate(queries) do
    ids = Enum.map(queries, & &1.id)
    dupes = ids -- Enum.uniq(ids)

    cond do
      dupes != [] ->
        {:error, {:duplicate_ids, Enum.uniq(dupes)}}

      Enum.any?(queries, &is_nil(&1.id)) ->
        {:error, :missing_query_id}

      Enum.any?(queries, fn q -> q.stratum not in @valid_strata end) ->
        invalid = queries |> Enum.reject(&(&1.stratum in @valid_strata)) |> Enum.map(& &1.stratum)
        {:error, {:invalid_strata, Enum.uniq(invalid)}}

      true ->
        :ok
    end
  end
end
