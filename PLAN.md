# Trade X — Project Plan

> **Note:** This is a living document. Update it as architectural decisions are made and the project progresses.

---

## Overview

A personal full-stack portfolio project that pulls financial market data from several providers and serves it via a React frontend. The primary goal is to demonstrate full-stack and data pipeline skills to recruiters.

---

## Data Sources

| Source | Used for | Notes |
| ------ | -------- | ----- |
| **Finnhub** | US symbol list, live quotes, company & market news | Free tier, 60 calls/min. Personal use only — no redistribution, no commercial use. |
| **Python candle service** (yfinance) | Historical daily OHLCV | A local FastAPI service (`server/python/candle_service.py`) reached via `CANDLE_SERVICE_URL`. Node never calls yfinance directly. |
| **Alpha Vantage** | Commodity prices (Gold, Silver, WTI, Brent) | Free tier, 25 requests/day — startup sync is freshness-guarded to avoid burning it. |
| **YouTube Data API** | Channel uploads discovery, video metadata | Used by the YouTuber Picks pipeline. |
| **Google Gemini** | Extracting stock picks from video transcripts | Used by the YouTuber Picks pipeline. |

> **Historical note:** Candles were originally sourced from EODHD. That has been replaced by the Python/yfinance service. Legacy rows are still tagged `source = 'eodhd'` in `symbol_candles`.

---

## Architecture Overview

```
Finnhub API          Python candle service     Alpha Vantage      YouTube API + Gemini
(quotes, symbols,    (yfinance, daily OHLCV)   (commodities)      (videos, transcripts, picks)
 news)
    ↓ scheduled           ↓ on-demand gap-fill      ↓ daily             ↓ hourly
Backend (Node/Express)
    ├── /symbols     — prefix search + quotes          ← Phase 1
    ├── /candles     — historical OHLCV                ← Phase 2
    ├── /news        — company + market news           ← Phase 2
    ├── /picks       — YouTuber picks + performance    ← Phase 3
    ├── /channels    — pipeline control & sync history ← Phase 3
    ├── /auth        — register / login / me           ← Phase 4
    └── watchlist & portfolio routes                   ← Phase 5
    ↓
Postgres
    ├── symbols, symbol_quotes                         ← Phase 1
    ├── symbol_candles, symbol_candle_meta,
    │   candle_coverage, + weekly/monthly views        ← Phase 2
    ├── tracked_channels, videos, picks                ← Phase 3
    ├── users                                          ← Phase 4
    └── watchlists, watchlist_symbols,
        portfolio_holdings                             ← Phase 5
    ↓
REST API
    ↓
React Frontend
    ├── Symbol lookup & live price      ← Phase 1
    ├── Historical OHLCV charts         ← Phase 2
    ├── YouTuber Picks views            ← Phase 3
    ├── Auth + account page             ← Phase 4
    └── Watchlist & portfolio views     ← Phase 5
```

---

## Key Architectural Decisions

| Decision | Choice | Reason |
| -------- | ------ | ------ |
| Live data source | Finnhub free tier | Sufficient for personal/portfolio use |
| Historical data | Python service wrapping yfinance | No API key, no rate-limit ceiling, supports 10-year backfill |
| Weekly/monthly candles | Postgres **views** over daily rows | Derived, never stored — no duplicate data to keep in sync |
| Local data caching | Postgres | Avoids burning API rate limits on every frontend request |
| Symbol search | `LIKE 'AAP%'` + B-tree index | Prefix-only search, no fuzzy needed |
| Candle sync | On-demand gap-fill (`candle_coverage`) | Pre-syncing 10k symbols is impractical; most are never viewed |
| Commodities | Alpha Vantage, namespaced `AV:*` | Avoids collision with real tickers (WTI, GOLD are live NYSE symbols) |
| Cache layer | None (no Redis) | Symbol list is small (~10k rows), Postgres is fast enough |
| Chart library | TradingView Lightweight Charts | Performant, purpose-built for financial charts |
| Auth | JWT in `localStorage`, `Bearer` header | Simplest to build and debug; works when client and API are on different hosts |
| Redistribution | None | Keeps the project within every provider's personal ToS |

---

## Development Phases

Complete each phase before moving to the next.

### Phase 1 — Core ✅ Complete

