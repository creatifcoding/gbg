defmodule AvaElixir.Repo.Migrations.CreateAvaProjections do
  use Ecto.Migration

  def change do
    create table(:ava_projections, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :view_id, :text, null: false
      add :projection_type, :text, null: false
      add :payload, :map, null: false, default: %{}
      add :checksum, :text, null: false
      add :source_global_position, :bigint, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:ava_projections, [:view_id, :projection_type],
             name: :ava_projections_unique_view_projection_type
           )
  end
end
