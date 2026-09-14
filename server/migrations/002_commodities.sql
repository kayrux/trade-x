-- Migration 002: Seed synthetic commodity symbols (Alpha Vantage sourced).
-- Run once against your Postgres database.  Safe to re-run: ON CONFLICT DO NOTHING.
--
-- These are namespaced with an "AV:" prefix so they never collide with real
-- Finnhub equity tickers already in `symbols` — e.g. WTI (W&T Offshore) and
-- GOLD (Barrick Gold) are live NYSE symbols.  Their daily prices are pulled from
-- Alpha Vantage by server/src/jobs/syncCommodities.js and stored in
-- symbol_candles as flat OHLC (open=high=low=close=value), source='alphavantage'.

INSERT INTO symbols (id, symbol, name, exchange) VALUES
  ('AV:WTI',    'AV:WTI',    'Crude Oil (WTI)',   'COMMODITY'),
  ('AV:BRENT',  'AV:BRENT',  'Crude Oil (Brent)', 'COMMODITY'),
  ('AV:GOLD',   'AV:GOLD',   'Gold (Spot)',       'COMMODITY'),
  ('AV:SILVER', 'AV:SILVER', 'Silver (Spot)',     'COMMODITY')
ON CONFLICT (id) DO NOTHING;
