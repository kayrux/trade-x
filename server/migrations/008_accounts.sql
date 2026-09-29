-- Migration 008: Investment Accounts (Phase 6 revision)
--
-- A user holds securities across multiple investment accounts (TFSA, RRSP,
-- Margin, …), and the same symbol can sit in more than one with a different cost
-- basis. So trades and holdings now hang off an `account`, not the user directly.
-- Ownership is normalized through accounts.user_id — trades/holdings no longer
-- carry a user_id of their own.
--
-- ONE-TIME RESTRUCTURE: the pre-existing trade/holdings data from 007 is
-- throwaway, so those two tables are dropped and recreated under the new shape
-- rather than backfilled. NOT safe to re-run once real trades exist — it would
-- drop them.

DROP TABLE IF EXISTS portfolio_holdings;
DROP TABLE IF EXISTS trades;

CREATE TABLE IF NOT EXISTS accounts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR NOT NULL,
    type       VARCHAR,            -- TFSA | RRSP | Margin | Cash | FHSA | … (label only)
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts (user_id, created_at);

-- Two accounts that differ only by case would be indistinguishable in the
-- selector; the route relies on this 23505 violation rather than a check-then-
-- insert race, exactly as watchlists and register do.
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_user_name_lower
    ON accounts (user_id, LOWER(name));

CREATE TABLE trades (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symbol_id  VARCHAR NOT NULL REFERENCES symbols(id)  ON DELETE CASCADE,
    side       VARCHAR NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity   DECIMAL(18,6) NOT NULL CHECK (quantity > 0),
    price      DECIMAL(18,6) NOT NULL CHECK (price >= 0),  -- per share, in `currency`
    currency   VARCHAR(3) NOT NULL,                        -- ISO 4217, e.g. USD / CAD
    traded_at  TIMESTAMPTZ NOT NULL,                       -- anchors the chart marker
    note       VARCHAR(280),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()                     -- bumped on every edit
);

-- The chart query and the holdings recompute both read
-- "all trades for this account + symbol, oldest first".
CREATE INDEX idx_trades_account_symbol ON trades (account_id, symbol_id, traded_at);

-- Maintained aggregate, one row per (account, symbol). Never written directly:
-- the /trades routes recompute it from the trade history on every mutation
-- (see server/src/lib/holdings.js). currency is copied from the account's trades
-- for the symbol so amounts can be shown without re-joining.
CREATE TABLE portfolio_holdings (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   UUID    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symbol_id    VARCHAR NOT NULL REFERENCES symbols(id)  ON DELETE CASCADE,
    quantity     DECIMAL(18,6) NOT NULL DEFAULT 0,   -- net open shares (buys - sells)
    avg_cost     DECIMAL(18,6),                      -- average cost of open shares; NULL when flat
    realized_pnl DECIMAL(18,6) NOT NULL DEFAULT 0,   -- lifetime realized gain/loss (avg-cost method)
    currency     VARCHAR(3),
    updated_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE (account_id, symbol_id)
);
