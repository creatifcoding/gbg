# AVA Projection Tuning Notes

Task: #2788

This note captures the index tuning added for `ava_projections` to support common read paths.

## Added indexes

1. **Replay scan / high-watermark reads**
   - Index: `ava_projections_source_pos_desc_idx`
   - Definition: `(source_global_position DESC)`
   - Target query pattern:
     ```sql
     SELECT *
     FROM ava_projections
     ORDER BY source_global_position DESC
     LIMIT $1;
     ```
   - Why: speeds reverse-ordered scans used for replay windows and latest-position inspection.

2. **Latest snapshot per view + projection type**
   - Index: `ava_projections_view_type_source_pos_desc_idx`
   - Definition: `(view_id, projection_type, source_global_position DESC)`
   - Target query pattern:
     ```sql
     SELECT *
     FROM ava_projections
     WHERE view_id = $1 AND projection_type = $2
     ORDER BY source_global_position DESC
     LIMIT 1;
     ```
   - Why: enables index-ordered lookup for "latest row for key" queries without extra sorting.

3. **Recency dashboards / recently updated views**
   - Index: `ava_projections_updated_at_desc_idx`
   - Definition: `(updated_at DESC)`
   - Target query pattern:
     ```sql
     SELECT view_id, projection_type, updated_at
     FROM ava_projections
     ORDER BY updated_at DESC
     LIMIT $1;
     ```
   - Why: supports recency-first dashboards and operational health panels.

## Notes

- Existing uniqueness constraint (`view_id`, `projection_type`) is unchanged.
- These indexes are additive and focused on read-heavy operational paths.
