defmodule Maiden.SiteRuntime.SiteFactory do
  @moduledoc """
  Constructor helpers for site payloads in Elixir tests.
  """

  alias Maiden.SiteRuntime.SiteId

  @spec new_site(keyword()) :: map()
  def new_site(opts) do
    slug = Keyword.fetch!(opts, :slug)

    %{
      "site_id" => SiteId.make(slug),
      "name" => Keyword.get(opts, :name, "Site #{slug}"),
      "status" => Keyword.get(opts, :status, "planned"),
      "timezone" => Keyword.get(opts, :timezone, "UTC"),
      "address" => Keyword.get(opts, :address),
      "city" => Keyword.get(opts, :city),
      "state" => Keyword.get(opts, :state),
      "country" => Keyword.get(opts, :country),
      "postal_code" => Keyword.get(opts, :postal_code),
      "description" => Keyword.get(opts, :description),
      "location" => Keyword.get(opts, :location),
      "metadata" => Keyword.get(opts, :metadata, %{}),
      "hierarchy_path" =>
        Keyword.get(opts, :hierarchy_path, "/ENT-demo/#{SiteId.make(slug)}"),
      "enterprise_id" => Keyword.get(opts, :enterprise_id, "ENT-demo"),
      "created_at" => Keyword.get(opts, :created_at, "2026-02-24T00:00:00Z"),
      "updated_at" => Keyword.get(opts, :updated_at)
    }
  end

  @spec new_transition_event(keyword()) :: map()
  def new_transition_event(opts) do
    slug = Keyword.fetch!(opts, :slug)

    %{
      "site_id" => SiteId.make(slug),
      "from" => Keyword.fetch!(opts, :from),
      "to" => Keyword.fetch!(opts, :to),
      "action" => Keyword.get(opts, :action),
      "at" => Keyword.get(opts, :at, "2026-02-24T00:00:00Z"),
      "reason" => Keyword.get(opts, :reason),
      "initiated_by" => Keyword.get(opts, :initiated_by)
    }
  end
end
