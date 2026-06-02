-- Migration 001: Historical candle backfill infrastructure
-- Run once against your Postgres database.
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE / ON CONFLICT.

-- ─────────────────────────────────────────────────
-- 1. Add source column to symbol_candles
--    Existing EODHD rows get source='eodhd' via the DEFAULT.
-- ─────────────────────────────────────────────────
ALTER TABLE symbol_candles
    ADD COLUMN IF NOT EXISTS source VARCHAR NOT NULL DEFAULT 'eodhd';


-- ─────────────────────────────────────────────────
-- 2. Create candle_coverage tracking table
--    One row per symbol; drives the gap-fill algorithm.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candle_coverage (
    symbol_id       VARCHAR     PRIMARY KEY REFERENCES symbols(id),
    earliest_ts     TIMESTAMPTZ,
    latest_ts       TIMESTAMPTZ,
    target_start    TIMESTAMPTZ NOT NULL DEFAULT NOW() - INTERVAL '10 years',
    backfill_done   BOOLEAN     NOT NULL DEFAULT FALSE,
    last_checked_at TIMESTAMPTZ
);


-- ─────────────────────────────────────────────────
-- 3. Seed candle_coverage from existing daily rows
--    All current EODHD data is ~1 year old, so
--    backfill_done = FALSE for every existing symbol,
--    meaning Case B fires on each symbol's next view.
-- ─────────────────────────────────────────────────
INSERT INTO candle_coverage (symbol_id, earliest_ts, latest_ts, target_start, backfill_done, last_checked_at)
SELECT
    symbol_id,
    MIN(ts),
    MAX(ts),
    NOW() - INTERVAL '10 years',
    (MAX(ts) - MIN(ts)) >= INTERVAL '2 years',
    NOW()
FROM symbol_candles
WHERE resolution = 'daily'
GROUP BY symbol_id
ON CONFLICT (symbol_id) DO UPDATE
    SET earliest_ts   = EXCLUDED.earliest_ts,
        latest_ts     = EXCLUDED.latest_ts,
        backfill_done = EXCLUDED.backfill_done;


-- ─────────────────────────────────────────────────
-- 4. Remove stored weekly/monthly rows
--    These are replaced by derived views below.
-- ─────────────────────────────────────────────────
DELETE FROM symbol_candle_meta WHERE resolution IN ('weekly', 'monthly');
DELETE FROM symbol_candles      WHERE resolution IN ('weekly', 'monthly');


-- ─────────────────────────────────────────────────
-- 5. Tighten the resolution CHECK to daily-only storage
--    (weekly/monthly are now views, not rows)
-- ─────────────────────────────────────────────────
ALTER TABLE symbol_candles DROP CONSTRAINT IF EXISTS symbol_candles_resolution_check;
ALTER TABLE symbol_candles
    ADD CONSTRAINT symbol_candles_resolution_check
    CHECK (resolution IN ('daily', '1h'));


-- ─────────────────────────────────────────────────
-- 6. Derived weekly view
--    open  = first daily open of the week
--    close = last daily close of the week
--    high  = max high across the week
--    low   = min low across the week
--    volume = sum of daily volumes
-- ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW symbol_candles_weekly AS
SELECT
    symbol_id,
    'weekly'                                                                           AS resolution,
    date_trunc('week', ts)                                                             AS ts,
    (ARRAY_AGG(open          ORDER BY ts ASC ))[1]                                    AS open,
    MAX(high)                                                                          AS high,
    MIN(low)                                                                           AS low,
    (ARRAY_AGG(close         ORDER BY ts DESC))[1]                                    AS close,
    (ARRAY_AGG(adjusted_close ORDER BY ts DESC) FILTER (WHERE adjusted_close IS NOT NULL))[1]
                                                                                       AS adjusted_close,
    SUM(volume)                                                                        AS volume
FROM symbol_candles
WHERE resolution = 'daily'
GROUP BY symbol_id, date_trunc('week', ts);


-- ─────────────────────────────────────────────────
-- 7. Derived monthly view
-- ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW symbol_candles_monthly AS
SELECT
    symbol_id,
    'monthly'                                                                          AS resolution,
    date_trunc('month', ts)                                                            AS ts,
    (ARRAY_AGG(open          ORDER BY ts ASC ))[1]                                    AS open,
    MAX(high)                                                                          AS high,
    MIN(low)                                                                           AS low,
    (ARRAY_AGG(close         ORDER BY ts DESC))[1]                                    AS close,
    (ARRAY_AGG(adjusted_close ORDER BY ts DESC) FILTER (WHERE adjusted_close IS NOT NULL))[1]
                                                                                       AS adjusted_close,
    SUM(volume)                                                                        AS volume
FROM symbol_candles
WHERE resolution = 'daily'
GROUP BY symbol_id, date_trunc('month', ts);