- [x] Sync pipeline for US exchange symbols
- [x] Scheduled background jobs for quote refresh
- [x] Symbol lookup (prefix search)
- [x] Last traded price display

### Phase 2 — Historical Charts ✅ Complete

- [x] `symbol_candles` + `symbol_candle_meta` DB tables
- [x] `candle_coverage` table driving on-demand gap-fill
- [x] Python/yfinance candle service with 10-year backfill
- [x] `GET /candles/:symbol` with `resolution` and `range` params
- [x] Derived `symbol_candles_weekly` / `symbol_candles_monthly` views
- [x] TradingView Lightweight Charts integration
- [x] Resolution switcher (daily / weekly / monthly)
- [x] Company and market news (`/news`)
- [x] Market snapshot with Alpha Vantage commodities

### Phase 3 — YouTuber Picks ✅ Complete

- [x] Tracked channels with hourly upload discovery
- [x] Transcript fetching via the Python service
- [x] Gemini-based pick extraction (ticker, sentiment, conviction, price target)
- [x] Symbol resolution against the `symbols` table
- [x] `price_at_mention` backfill from historical candles
- [x] Performance tracking (% since mention) with opportunistic quote refresh
- [x] Per-video detail page and sync history page, both paginated

### Phase 4 — Accounts ✅ Complete

Accounts come **before** watchlists and portfolios: those, and the trade tracking planned
later, are all per-user data. Building them against a global schema would mean a painful
`user_id` backfill afterwards. Accounts first means every one of those tables is born owned.

- [x] `users` table (email, username, bcrypt password hash, `is_admin`)
- [x] `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- [x] JWT signing/verification + `attachUser` / `requireAuth` / `requireAdmin` middleware
- [x] Lock down pipeline mutations in `/channels` behind `requireAdmin`
- [x] `AuthContext` on the client, token persisted in `localStorage`
- [x] `/login`, `/register`, `/account` pages
- [x] Navbar account menu
- [x] Hide admin-only pipeline controls in the Picks UI for non-admins

See [Accounts — Phase 4 Detail](#accounts--phase-4-detail) below.

### Phase 5 — Watchlists & Portfolios ← **Current focus**

- [ ] Watchlist creation and management
- [ ] Portfolio holdings (quantity, average cost)
- [ ] Public share links for watchlists and portfolios (read-only)

### Phase 6 — Trades & Activity

- [ ] Trade tracking on top of user accounts

---

## Database Schema

> **Migration convention:** migrations live in `server/migrations/` and are applied by hand
> (`psql $DATABASE_URL -f <file>`) — there is no runner. Number each file with the **next
> unused** prefix. Note that `002` was accidentally used twice (`002_commodities.sql` and
> `002_youtuber_picks.sql`); don't repeat that.

### Phase 1 — Core Tables

```sql
CREATE TABLE symbols (
    id          VARCHAR PRIMARY KEY,  -- Finnhub unique key
    symbol      VARCHAR NOT NULL,     -- e.g. AAPL
    name        VARCHAR,              -- e.g. Apple Inc.
    exchange    VARCHAR,              -- e.g. NASDAQ
    created_at  TIMESTAMP DEFAULT NOW()
);

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

Commodity symbols are seeded into `symbols` with an `AV:` prefix and `exchange = 'COMMODITY'`
(see `002_commodities.sql`). Their prices land in `symbol_candles` as flat OHLC rows with
`source = 'alphavantage'`.

### Phase 2 — Historical Candles

```sql
CREATE TABLE symbol_candles (
    id             BIGSERIAL     PRIMARY KEY,
    symbol_id      VARCHAR       NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    resolution     VARCHAR(10)   NOT NULL,   -- 'daily' | '1h'  (weekly/monthly are views)
    ts             TIMESTAMPTZ   NOT NULL,   -- candle open time, UTC
    open           DECIMAL(18,6) NOT NULL,
    high           DECIMAL(18,6) NOT NULL,
    low            DECIMAL(18,6) NOT NULL,
    close          DECIMAL(18,6) NOT NULL,
    adjusted_close DECIMAL(18,6),
    volume         BIGINT        NOT NULL DEFAULT 0,
    source         VARCHAR       NOT NULL DEFAULT 'eodhd',  -- eodhd | yfinance | alphavantage
    synced_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT symbol_candles_unique UNIQUE (symbol_id, resolution, ts)
);

CREATE INDEX idx_symbol_candles_lookup
    ON symbol_candles (symbol_id, resolution, ts DESC);

-- Drives on-demand gap-fill: one row per symbol
CREATE TABLE candle_coverage (
    symbol_id       VARCHAR     PRIMARY KEY REFERENCES symbols(id),
    earliest_ts     TIMESTAMPTZ,
    latest_ts       TIMESTAMPTZ,
    target_start    TIMESTAMPTZ NOT NULL DEFAULT NOW() - INTERVAL '10 years',
    backfill_done   BOOLEAN     NOT NULL DEFAULT FALSE,
    last_checked_at TIMESTAMPTZ
);
```

