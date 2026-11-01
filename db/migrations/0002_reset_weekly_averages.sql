-- weekly_averages switched from SQLite %W keys to ISO 8601 year/week (see db/schema.sql).
-- Old keys such as (2024, 53) or (2025, 0) have no ISO equivalent and would never be
-- overwritten, and the rest would be read one week off. Run once, then rebuild every
-- stored month with POST /api/sync/recompute?month=YYYY-MM (README: "Recompute
-- aggregates without refetching"):
--   npx wrangler d1 execute electricity-prices --remote --file=db/migrations/0002_reset_weekly_averages.sql
DELETE FROM weekly_averages;
