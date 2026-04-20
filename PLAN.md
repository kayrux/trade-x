# Market Data Dashboard — Project README

> **Note:** This is a living document. Update it as architectural decisions are made and the project progresses.

---

## Overview

A personal full-stack portfolio project that pulls financial market data from Finnhub and EODHD and serves it via a React frontend. The primary goal is to demonstrate full-stack and data pipeline skills to recruiters.

---

## Data Sources

- **Finnhub** — Free / Personal tier. Rate limit: 60 calls/min. Used for symbol list sync and live quotes. Personal use only — no redistribution, no commercial use.
- **EODHD** — Used for historical OHLCV candle data (EOD and intraday). Data must be deleted if subscription ends.

---

## Architecture Overview

```
EODHD API  (historical OHLCV)       Finnhub API  (live quotes + symbol list)
    ↓ (on-demand cache)                    ↓ (scheduled sync jobs)
Backend (Node/Express)
    ├── Candle routes                ← Phase 2
    ├── Symbol & quote routes        ← Phase 1
    ├── Watchlist & portfolio routes ← Phase 3
    └── JWT auth middleware          ← Phase 4
    ↓
Postgres Database
    ├── symbols                      ← Phase 1
    ├── symbol_quotes                ← Phase 1
    ├── symbol_candles               ← Phase 2
    ├── symbol_candle_meta           ← Phase 2
    ├── watchlists / watchlist_symbols ← Phase 3
    ├── portfolio_holdings           ← Phase 3
    └── users                        ← Phase 4
    ↓
REST API
    ↓
React Frontend
    ├── Symbol lookup & live price   ← Phase 1
    ├── Historical OHLCV charts      ← Phase 2
    ├── Watchlist & portfolio views  ← Phase 3
    └── Auth (login/register)        ← Phase 4
```

---

## Key Architectural Decisions

| Decision           | Choice                                | Reason                                                                                               |
| ------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Live data source   | Finnhub free tier                     | Sufficient for personal/portfolio use                                                                |
| Historical data    | EODHD API                             | Provides EOD and intraday (1h) candles with adjusted close                                           |
| Local data caching | Postgres                              | Avoids burning API rate limits on every frontend request                                             |
| Symbol search      | Postgres `LIKE 'AAP%'` + B-tree index | Prefix-only search, no fuzzy needed — Postgres handles this efficiently without extra infrastructure |
| Candle sync        | On-demand caching                     | EODHD rate limits make bulk pre-sync of 10k symbols impractical; most symbols never viewed          |
| Cache layer        | None (no Redis)                       | Symbol list is small (~10k rows), Postgres is fast enough                                            |
| Chart library      | TradingView Lightweight Charts        | Performant, framework-agnostic, purpose-built for financial charts                                   |
| Redistribution     | None                                  | Keeps project within Finnhub and EODHD personal ToS                                                 |

---

## Features Planned

Features are ordered by priority. Complete each phase before moving to the next.

### Phase 1 — Core (Complete)

- [x] Sync pipeline for US exchange symbols
- [x] Scheduled background jobs for quote refresh
- [x] Symbol lookup (prefix search)
- [x] Last traded price display

### Phase 2 — Historical Charts (Current Focus)

- [ ] `symbol_candles` + `symbol_candle_meta` DB tables
- [ ] On-demand OHLCV sync from EODHD (daily + 1h resolutions)
- [ ] `GET /candles/:symbol?resolution=daily|1h` backend route
- [ ] TradingView Lightweight Charts integration
- [ ] Resolution switcher (1h / daily)

### Phase 3 — Watchlists & Portfolios

- [ ] Portfolio holdings (quantity, average cost)
- [ ] Watchlist creation and management
- [ ] Public share links for watchlists and portfolios (read-only)

### Phase 4 — Accounts

- [ ] User registration and login (JWT auth)
- [ ] User-owned watchlists and portfolios
- [ ] Public profile / share pages (`/share/watchlist/:id`)

---

## Database Schema

### Phase 1 — Core Tables

#### `symbols` table

Synced in bulk from the Finnhub exchange endpoint. Updated daily.

```sql
CREATE TABLE symbols (
    id          VARCHAR PRIMARY KEY,  -- Finnhub unique key
    symbol      VARCHAR NOT NULL,     -- e.g. AAPL
    name        VARCHAR,              -- e.g. Apple Inc.
    exchange    VARCHAR,              -- e.g. NASDAQ
    created_at  TIMESTAMP DEFAULT NOW()
);
```

#### `symbol_quotes` table

One-to-one with `symbols`. Synced per-symbol on a separate, more frequent schedule.

```sql
CREATE TABLE symbol_quotes (
    symbol_id   VARCHAR PRIMARY KEY REFERENCES symbols(id),
    last_price  DECIMAL,
    open        DECIMAL,
    high        DECIMAL,
    low         DECIMAL,
    volume      BIGINT,
    synced_at   TIMESTAMP
);
```

> **Why two tables?** Different sync frequencies, avoids sparse NULL columns, and keeps queries clean.

---

### Phase 2 — Historical Candle Tables

#### `symbol_candles` table

Stores OHLCV candle data for all supported resolutions. Populated on-demand when a user views a symbol.

