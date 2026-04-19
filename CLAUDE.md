# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trade-X is a full-stack financial market data dashboard portfolio project. It pulls financial data from the Finnhub API (free tier, personal use only) and serves it through a React frontend backed by a Node/Express API and PostgreSQL database.

## Commands

### Client (`client/`)

```bash
npm start        # Dev server on port 3000
npm run build    # Production build
npm test         # Run tests (watch mode)
npm test -- --watchAll=false  # Run tests once
```

### Server (`server/`)

No scripts configured yet — run with `node` directly once source files exist.

## Architecture

```
Finnhub API
    ↓ (scheduled sync jobs)
Node/Express Backend (server/)
    ├── Symbol & quote routes     ← Phase 1
    ├── Watchlist/portfolio routes ← Phase 2
    └── JWT auth middleware        ← Phase 3
    ↓
PostgreSQL
    ├── symbols (daily sync from Finnhub /stock/symbol?exchange=US)
    ├── symbol_quotes (frequent refresh from /quote?symbol=X)
    ├── watchlists / watchlist_symbols ← Phase 2
    ├── portfolio_holdings             ← Phase 2
    └── users                          ← Phase 3
    ↓
React Frontend (client/)
```

The client and server are independent packages — there is no root-level package.json. Run commands from inside `client/` or `server/`.

## Client Folder Structure

src/
├── pages/ # One folder per route/view
│ ├── Dashboard/ # Phase 1 — symbol lookup + price
│ ├── Watchlist/ # Phase 2
│ ├── Portfolio/ # Phase 2
│ ├── Share/ # Phase 2 — public read-only views
│ │ ├── WatchlistShare/
│ │ └── PortfolioShare/
│ └── Auth/ # Phase 3 — login/register
├── components/ # Reusable UI components
│ ├── ui/ # Generic: Button, Badge, Spinner, etc.
│ ├── forms/ # SearchBar, LoginForm, etc.
│ └── layouts/ # PageLayout, Navbar, etc.
├── hooks/ # Custom React hooks
│ ├── useSymbolSearch.js
│ └── useQuote.js # Handles polling interval
├── lib/ # Non-component logic
│ ├── api/ # One file per backend resource
│ │ ├── symbols.js
│ │ ├── watchlists.js # Phase 2
│ │ ├── portfolio.js # Phase 2
│ │ └── auth.js # Phase 3
│ ├── utils/ # Pure helpers: formatPrice, formatVolume
│ └── constants/ # API base URL, polling intervals, etc.
├── context/ # Phase 3 — AuthContext
├── types/ # Shared type definitions (if using TypeScript)
├── styles/ # Global styles / Tailwind config overrides
├── App.jsx # Router setup
└── main.jsx

## Database Schema

### Phase 1 (core)

```sql
CREATE TABLE symbols (
    id         VARCHAR PRIMARY KEY,  -- Finnhub unique key
    symbol     VARCHAR NOT NULL,     -- e.g. AAPL
    name       VARCHAR,
    exchange   VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE symbol_quotes (
    symbol_id  VARCHAR PRIMARY KEY REFERENCES symbols(id),
    last_price DECIMAL,
    open       DECIMAL,
    high       DECIMAL,
    low        DECIMAL,
    volume     BIGINT,
    synced_at  TIMESTAMP
);
```

Two separate tables are intentional: `symbols` syncs daily; `symbol_quotes` syncs every few minutes. Different cadences, no sparse NULLs.

Symbol lookup uses a B-tree prefix query — no fuzzy search, no Redis:

```sql
SELECT s.symbol, s.name, q.last_price, q.synced_at
FROM symbols s
LEFT JOIN symbol_quotes q ON q.symbol_id = s.id
WHERE s.symbol LIKE 'AAP%';
```

### Phase 3 tables

`users`, `watchlists`, `watchlist_symbols`, `portfolio_holdings` — see PLAN.md for full DDL.

## Development Phases

- **Phase 1 (current):** Finnhub sync pipeline, scheduled quote refresh, symbol prefix search, last price display
- **Phase 2:** Watchlists, portfolio holdings, public read-only share links
- **Phase 3:** User accounts, JWT auth, user-owned watchlists/portfolios

Complete each phase before starting the next.

## Finnhub API

- Rate limit: 60 calls/minute (free tier)
- Symbol list: `GET /stock/symbol?exchange=US` — sync daily
- Quote: `GET /quote?symbol=AAPL` — sync every few minutes
- Personal use only — no redistribution or commercial use; data must be deleted if subscription ends

## Restrictions

- You are not allowed to access .env files
