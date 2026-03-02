-- Raw 15-minute prices (source of truth, as provided by Elering API)
CREATE TABLE IF NOT EXISTS prices (
  timestamp INTEGER PRIMARY KEY,   -- Unix timestamp (15-min boundary)
  price_eur_mwh REAL NOT NULL,     -- Original €/MWh from Elering
  price_cents_kwh REAL NOT NULL    -- Converted ¢/kWh (= eur_mwh / 10)
);

-- Hourly averages (computed from 15-min data, 4 data points per hour)
CREATE TABLE IF NOT EXISTS hourly_averages (
  timestamp INTEGER PRIMARY KEY,   -- Unix timestamp (hour boundary)
  avg_price REAL NOT NULL,         -- Average ¢/kWh for the hour
  min_price REAL NOT NULL,
  max_price REAL NOT NULL,
  data_points INTEGER NOT NULL     -- Should be 4 (four 15-min slots)
);

-- Daily aggregates
CREATE TABLE IF NOT EXISTS daily_averages (
  date TEXT PRIMARY KEY,           -- 'YYYY-MM-DD'
  avg_price REAL NOT NULL,         -- Average ¢/kWh for the day
  min_price REAL NOT NULL,
  max_price REAL NOT NULL,
  data_points INTEGER NOT NULL     -- Should be 96 (96 × 15-min slots)
);

-- Weekly aggregates
CREATE TABLE IF NOT EXISTS weekly_averages (
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,           -- ISO week number (1–53)
  avg_price REAL NOT NULL,
  min_price REAL NOT NULL,
  max_price REAL NOT NULL,
  data_points INTEGER NOT NULL,
  PRIMARY KEY (year, week)
);

-- Monthly aggregates
CREATE TABLE IF NOT EXISTS monthly_averages (
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,          -- 1–12
  avg_price REAL NOT NULL,
  min_price REAL NOT NULL,
  max_price REAL NOT NULL,
  data_points INTEGER NOT NULL,
  PRIMARY KEY (year, month)
);

-- Weekday-hour averages scoped to year+month (for pattern heatmap)
-- Per month: 7 weekdays × 24 hours = 168 rows
-- Query single month for monthly heatmap, or aggregate months for quarterly view
CREATE TABLE IF NOT EXISTS weekday_hour_averages (
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,          -- 1–12
  weekday INTEGER NOT NULL,        -- 0=Monday, 6=Sunday (ISO)
  hour INTEGER NOT NULL,           -- 0–23
  avg_price REAL NOT NULL,
  sample_count INTEGER NOT NULL,   -- How many 15-min slots contributed
  PRIMARY KEY (year, month, weekday, hour)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_prices_timestamp ON prices(timestamp);
CREATE INDEX IF NOT EXISTS idx_hourly_timestamp ON hourly_averages(timestamp);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_averages(date);
CREATE INDEX IF NOT EXISTS idx_weekday_hour_period ON weekday_hour_averages(year, month);
