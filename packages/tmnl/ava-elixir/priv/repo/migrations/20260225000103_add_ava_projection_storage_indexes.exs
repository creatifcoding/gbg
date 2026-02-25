defmodule AvaElixir.Repo.Migrations.AddAvaProjectionStorageIndexes do
  use Ecto.Migration

  def change do
    create index(:ava_projections, [desc: :source_global_position],
             name: :ava_projections_source_pos_desc_idx
           )

    create index(:ava_projections, [:view_id, :projection_type, desc: :source_global_position],
             name: :ava_projections_view_type_source_pos_desc_idx
           )

    create index(:ava_projections, [desc: :updated_at],
             name: :ava_projections_updated_at_desc_idx
           )
  end
end
