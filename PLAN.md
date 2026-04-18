# Market Data Dashboard — Project README

> **Note:** This is a living document. Update it as architectural decisions are made and the project progresses.

---

## Overview

A personal full-stack portfolio project that pulls financial market data from Finnhub and serves it via a React frontend. The primary goal is to demonstrate full-stack and data pipeline skills to recruiters.

---

## Data Source

- **Provider:** [Finnhub](https://finnhub.io)
- **Plan:** Free / Personal tier
- **Rate Limit:** 60 API calls/minute
- **ToS Compliance:** Personal use only — no redistribution, no commercial use. Data must be deleted if subscription ends.

---

## Architecture Overview

```
Finnhub API
    ↓ (scheduled sync jobs)
Backend (Node/Express)
    ├── Auth middleware (JWT)          ← Phase 3
    ├── Symbols & quotes routes        ← Phase 1
    ├── Watchlist & portfolio routes   ← Phase 2
    └── User routes                    ← Phase 3
    ↓
Postgres Database
    ├── symbols                        ← Phase 1
    ├── symbol_quotes                  ← Phase 1
    ├── users                          ← Phase 3
    ├── watchlists                     ← Phase 2/3
    ├── watchlist_symbols              ← Phase 2/3
    └── portfolio_holdings             ← Phase 2/3
    ↓
REST API
    ↓
React Frontend
    ├── Symbol lookup & price          ← Phase 1
    ├── Watchlist & portfolio views    ← Phase 2
    ├── Public share pages (read-only) ← Phase 2
    └── Auth (login/register)          ← Phase 3
```

---

## Key Architectural Decisions

| Decision           | Choice                                | Reason                                                                                               |
| ------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Data source        | Finnhub free tier                     | Sufficient for personal/portfolio use                                                                |
| Local data caching | Postgres                              | Avoids burning API rate limits on every frontend request                                             |
| Symbol search      | Postgres `LIKE 'AAP%'` + B-tree index | Prefix-only search, no fuzzy needed — Postgres handles this efficiently without extra infrastructure |
| Cache layer        | None (no Redis)                       | Symbol list is small (~10k rows), Postgres is fast enough                                            |
| Redistribution     | None                                  | Keeps project within Finnhub's personal ToS                                                          |

---

## Database Schema

### `symbols` table

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

### `symbol_quotes` table

One-to-one with `symbols`. Synced per-symbol on a separate, more frequent schedule.

```sql
CREATE TABLE symbol_quotes (
    symbol_id   VARCHAR PRIMARY KEY REFERENCES symbols(id),
    last_price  DECIMAL,
    open        DECIMAL,
    high        DECIMAL,
    low         DECIMAL,
    volume      BIGINT,
    synced_at   TIMESTAMP   -- track data staleness
);
```

> **Why two tables?** Different sync frequencies, avoids sparse NULL columns, and keeps queries clean.

### Example Query (Symbol Lookup + Quote)

```sql
SELECT s.symbol, s.name, q.last_price, q.synced_at
FROM symbols s
LEFT JOIN symbol_quotes q ON q.symbol_id = s.id
WHERE s.symbol LIKE 'AAP%';
```

---

## Features Planned

Features are ordered by priority. Complete each phase before moving to the next.

### Phase 1 — Core (Current Focus)

- [ ] Sync pipeline for US exchange symbols
- [ ] Scheduled background jobs for quote refresh
- [ ] Symbol lookup (prefix search)
- [ ] Last traded price display

### Phase 2 — Watchlists & Portfolios

- [ ] Portfolio holdings (quantity, average cost)
- [ ] Watchlist creation and management
- [ ] Public share links for watchlists and portfolios (read-only)

### Phase 3 — Accounts

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
    synced_at   TIMESTAMP   -- track data staleness
);
```

> **Why two tables?** Different sync frequencies, avoids sparse NULL columns, and keeps queries clean.

#### Example Query (Symbol Lookup + Quote)

```sql
SELECT s.symbol, s.name, q.last_price, q.synced_at
FROM symbols s
LEFT JOIN symbol_quotes q ON q.symbol_id = s.id
WHERE s.symbol LIKE 'AAP%';
```

---

### Phase 3 — User, Watchlist & Portfolio Tables

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

## Still To Define

- [ ] Backend language/framework
- [ ] Deployment strategy
- [ ] Which specific Finnhub endpoints to use
- [ ] Sync job implementation (cron vs queue)
- [ ] React frontend component structure
- [ ] Auth strategy for Phase 3 (Clerk / Supabase Auth / custom JWT)

---

## Finnhub Endpoints (To Be Mapped)

| Data               | Endpoint                        | Sync Frequency    |
| ------------------ | ------------------------------- | ----------------- |
| US Symbol list     | `GET /stock/symbol?exchange=US` | Daily             |
| Quote / last price | `GET /quote?symbol=AAPL`        | Every few minutes |

---

## ToS Notes

- Personal use only — no redistribution, no commercial use
- Data must be deleted if subscription ends
- Phase 2/3 sharing features (public watchlists, portfolios) are likely fine for a portfolio project but would require a commercial Finnhub agreement if the app ever goes public

---

## Notes

- This project is intentionally scoped for a portfolio — avoid over-engineering
- A clear README and architecture diagram will be valuable for recruiter visibility
- A live deployment link on a resume significantly increases impact
