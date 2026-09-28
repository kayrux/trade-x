-- Migration 006: Watchlists (Phase 5)
-- Run once against your Postgres database.  Safe to re-run: uses IF NOT EXISTS.
--
-- Watchlists are per-user: every row is owned via watchlists.user_id, and
-- watchlist_symbols reaches its owner by joining up through watchlists.  There
-- is no anonymous/ownerless watchlist — the /watchlists routes all require auth.

CREATE TABLE IF NOT EXISTS watchlists (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR NOT NULL,
    is_public  BOOLEAN NOT NULL DEFAULT FALSE,  -- reserved for the Phase 5 share links
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user ON watchlists (user_id, created_at);

-- Two lists that differ only by case would be indistinguishable in the sidebar.
-- The route relies on the 23505 violation from this index rather than a
-- check-then-insert race, exactly as the register route does.
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlists_user_name_lower
    ON watchlists (user_id, LOWER(name));

-- position is the drag-and-drop display order (0-based).  Gaps are tolerated:
-- a remove leaves a hole, and the next reorder rewrites the whole list anyway.
-- Deliberately NOT unique per watchlist — the reorder statement renumbers
-- several rows at once and a unique constraint would trip mid-statement.
CREATE TABLE IF NOT EXISTS watchlist_symbols (
    watchlist_id UUID    NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    symbol_id    VARCHAR NOT NULL REFERENCES symbols(id)    ON DELETE CASCADE,
    position     INTEGER NOT NULL,
    added_at     TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (watchlist_id, symbol_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_symbols_order
    ON watchlist_symbols (watchlist_id, position);