`symbol_candles_weekly` and `symbol_candles_monthly` are **views** aggregating the daily
rows (first open, last close, max high, min low, summed volume). See `001_candle_backfill.sql`.

### Phase 3 — YouTuber Picks

`tracked_channels`, `videos`, `picks` — full DDL in `server/migrations/002_youtuber_picks.sql`.
This data is **global**, not per-user; accounts do not change that.

### Phase 4 — Users

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR UNIQUE NOT NULL,
    username      VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    display_name  VARCHAR,
    is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Case-insensitive lookup for login and username uniqueness
CREATE UNIQUE INDEX idx_users_email_lower    ON users (LOWER(email));
CREATE UNIQUE INDEX idx_users_username_lower ON users (LOWER(username));
```

Registration always creates `is_admin = FALSE`. There is no self-serve promotion route —
this is a single-operator project. Promote your own account once, by hand:

```sql
UPDATE users SET is_admin = TRUE WHERE LOWER(email) = 'you@example.com';
```

### Phase 5 — Watchlists & Portfolios

```sql
CREATE TABLE watchlists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    name        VARCHAR NOT NULL,
    is_public   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE watchlist_symbols (
    watchlist_id UUID REFERENCES watchlists(id),
    symbol_id    VARCHAR REFERENCES symbols(id),
    added_at     TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (watchlist_id, symbol_id)
);

CREATE TABLE portfolio_holdings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES users(id),
    symbol_id  VARCHAR REFERENCES symbols(id),
    quantity   DECIMAL NOT NULL,
    avg_cost   DECIMAL,
    added_at   TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

### Phase 1 — Symbols

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/symbols?q=AAP` | public | Prefix search, returns up to 20 symbols |
| GET | `/symbols/:symbol` | public | Exact match with live quote data |

### Phase 2 — Candles & News

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/candles/:symbol` | public | Historical OHLCV. Params: `resolution` (`daily`\|`weekly`\|`monthly`), `range` (`5d`\|`1m`\|`3m`\|`ytd`\|`1y`\|`5y`\|`max`), `from`, `to` |
| GET | `/news/market` | public | General market news (15-min cache) |
| GET | `/news/:symbol` | public | Company news |

Candle response: `{ symbol, resolution, candles: [{ ts, open, high, low, close, adjusted_close, volume }] }`

### Phase 3 — Picks & Channels

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/picks` | public | Resolved picks + performance. Filters: `channel_id`, `symbol`, `sentiment`, `video_id` |
| GET | `/channels` | public | List tracked channels |
| GET | `/channels/videos` | public | Sync history |
| POST | `/channels` | **admin** | Add a tracked channel, kicks off a 7-day backfill |
| DELETE | `/channels/:id` | **admin** | Soft-delete (deactivate) a channel |
| POST | `/channels/sync` | **admin** | Manually trigger a resync |
| POST | `/channels/videos/:id/process` | **admin** | Re-run the pipeline for one video |
| GET | `/channels/videos/:id/transcript` | **admin** | Debug: live transcript fetch |
| GET | `/channels/videos/:id/extract-debug` | **admin** | Debug: live Gemini extraction |

> The mutating and debug routes are admin-gated because each one spends YouTube API or
> Gemini quota. Everything else stays public so the app is fully browsable without an account.

### Phase 4 — Auth

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/auth/register` | public | → `201 { token, user }` |
| POST | `/auth/login` | public | → `200 { token, user }` |
| GET | `/auth/me` | required | → `{ user }`, re-read from the DB |

---

## Accounts — Phase 4 Detail

### Decisions

