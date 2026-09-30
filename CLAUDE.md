# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trade-X is a full-stack financial market data dashboard portfolio project. A React frontend
(Create React App) is backed by a Node/Express API and PostgreSQL, fed by several external
data sources plus a local Python service.

**`PLAN.md` is the source of truth for the roadmap and full schema DDL.** This file covers
conventions and gotchas — don't duplicate the schema here.

## Commands

### Client (`client/`)

```bash
npm start        # Dev server on port 3000
npm run build    # Production build
npm test         # Run tests (watch mode)
npm test -- --watchAll=false  # Run tests once
```

### Server (`server/`)

```bash
npm start        # node index.js — API on port 4000
```

### Python candle service (`server/python/`)

```bash
pip install -r requirements.txt
uvicorn candle_service:app --port 5001
```

Serves historical OHLCV (yfinance) and YouTube transcripts. The Node server reaches it via
`CANDLE_SERVICE_URL` / `PYTHON_SERVICE_URL`. Candle and transcript features fail gracefully
when it isn't running.

The client, server, and Python service are independent packages — there is no root-level
package.json. Run commands from inside the relevant directory.

## Architecture

```
Finnhub          Python service        Alpha Vantage      YouTube API + Gemini
(quotes,         (yfinance candles,    (commodities)      (videos, picks)
 symbols, news)   transcripts)
    ↓                  ↓                     ↓                   ↓
Node/Express (server/)
    ├── /auth        — register / login / me
    ├── /symbols     — prefix search + quotes
    ├── /candles     — historical OHLCV
    ├── /news        — company + market news
    ├── /picks       — YouTuber picks + performance
    ├── /channels    — pipeline control (mutations are admin-only)
    └── /watchlists  — per-user lists (every route requires auth)
    ↓
PostgreSQL
    ├── symbols, symbol_quotes
    ├── symbol_candles, symbol_candle_meta, candle_coverage
    │   (+ symbol_candles_weekly / _monthly VIEWS)
    ├── tracked_channels, videos, picks
    ├── users
    └── watchlists, watchlist_symbols
    ↓
React (client/)
```

## Client Folder Structure

This is **Create React App**, not Vite — the entry points are `src/index.js` and `src/App.js`
(`.js`, not `.jsx`). Components and contexts use `.jsx`.

```
src/
├── pages/              # One folder per route/view, with a co-located .css
│   ├── Home/
│   ├── Symbol/         # SymbolPage.jsx — /symbol/:ticker. Quote, chart, news
│   ├── YouTuberPicks/  # Picks table, video detail, sync history
│   ├── Auth/           # Login.jsx, Register.jsx, shared Auth.css
│   └── Account/
├── components/
│   ├── RequireAuth.jsx # Route guard
│   ├── ui/             # CandleChart, SymbolDetail, TablePagination, …
│   ├── forms/          # SearchBar
│   └── layouts/        # PageLayout, Navbar, Sidebar (+ WatchlistPanel)
├── hooks/              # useSymbolSearch, useQuote, useCandles, usePicks, …
├── lib/
│   ├── api/            # One file per backend resource; plain fetch, no client lib
│   ├── constants/      # API_BASE_URL, TABLE_PAGE_SIZE, MIC name/currency maps
│   └── utils/          # marketHours.js only — not a grab-bag; think before adding
├── context/            # Theme, Auth, Watchlist, Snackbar, Layout
└── styles/             # variables.css — CSS custom properties, light + dark
```

There is no `/watchlists` page — watchlists live in the Sidebar's `WatchlistPanel`, with
create/rename/delete/reorder in `ui/ManageWatchlistsModal` and add/remove via `ui/WatchlistStar`.
`/dashboard` is a legacy redirect, not a view.

**Conventions:**
- Styling is plain CSS with BEM-ish class names and a co-located `.css` per component. Use
  the custom properties in `styles/variables.css` (`--color-bg-dark`, `--color-accent`,
  `--color-text-muted`, …) — never hardcode colors, or light mode breaks.
- API modules use bare `fetch`, throw on `!res.ok`, and surface the server's `error` field.
- There is no `types/` directory. This is JavaScript, not TypeScript.

## Comments

Applies to all code — client, server, Python, and SQL.

- Default to no comment. Self-explanatory code gets none: don't restate what a name, a
  signature, or an obvious line already says.
- Comment only what the code can't say itself — a non-obvious *why*, an external constraint
  (rate limits, provider quirks), or a workaround that looks wrong without the reason.
- Keep them to one line where possible. No block headers, no section banners, no JSDoc
  unless the shape is genuinely unclear from the code.
- Delete stale comments as you change code; a wrong comment is worse than none.

## Database

Full DDL lives in `PLAN.md`. Two points that aren't obvious from the schema:

- `symbols` syncs daily; `symbol_quotes` refreshes far more often. Separate tables for the
  differing cadence, avoiding sparse NULLs.
- **Two things write `symbol_quotes`**, and only these: `GET /symbols/:symbol`, which refreshes
  live when the row is older than 30s, and the `syncQuotes` cron. Everything else, including
  `GET /symbols/batch`, reads whatever is stored. A symbol that neither path covers keeps a stale
  price *and* a stale `prev_close`, which makes its % change wrong, not just old.
