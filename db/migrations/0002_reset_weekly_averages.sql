-- weekly_averages switched from SQLite %W keys to ISO 8601 year/week (see db/schema.sql).
-- Old keys such as (2024, 53) or (2025, 0) have no ISO equivalent and would never be
-- overwritten, and the rest would be read one week off. Applied by `npm run deploy`
-- after the new code is live; then rebuild every stored month:
--   SYNC_SECRET=... npm run recompute -- --url https://your-domain.com
DELETE FROM weekly_averages;