EODHD response fields:
- EOD (`fmt=json`): `date` (YYYY-MM-DD), `open`, `high`, `low`, `close`, `adjusted_close`, `volume`
- Intraday (`fmt=json`): `datetime` (ISO string), `open`, `high`, `low`, `close`, `volume`

```sql
CREATE TABLE symbol_candles (
    id             BIGSERIAL     PRIMARY KEY,
    symbol_id      VARCHAR       NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    resolution     VARCHAR(10)   NOT NULL,    -- '1h' | 'daily' | 'weekly' | 'monthly'
    ts             TIMESTAMPTZ   NOT NULL,    -- candle open time, UTC
    open           DECIMAL(18,6) NOT NULL,
    high           DECIMAL(18,6) NOT NULL,
    low            DECIMAL(18,6) NOT NULL,
    close          DECIMAL(18,6) NOT NULL,
    adjusted_close DECIMAL(18,6),             -- EOD only; NULL for intraday resolutions
    volume         BIGINT        NOT NULL DEFAULT 0,
    synced_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT symbol_candles_resolution_check
        CHECK (resolution IN ('1h', 'daily', 'weekly', 'monthly')),
    CONSTRAINT symbol_candles_unique
        UNIQUE (symbol_id, resolution, ts)
);

-- Primary query index: fetch a symbol's candles in a time range
CREATE INDEX idx_symbol_candles_lookup
    ON symbol_candles (symbol_id, resolution, ts DESC);
```

**Normalization notes:**
- Daily candles: parse `date` (YYYY-MM-DD) → store as `YYYY-MM-DD 00:00:00+00`
- 1h candles: parse `datetime` ISO string → store as UTC timestamptz
- `adjusted_close` is NULL for `1h` resolution (not provided by EODHD intraday endpoint)
- Retention: daily = 5 years back, 1h = 120 days (EODHD intraday hard limit)

#### `symbol_candle_meta` table

Tracks freshness per (symbol, resolution) — avoids `MAX(ts)` scans on every page view.

```sql
CREATE TABLE symbol_candle_meta (
    symbol_id    VARCHAR     NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    resolution   VARCHAR(10) NOT NULL,
    first_ts     TIMESTAMPTZ,
    last_ts      TIMESTAMPTZ,
    fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (symbol_id, resolution)
);
```

**Staleness thresholds:** 24h for `daily`/`weekly`/`monthly`; 2h for `1h`.

---

### Phase 4 — User, Watchlist & Portfolio Tables

```sql
-- Users
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR UNIQUE NOT NULL,
    username    VARCHAR UNIQUE NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Watchlists (a user can have many)
CREATE TABLE watchlists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    name        VARCHAR NOT NULL,
    is_public   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Watchlist items
CREATE TABLE watchlist_symbols (
    watchlist_id    UUID REFERENCES watchlists(id),
    symbol_id       VARCHAR REFERENCES symbols(id),
    added_at        TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (watchlist_id, symbol_id)
);

-- Portfolio holdings
CREATE TABLE portfolio_holdings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    symbol_id   VARCHAR REFERENCES symbols(id),
    quantity    DECIMAL NOT NULL,
    avg_cost    DECIMAL,
    added_at    TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

### Phase 1

| Method | Path | Description |
|--------|------|-------------|
| GET | `/symbols?q=AAP` | Prefix search, returns up to 20 symbols |
| GET | `/symbols/:symbol` | Exact match with live quote data |

### Phase 2

| Method | Path | Description |
|--------|------|-------------|
| GET | `/candles/:symbol?resolution=daily&from=YYYY-MM-DD&to=YYYY-MM-DD` | Historical OHLCV candles |

Query params: `resolution` (`daily`\|`1h`, default `daily`), `from` (optional), `to` (optional).

Response: `{ symbol, resolution, candles: [{ ts, open, high, low, close, adjusted_close, volume }] }`

---

## EODHD Endpoints (Phase 2)

| Data | Endpoint | Sync Frequency |
|------|----------|----------------|
| Daily OHLCV | `GET /api/eod/{SYMBOL}.US?api_token=...&from=YYYY-MM-DD&fmt=json` | On-demand, cached 24h |
| 1h intraday | `GET /api/intraday/{SYMBOL}.US?interval=1h&api_token=...&fmt=json` | On-demand, cached 2h |

---

## Finnhub Endpoints (Phase 1)

| Data | Endpoint | Sync Frequency |
| ---- | -------- | -------------- |
| US Symbol list | `GET /stock/symbol?exchange=US` | Daily |
| Quote / last price | `GET /quote?symbol=AAPL` | Every few minutes |

---

## ToS Notes

- Finnhub: Personal use only — no redistribution, no commercial use. Data must be deleted if subscription ends.
- EODHD: Personal use only. Same deletion requirement applies.
- Phase 3 sharing features (public watchlists, portfolios) are likely fine for a portfolio project but would require commercial agreements if the app ever goes public.

---

## Notes

- This project is intentionally scoped for a portfolio — avoid over-engineering
- A clear README and architecture diagram will be valuable for recruiter visibility
- A live deployment link on a resume significantly increases impact