- `syncQuotes` (`*/2 * * * 1-5`) covers **only symbols on a watchlist** — the full 31k table can't
  fit in Finnhub's 60 calls/min. It no-ops outside the US session and skips rows refreshed in the
  last 90s, so most ticks cost nothing.
- **Weekly and monthly candles are VIEWS**, derived from daily rows. Only `daily` is stored —
  never insert weekly/monthly rows.
- **`symbols.id` is a FIGI, not the ticker**, and ~28 tickers (TEVA, ARB, …) appear on two rows
  with different ids. Any ticker → id lookup needs `DISTINCT ON (symbol) … ORDER BY symbol, id`
  so the same ticker always resolves to the same row — see `resolveSymbolIds` in
  `routes/watchlists.js`. Without it, one ticker can land on a watchlist twice under two ids.

Symbol lookup is a B-tree prefix query — no fuzzy search, no Redis:

```sql
SELECT s.symbol, s.name, q.last_price, q.synced_at
FROM symbols s
LEFT JOIN symbol_quotes q ON q.symbol_id = s.id
WHERE s.symbol LIKE 'AAP%';
```

### Migrations

`server/migrations/*.sql`, applied **by hand** (`psql $DATABASE_URL -f <file>`) — there is no
runner. Number each new file with the next unused prefix; `002` was accidentally used twice,
so check before naming. The latest is `006_watchlists.sql`, so the next is `007`. Write
statements to be re-runnable (`IF NOT EXISTS`, `ON CONFLICT`).

## Auth

JWT in `localStorage`, sent as `Authorization: Bearer <token>`. Requires `JWT_SECRET` — the
server throws at startup without it.

- `server/src/lib/auth.js` — hashing (bcryptjs), token signing/verifying, and `publicUser()`.
  **Every route returning a user must go through `publicUser()`** so `password_hash` can't leak.
- `server/src/middleware/auth.js` — `attachUser` (global, never rejects), `requireAuth` (401),
  `requireAdmin` (403).
- Reads are public so the app is browsable without an account. Mutating and debug routes on
  `/channels` are `requireAdmin` because each spends YouTube or Gemini quota.
- Registration always creates `is_admin = FALSE`; promote by hand via SQL.
- Client: `useAuth()` from `context/AuthContext`. Admin-only controls render behind `isAdmin`,
  which is cosmetic — the server check is the real boundary. Calls to admin-gated routes must
  use `authFetch` from `lib/api/auth.js`, not bare `fetch`.
- **`/watchlists` is the one resource where reads are not public.** Every route is
  `requireAuth` and scoped to the caller: a list that doesn't exist and one owned by someone
  else both answer `404`, so ids can't be probed. A non-UUID `:id` is screened out and
  treated as not-found rather than reaching Postgres and surfacing as a 500. Keep that shape
  — go through `findOwned()` in `routes/watchlists.js` for any new `:id` route.

## Development Phases

Phases 1–4 (core, charts, YouTuber Picks, accounts) are complete. Phase 6 is trade tracking.
See `PLAN.md`. Complete each phase before the next.

**Phase 5 is partially done.** Of its three parts:

- Watchlists — **done**, end to end (`006_watchlists.sql`, `/watchlists`, sidebar + modal).
- Portfolio holdings — **not started**. The `portfolio_holdings` DDL is drafted in `PLAN.md`
  but no migration applies it and there is no route, API module, or page.
- Public share links — **not started**. `watchlists.is_public` exists and is returned by the
  API, but nothing sets it: `PATCH /watchlists/:id` accepts only `name`, and there is no
  unauthenticated read route. Sharing by raw watchlist UUID would make the id its own secret,
  which cuts against the deliberate 404 rule documented under Auth — decide on a separate
  share token before building it.

## External APIs

| Source | Limits & notes |
| ------ | -------------- |
| Finnhub | 60 calls/min. Symbol list daily; quotes every 2 min for watchlisted symbols during market hours, capped at 40 per run. Schema at `finnhub-schema.json` |
| Alpha Vantage | **25 requests/day** — startup sync is freshness-guarded. Schema at `alphavantage-schema.json`. Commodities namespaced `AV:*` to avoid colliding with real tickers (WTI, GOLD are live NYSE symbols) |
| yfinance | Via the Python service. No key, no hard limit |
| YouTube Data API | Quota-limited — the admin gate exists partly to protect it |
| Gemini | Quota-limited. Used for pick extraction from transcripts |

All providers are personal use only — no redistribution or commercial use; data must be
deleted if a subscription ends.

## Restrictions

- Never access `.env` files directly. This applies to you and to any subagents you spawn —
  always include this restriction explicitly in subagent prompts.
- To find required environment variable names, grep source files for `process.env.`
  references instead of reading `.env`.

## Subagents

When spawning agents via the Agent tool, explicitly include all restrictions from this file in
the subagent prompt. Subagents start fresh and do not inherit the parent conversation's context.
