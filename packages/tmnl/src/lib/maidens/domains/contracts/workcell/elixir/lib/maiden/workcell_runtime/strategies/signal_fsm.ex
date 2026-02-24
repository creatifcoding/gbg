defmodule Maiden.WorkcellRuntime.Strategies.SignalFsm do
  @moduledoc """
  Signal-first runtime strategy for WorkCell transitions.

  Delegates transition execution to `Jido.Agent.Strategy.FSM` and emits
  boundary directives for persistence / deferred job orchestration.
  """

  use Jido.Agent.Strategy

  alias Jido.Agent
  alias Jido.Agent.Strategy.FSM
  alias Jido.Instruction
  alias Maiden.WorkcellRuntime.Directives.{EnqueueTransitionJob, PersistTransition}

  @instruction_result_action :fsm_instruction_result

  @impl true
  def init(agent, ctx), do: FSM.init(agent, ctx)

  @impl true
  def cmd(%Agent{} = agent, [%Instruction{action: :flush_persistence}], _ctx) do
    {agent, []}
  end

  @impl true
  def cmd(
        %Agent{} = agent,
        [%Instruction{action: @instruction_result_action, params: payload} = instruction],
        ctx
      )
      when is_map(payload) do
    {next_agent, directives} = FSM.cmd(agent, [instruction], ctx)
    bridge_directives = build_boundary_directives(next_agent, payload, ctx)
    {next_agent, directives ++ bridge_directives}
  end

  @impl true
  def cmd(%Agent{} = agent, instructions, ctx), do: FSM.cmd(agent, instructions, ctx)

  @impl true
  def tick(agent, ctx), do: FSM.tick(agent, ctx)

  @impl true
  def snapshot(agent, ctx), do: FSM.snapshot(agent, ctx)

  @impl true
  def action_spec(:flush_persistence), do: %{name: "flush_persistence", schema: []}

  def action_spec(_), do: nil

  @impl true
  def signal_routes(_ctx) do
    [
      {"workcell.runtime.strategy.tick", {:strategy_tick}, 90},
      {"workcell.runtime.persist.flush", {:strategy_cmd, :flush_persistence}, 85}
    ]
  end

  defp build_boundary_directives(agent, payload, ctx) do
    opts = ctx[:strategy_opts] || []

    with :ok <- successful_transition_result?(payload),
         {:ok, event} <- transition_event(payload, agent) do
      metadata = transition_metadata(payload)

      []
      |> maybe_add_persist_directive(event, metadata, opts)
      |> maybe_add_job_directive(event, opts)
    else
      _ -> []
    end
  end

  defp successful_transition_result?(payload) do
    status = fetch(payload, :status)

    if status in [:ok, "ok"] do
      :ok
    else
      :error
    end
  end

  defp transition_event(payload, agent) do
    instruction = fetch(payload, :instruction)

    params =
      case instruction do
        %Instruction{params: params} when is_map(params) -> params
        %{params: params} when is_map(params) -> params
        _ -> %{}
      end

    from = fetch(params, :from)
    to = fetch(params, :to)
    at = fetch(params, :at)

    cond do
      not is_binary(from) or not is_binary(to) or not is_binary(at) ->
        {:error, :missing_transition_keys}

      true ->
        {:ok,
         %{
           workcell_id: fetch(params, :workcell_id) || agent.state[:workcell_id],
           from: from,
           to: to,
           at: at,
           reason: fetch(params, :reason),
           initiated_by: fetch(params, :initiated_by)
         }}
    end
  end

  defp transition_metadata(payload) do
    %{
      strategy: __MODULE__,
      observed_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      trace_id: fetch(fetch(payload, :meta) || %{}, :trace_id),
      instruction_meta: fetch(payload, :meta) || %{}
    }
  end

  defp maybe_add_persist_directive(directives, event, metadata, opts) do
    if Keyword.get(opts, :bridge_persistence?, true) do
      directives ++ [%PersistTransition{event: event, metadata: metadata}]
    else
      directives
    end
  end

  defp maybe_add_job_directive(directives, event, opts) do
    if Keyword.get(opts, :bridge_jobs?, true) do
      directives ++
        [
          %EnqueueTransitionJob{
            event: event,
            opts: [queue: Keyword.get(opts, :job_queue, :workcell_runtime_transition)]
          }
        ]
    else
      directives
    end
  end

  defp fetch(map, key) when is_map(map) do
    Map.get(map, key) || Map.get(map, Atom.to_string(key))
  end
end
