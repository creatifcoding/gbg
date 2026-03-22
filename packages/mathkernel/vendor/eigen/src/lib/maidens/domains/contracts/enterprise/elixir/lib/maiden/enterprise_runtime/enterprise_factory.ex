defmodule Maiden.EnterpriseRuntime.EnterpriseFactory do
  @moduledoc """
  Shared enterprise payload constructors for runtime tests and adapters.
  """

  alias Maiden.EnterpriseRuntime.EnterpriseId

  @spec new_enterprise(map() | keyword()) :: map()
  def new_enterprise(attrs \\ %{}) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "acme-corp")
    enterprise_id = Map.get(attrs, :enterprise_id) || EnterpriseId.make(slug)

    %{
      enterprise_id: enterprise_id,
      name: Map.get(attrs, :name, "ACME Corporation"),
      status: Map.get(attrs, :status, "active"),
      industry: Map.get(attrs, :industry, nil),
      legal_name: Map.get(attrs, :legal_name, nil),
      tax_id: Map.get(attrs, :tax_id, nil),
      headquarters: Map.get(attrs, :headquarters, nil),
      description: Map.get(attrs, :description, nil),
      metadata: Map.get(attrs, :metadata, %{}),
      hierarchy_path: Map.get(attrs, :hierarchy_path, "/#{enterprise_id}"),
      created_at: Map.get(attrs, :created_at, DateTime.utc_now() |> DateTime.to_iso8601()),
      updated_at: Map.get(attrs, :updated_at, nil)
    }
  end

  @spec new_transition_event(map() | keyword()) :: map()
  def new_transition_event(attrs) do
    attrs = normalize_attrs(attrs)

    slug = Map.get(attrs, :slug, "acme-corp")

    %{
      enterprise_id: Map.get(attrs, :enterprise_id) || EnterpriseId.make(slug),
      from: Map.fetch!(attrs, :from),
      to: Map.fetch!(attrs, :to),
      at: Map.fetch!(attrs, :at),
      reason: Map.get(attrs, :reason, nil)
    }
  end

  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)
  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
end
