-- Migration 009: Portfolio value history (Phase 6)
--
-- Caches one market-value snapshot per (account, day) so the Portfolio and
-- Account Details charts can plot value over time without recomputing the whole
-- history on every load.
--
-- HOW IT'S FILLED: lazily, on read. A history request finds the past trading
-- days it's missing, computes them from trades + symbol_candles closes, and
-- inserts them (see server/src/lib/portfolioValue.js). Past days are immutable
-- once the session has closed, so once stored they're just fetched. TODAY is
-- never stored here — it's recomputed live from symbol_quotes on every read,
-- since it keeps moving.
--
-- CACHE INVALIDATION: a trade mutation can change history retroactively (an
-- edited quantity/date, a deleted buy), so the /trades routes clear this
-- account's cached rows on every mutation; the missing days recompute on the
-- next read.
--
-- Re-runnable.

CREATE TABLE IF NOT EXISTS portfolio_value_daily (
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date       DATE NOT NULL,
    value      DECIMAL(18,2) NOT NULL,   -- market value of open positions at that day's close
    PRIMARY KEY (account_id, date)
);
