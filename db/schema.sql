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
  data_points INTEGER NOT NULL     -- Hourly averages in the Tallinn day (24; 23/25 on DST days)
);

-- Weekly aggregates
CREATE TABLE IF NOT EXISTS weekly_averages (
  year INTEGER NOT NULL,           -- ISO 8601 week-numbering year (strftime('%G'))
  week INTEGER NOT NULL,           -- ISO 8601 week, Monday-based (strftime('%V'), 1–53)
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
  sample_count INTEGER NOT NULL,   -- How many hourly averages contributed
  PRIMARY KEY (year, month, weekday, hour)
);

-- No extra indexes: every query is served by a table's primary key (INTEGER PRIMARY
-- KEY is the rowid; composite keys cover their leading columns). D1 counts each index
-- update as another row written, which counts against the Workers Free daily limit.
