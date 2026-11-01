-- Drops indexes that duplicated primary keys (see db/schema.sql). Each one doubled
-- the rows written per insert, which D1 bills against the Workers Free daily limit.
-- Applied by `npm run deploy` (wrangler d1 migrations apply).
DROP INDEX IF EXISTS idx_prices_timestamp;
DROP INDEX IF EXISTS idx_hourly_timestamp;
DROP INDEX IF EXISTS idx_daily_date;
DROP INDEX IF EXISTS idx_weekday_hour_period;
