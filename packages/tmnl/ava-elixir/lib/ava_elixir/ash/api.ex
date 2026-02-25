defmodule AvaElixir.Ash.Api do
  @moduledoc """
  Convenience API wrappers for the Ava Ash domain.
  """

  alias AvaElixir.Ash.Domain

  def create(changeset, opts \\ []),
    do: Ash.create(changeset, Keyword.put_new(opts, :domain, Domain))

  def read(query, opts \\ []), do: Ash.read(query, Keyword.put_new(opts, :domain, Domain))

  def get(resource, id, opts \\ []),
    do: Ash.get(resource, id, Keyword.put_new(opts, :domain, Domain))

  def update(changeset, opts \\ []),
    do: Ash.update(changeset, Keyword.put_new(opts, :domain, Domain))

  def destroy(record, opts \\ []), do: Ash.destroy(record, Keyword.put_new(opts, :domain, Domain))

  @doc """
  Builds explicit Ash job-context options from worker args.

  We always attach `context.job_context=true` so authorization intent is
  explicit at the execution boundary even when `authorize?: false` is used for
  system jobs.
  """
  @spec job_context_opts(map()) :: keyword()
  def job_context_opts(args) when is_map(args) do
    actor = Map.get(args, "actor") || Map.get(args, :actor)
    tenant = Map.get(args, "tenant") || Map.get(args, :tenant)

    authorize? =
      Map.get(args, "authorize?") ||
        Map.get(args, :authorize?) ||
        false

    context = %{
      job_context: true,
      actor_role: :system_job,
      source: Map.get(args, "source") || Map.get(args, :source) || "oban",
      worker: Map.get(args, "worker") || Map.get(args, :worker)
    }

    [context: context, authorize?: authorize?]
    |> maybe_put(:actor, actor)
    |> maybe_put(:tenant, tenant)
  end

  def job_context_opts(_), do: [context: %{job_context: true, actor_role: :system_job}, authorize?: false]

  defp maybe_put(opts, _key, nil), do: opts
  defp maybe_put(opts, key, value), do: Keyword.put(opts, key, value)
end
