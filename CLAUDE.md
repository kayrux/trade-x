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
    ├── /auth      — register / login / me
    ├── /symbols   — prefix search + quotes
    ├── /candles   — historical OHLCV
    ├── /news      — company + market news
    ├── /picks     — YouTuber picks + performance
    └── /channels  — pipeline control (mutations are admin-only)
    ↓
PostgreSQL
    ├── symbols, symbol_quotes
    ├── symbol_candles, symbol_candle_meta, candle_coverage
    │   (+ symbol_candles_weekly / _monthly VIEWS)
    ├── tracked_channels, videos, picks
    └── users
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
│   ├── Dashboard/      # Symbol lookup, quote, chart, news
│   ├── YouTuberPicks/  # Picks table, video detail, sync history
│   ├── Auth/           # Login.jsx, Register.jsx, shared Auth.css
│   └── Account/
├── components/
│   ├── RequireAuth.jsx # Route guard
│   ├── ui/             # CandleChart, SymbolDetail, TablePagination, …
│   ├── forms/          # SearchBar
│   └── layouts/        # PageLayout, Navbar
├── hooks/              # useSymbolSearch, useQuote, useCandles, usePicks, …
├── lib/
│   ├── api/            # One file per backend resource; plain fetch, no client lib
│   └── constants/      # API_BASE_URL, TABLE_PAGE_SIZE, MIC name/currency maps
├── context/            # ThemeContext, AuthContext
└── styles/             # variables.css — CSS custom properties, light + dark
```

**Conventions:**
- Styling is plain CSS with BEM-ish class names and a co-located `.css` per component. Use
  the custom properties in `styles/variables.css` (`--color-bg-dark`, `--color-accent`,
  `--color-text-muted`, …) — never hardcode colors, or light mode breaks.
- API modules use bare `fetch`, throw on `!res.ok`, and surface the server's `error` field.
- There is no `utils/` or `types/` directory. This is JavaScript, not TypeScript.

## Database

Full DDL lives in `PLAN.md`. Two points that aren't obvious from the schema:

- `symbols` syncs daily; `symbol_quotes` refreshes every few minutes. Separate tables for the
  differing cadence, avoiding sparse NULLs.
- **Weekly and monthly candles are VIEWS**, derived from daily rows. Only `daily` is stored —
  never insert weekly/monthly rows.

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
so check before naming. Write statements to be re-runnable (`IF NOT EXISTS`, `ON CONFLICT`).

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

## Development Phases

Phases 1–4 (core, charts, YouTuber Picks, accounts) are complete. Phase 5 is watchlists and
portfolios; Phase 6 is trade tracking. See `PLAN.md`. Complete each phase before the next.

## External APIs

| Source | Limits & notes |
| ------ | -------------- |
| Finnhub | 60 calls/min. Symbol list daily, quotes every few minutes. Schema at `finnhub-schema.json` |
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