| Decision | Choice |
| -------- | ------ |
| Token transport | JWT in `localStorage`, sent as `Authorization: Bearer <token>` |
| Registration | email + username + password, bcrypt (cost 12). `username` is stored now so later profile/social features have a stable handle |
| Access scope | Reads stay public; pipeline writes require `users.is_admin` |
| Picks ownership | Stays global — no `user_id` on `tracked_channels` / `videos` / `picks` |
| UI scope | `/login`, `/register`, `/account`, plus the Navbar account menu |

### Server

New deps: `bcryptjs`, `jsonwebtoken`. New env var: **`JWT_SECRET`** — the server throws at
startup if it's missing, so a silently-unsigned token is impossible.

> `bcryptjs` rather than `bcrypt`: the latter is a native module needing node-gyp and Visual
> Studio build tools on Windows. `bcryptjs` is pure JS, API-compatible, and produces identical
> hashes — slower, which is irrelevant at login frequency.

**`src/lib/auth.js`** — `hashPassword`, `verifyPassword`, `signToken` (payload
`{ sub, username, is_admin }`, 7-day expiry), `verifyToken`, and `publicUser(row)` which
strips `password_hash`. Every route returning a user goes through `publicUser`.

**`src/middleware/auth.js`** — three exports, deliberately separated:

| Export | Behavior |
| ------ | -------- |
| `attachUser` | Reads the `Bearer` header, verifies, sets `req.user`. **Never rejects** — mounted globally |
| `requireAuth` | 401 if there's no valid `req.user` |
| `requireAdmin` | `requireAuth` + 403 unless `req.user.is_admin` |

**Validation:** email matches a basic pattern; username 3–30 chars of `[a-zA-Z0-9_]`;
password min 8 chars.

**Login does not leak which field was wrong** — a bad email and a bad password both return
`401 { error: 'Invalid email or password' }`. Registration *does* distinguish "email taken"
from "username taken" (both are discoverable anyway, and the UX matters), relying on the
unique indexes and catching Postgres error `23505` rather than a check-then-insert race.

### Client

- **`lib/api/auth.js`** — `register`, `login`, `fetchMe`, plus an `authFetch(url, options)`
  helper that merges in the `Authorization` header. Only the newly-protected calls in
  `lib/api/picks.js` switch to `authFetch`; public fetches are untouched.
- **`context/AuthContext.jsx`** — modeled on the existing `ThemeContext`. Exposes
  `{ user, token, loading, login, register, logout, isAdmin }`. Token key `tradex_token`.
  On mount with a token present it calls `fetchMe()` to validate; a 401 clears the token and
  logs out, which is what handles expiry. `loading` stays true until that first call settles
  so protected UI doesn't flash the logged-out state.
- **Routes** — `/login`, `/register` (`pages/Auth/`), `/account` (`pages/Account/`, wrapped
  in a small `RequireAuth` that redirects to `/login`).
- **Navbar** — the `User` icon becomes a real dropdown: logged out → "Log in" /
  "Create account"; logged in → username, "Account", "Log out". Reuses the click-outside
  pattern already used by the search dropdown in the same file.
- **Admin gating** — the Run-pipeline / sync / add-channel controls in the Picks pages
  render only when `isAdmin`. This is cosmetic; the server check is the real boundary.

---

## Environment Variables

Server (`server/.env`) — never read or edited by tooling; maintain it by hand:

`DATABASE_URL`, `PORT`, `FINNHUB_API_KEY`, `ALPHA_API_KEY`, `YOUTUBE_API_KEY`,
`GEMINI_API_KEY`, `CANDLE_SERVICE_URL`, `PYTHON_SERVICE_URL`, `JWT_SECRET` *(Phase 4)*

---

## ToS Notes

- **Finnhub:** personal use only — no redistribution, no commercial use. Data must be deleted if the subscription ends.
- **Alpha Vantage:** free tier, 25 requests/day. Same personal-use posture.
- **YouTube / Gemini:** quota-limited; the admin gate in Phase 4 exists partly to stop anonymous callers from spending it.
- Phase 5 sharing features (public watchlists, portfolios) are likely fine for a portfolio project but would require commercial agreements if the app ever goes public.

---

## Notes

- This project is intentionally scoped for a portfolio — avoid over-engineering
- A clear README and architecture diagram will be valuable for recruiter visibility
- A live deployment link on a resume significantly increases impact
