-- Migration 007: Trades & Holdings (Phase 6)
-- Run once against your Postgres database.  Safe to re-run: uses IF NOT EXISTS.
--
-- Trades are per-user, dated buy/sell executions.  Each trade both anchors a
-- marker on that symbol's chart and rolls up into portfolio_holdings, which is a
-- maintained aggregate: the /trades routes recompute the affected (user, symbol)
-- holding from the full trade history on every insert/edit/delete, inside the
-- same transaction (see server/src/lib/holdings.js).  Both tables reach their
-- owner via user_id, exactly like watchlists in 006.

CREATE TABLE IF NOT EXISTS trades (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID    NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    symbol_id  VARCHAR NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    side       VARCHAR NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity   DECIMAL(18,6) NOT NULL CHECK (quantity > 0),
    price      DECIMAL(18,6) NOT NULL CHECK (price >= 0),  -- per share, in the symbol's currency
    traded_at  TIMESTAMPTZ   NOT NULL,                     -- when the fill happened; anchors the marker
    note       VARCHAR(280),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()                     -- bumped on every edit (fat-finger fixes)
);

-- The chart query and the holdings recompute both read
-- "all my trades for this symbol, oldest first".
CREATE INDEX IF NOT EXISTS idx_trades_user_symbol
    ON trades (user_id, symbol_id, traded_at);

-- Maintained aggregate: one row per (user, symbol), rewritten from the trade
-- history on every trade mutation.  Delivers Phase 5's portfolio_holdings, with
-- realized_pnl + updated_at added and a unique key so the recompute can UPSERT.
CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID    NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    symbol_id    VARCHAR NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    quantity     DECIMAL(18,6) NOT NULL DEFAULT 0,   -- net open shares (buys - sells)
    avg_cost     DECIMAL(18,6),                      -- average cost of the open shares; NULL when flat
    realized_pnl DECIMAL(18,6) NOT NULL DEFAULT 0,   -- lifetime realized gain/loss (avg-cost method)
    updated_at   TIMESTAMP DEFAULT NOW(),
    -- The unique index this constraint creates is on (user_id, symbol_id); its
    -- leading column already serves GET /holdings' `WHERE user_id = $1`, so no
    -- separate user_id index is needed.
    UNIQUE (user_id, symbol_id)
);
