defmodule AvaElixir.Ash.Api do
  @moduledoc """
  Convenience API wrappers for the Ava Ash domain.
  """

  alias AvaElixir.Ash.Domain

  def create(changeset, opts \\ []), do: Ash.create(changeset, Keyword.put_new(opts, :domain, Domain))
  def read(query, opts \\ []), do: Ash.read(query, Keyword.put_new(opts, :domain, Domain))
  def get(resource, id, opts \\ []), do: Ash.get(resource, id, Keyword.put_new(opts, :domain, Domain))
  def update(changeset, opts \\ []), do: Ash.update(changeset, Keyword.put_new(opts, :domain, Domain))
  def destroy(record, opts \\ []), do: Ash.destroy(record, Keyword.put_new(opts, :domain, Domain))
end
