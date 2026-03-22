defmodule Maiden.Melanie.Eval.Judge do
  @moduledoc """
  LLM-as-judge module — quality scoring for eval observations.

  Reads NDJSON observations, constructs judge prompts, calls a cheap/fast LLM
  via ReqLLM directly (no AgentServer), backfills quality fields.
  """

  require Logger

  @judge_prompt_template """
  You are an evaluation judge. Assess the quality of an AI agent's response.

  ## User Query
  <%= query %>

  ## Tools Called
  <%= tools %>

  ## Agent's Final Answer
  <%= answer %>

  ## Instructions
  Evaluate the response on three dimensions. Return ONLY valid JSON:

  {
    "answer_addresses_query": true/false,
    "answer_cites_sources": true/false,
    "answer_quality_score": 0.0 to 1.0
  }

  - answer_addresses_query: Does the answer actually respond to what was asked?
  - answer_cites_sources: Does the answer reference specific entities, dates, or documents?
  - answer_quality_score: Overall quality (0.0 = useless, 0.5 = adequate, 1.0 = excellent)
  """

  @doc """
  Judge a list of observations, backfilling quality fields.

  ## Options

  - `:sample_rate` — fraction of observations to judge (default 0.2)
  - `:judge_all` — override sample_rate, judge everything (default false)
  - `:model` — judge model (default :fast from ReqLLM config)
  - `:concurrency` — parallel judge calls (default 3)
  """
  @spec judge([map()], keyword()) :: [map()]
  def judge(observations, opts \\ []) do
    sample_rate = Keyword.get(opts, :sample_rate, 0.2)
    judge_all = Keyword.get(opts, :judge_all, false)

    # Select observations to judge
    to_judge =
      if judge_all do
        observations
      else
        count = max(1, round(length(observations) * sample_rate))
        Enum.take_random(observations, count)
      end

    judged_ids = MapSet.new(Enum.map(to_judge, & &1["query_id"]))

    # Judge selected observations
    judged =
      to_judge
      |> Enum.map(&judge_single/1)
      |> Map.new(fn obs -> {obs["query_id"], obs} end)

    # Merge back
    Enum.map(observations, fn obs ->
      if MapSet.member?(judged_ids, obs["query_id"]) do
        Map.get(judged, obs["query_id"], obs)
      else
        obs
      end
    end)
  end

  @doc """
  Judge a single observation. Returns the observation with quality fields backfilled.
  """
  @spec judge_single(map()) :: map()
  def judge_single(obs) do
    query = obs["query_id"] || "unknown"
    answer = obs["answer_text"] || "(no answer)"
    tools = obs["tools_called"] || []

    prompt =
      @judge_prompt_template
      |> EEx.eval_string(
        query: query,
        tools: Enum.join(tools, ", "),
        answer: answer
      )

    case call_judge_llm(prompt) do
      {:ok, result} ->
        obs
        |> Map.put("answer_addresses_query", result["answer_addresses_query"])
        |> Map.put("answer_cites_sources", result["answer_cites_sources"])
        |> Map.put("answer_quality_score", result["answer_quality_score"])

      {:error, reason} ->
        Logger.warning("Judge failed for #{query}: #{inspect(reason)}")
        obs
    end
  end

  # ── Private ──────────────────────────────────────────────────────────────

  defp call_judge_llm(prompt) do
    # Use ReqLLM's stream_text! with a non-streaming single call
    # Judge uses a cheap model — :fast maps to haiku or equivalent
    messages = [%ReqLLM.Message{role: :user, content: prompt}]

    try do
      # Build a Req request with ReqLLM context
      context = ReqLLM.context(messages)

      {:ok, model} = ReqLLM.model(:fast)

      # Use non-deprecated stream_text/3
      text =
        case ReqLLM.stream_text(model, context, []) do
          {:ok, stream_resp} ->
            stream_resp
            |> Enum.to_list()
            |> Enum.join()

          {:error, reason} ->
            throw({:llm_error, reason})
        end

      # Extract JSON from response (may have markdown fencing)
      json_str =
        text
        |> String.replace(~r/```json\s*/, "")
        |> String.replace(~r/```\s*/, "")
        |> String.trim()

      Jason.decode(json_str)
    rescue
      e -> {:error, Exception.message(e)}
    end
  end
end
