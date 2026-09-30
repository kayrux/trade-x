const pool = require('../db');

// Portfolio value history + live pricing.
//
// Past daily values are cached in portfolio_value_daily (see 009). This module
// fills that cache lazily on read and always recomputes "today" live, since the
// current day's value keeps moving with the market.
//
// Value is summed nominally across currencies — no FX conversion. The reference
// portfolios are single-currency (USD), and the existing holdings UI makes the
// same simplification; a proper multi-currency total would need an FX source.

// A calendar day as YYYY-MM-DD in UTC. Both symbol_candles.ts and trades.traded_at
// are stored at UTC midnight for a trading day, so the UTC date is the key that
// makes a trade's day line up with its candle's day. (Reinterpreting through a
// local timezone would shift a 00:00Z timestamp back a day.)
function dayUTC(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

// Range label → the inclusive start date (YYYY-MM-DD), or null for "everything".
function rangeStart(range) {
  const now = new Date();
  const d = new Date(now);
  switch (String(range || '').toLowerCase()) {
    case '1w': d.setUTCDate(d.getUTCDate() - 7); break;
    case '1m': d.setUTCMonth(d.getUTCMonth() - 1); break;
    case '3m': d.setUTCMonth(d.getUTCMonth() - 3); break;
    case '6m': d.setUTCMonth(d.getUTCMonth() - 6); break;
    case 'ytd': return `${now.getUTCFullYear()}-01-01`;
    case '1y': d.setUTCFullYear(d.getUTCFullYear() - 1); break;
    case 'all': return null;
    default: d.setUTCFullYear(d.getUTCFullYear() - 1); break; // default 1y
  }
  return dayUTC(d);
}

// Current price per symbol_id: the stored live quote when present, else the most
// recent daily candle close. A holding that's never been watchlisted may carry a
// stale/absent symbol_quotes row, so the candle fallback keeps it priced.
async function getCurrentPrices(symbolIds) {
  const prices = new Map();
  if (!symbolIds.length) return prices;

  const { rows: quotes } = await pool.query(
    `SELECT symbol_id, last_price
       FROM symbol_quotes
      WHERE symbol_id = ANY($1) AND last_price IS NOT NULL`,
    [symbolIds],
  );
  for (const r of quotes) prices.set(r.symbol_id, Number(r.last_price));

  const missing = symbolIds.filter((id) => !prices.has(id));
  if (missing.length) {
    const { rows: closes } = await pool.query(
      `SELECT DISTINCT ON (symbol_id) symbol_id, close
         FROM symbol_candles
        WHERE symbol_id = ANY($1) AND resolution = 'daily'
        ORDER BY symbol_id, ts DESC`,
      [missing],
    );
    for (const r of closes) prices.set(r.symbol_id, Number(r.close));
  }
  return prices;
}

// One account's open positions, priced at the current market. Returns rows the
// holdings table renders directly. Closed positions (quantity 0) are excluded.
async function pricedHoldings(accountId) {
  const { rows } = await pool.query(
    `SELECT h.symbol_id, s.symbol, s.name, h.quantity, h.avg_cost,
            h.realized_pnl, h.currency
       FROM portfolio_holdings h
       JOIN symbols s ON s.id = h.symbol_id
      WHERE h.account_id = $1 AND h.quantity <> 0
      ORDER BY s.symbol`,
    [accountId],
  );
  if (!rows.length) return [];

  const prices = await getCurrentPrices(rows.map((r) => r.symbol_id));

  return rows.map((r) => {
    const quantity = Number(r.quantity);
    const avgCost = r.avg_cost != null ? Number(r.avg_cost) : null;
    const price = prices.has(r.symbol_id) ? prices.get(r.symbol_id) : null;
    const marketValue = price != null ? price * quantity : null;
    const costValue = avgCost != null ? avgCost * quantity : null;
    const returnAbs =
      marketValue != null && costValue != null ? marketValue - costValue : null;
    const returnPct =
      returnAbs != null && costValue ? (returnAbs / costValue) * 100 : null;
    return {
      symbol: r.symbol,
      name: r.name,
      currency: r.currency,
      quantity,
      avg_cost: avgCost,
      price,
      market_value: marketValue,
      cost_value: costValue,
      realized_pnl: Number(r.realized_pnl),
      return_abs: returnAbs,
      return_pct: returnPct,
    };
  });
}

// Aggregate summary for one account from its priced holdings. cost_value can be
// null for an unpriced/uncovered symbol; those are skipped in the totals so a
// single missing price doesn't void the whole account's numbers.
function summarize(holdings) {
  let value = 0;
  let cost = 0;
  for (const h of holdings) {
    if (h.market_value != null) value += h.market_value;
    if (h.cost_value != null) cost += h.cost_value;
  }
  const returnAbs = value - cost;
  const returnPct = cost ? (returnAbs / cost) * 100 : null;
  return { value, cost_basis: cost, return_abs: returnAbs, return_pct: returnPct };
}

// The past trading days (YYYY-MM-DD, strictly before today) for which we have
// candle data across the given symbols, within [start, today). This is the
// spine the value series is plotted on.
async function tradingDays(symbolIds, start, today) {
  if (!symbolIds.length) return [];
  const day = `(ts AT TIME ZONE 'UTC')::date`;
  const params = [symbolIds, today];
  let where = `symbol_id = ANY($1) AND resolution = 'daily' AND ${day} < $2`;
  if (start) {
    params.push(start);
    where += ` AND ${day} >= $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT DISTINCT ${day}::text AS d FROM symbol_candles WHERE ${where} ORDER BY d`,
    params,
  );
  return rows.map((r) => r.d);
}

// Full reconstruction of an account's value on each spine date. Replays the
// entire trade history (shares held that day) against each symbol's daily close
// (carried forward across non-trading gaps). Returns Map(dateStr -> value).
//
// Called only when the cache is missing some past days; a fully cached range
// never reaches here.
async function computeSeries(accountId, spine) {
  const values = new Map();
  if (!spine.length) return values;

  const { rows: trades } = await pool.query(
    `SELECT symbol_id, side, quantity, traded_at
       FROM trades WHERE account_id = $1
      ORDER BY traded_at, created_at`,
    [accountId],
  );
  if (!trades.length) return values;

  const symbolIds = [...new Set(trades.map((t) => t.symbol_id))];

  // Per-symbol share deltas, keyed and sorted by trade date. Trades before the
  // spine still count toward shares held, so nothing is date-filtered here.
  const deltas = new Map(); // symbol_id -> [{ date, delta }]
  for (const t of trades) {
    const date = dayUTC(t.traded_at);
    const delta = t.side === 'buy' ? Number(t.quantity) : -Number(t.quantity);
    if (!deltas.has(t.symbol_id)) deltas.set(t.symbol_id, []);
    deltas.get(t.symbol_id).push({ date, delta });
  }

  // Per-symbol daily closes across the spine window (from the first trade's day,
  // so pre-spine holdings can still be priced on the earliest spine date).
  const firstTradeDate = dayUTC(trades[0].traded_at);
  const { rows: candleRows } = await pool.query(
    `SELECT symbol_id, (ts AT TIME ZONE 'UTC')::date::text AS d, close
       FROM symbol_candles
      WHERE symbol_id = ANY($1) AND resolution = 'daily'
        AND (ts AT TIME ZONE 'UTC')::date >= $2
      ORDER BY symbol_id, ts`,
    [symbolIds, firstTradeDate],
  );
  const closes = new Map(); // symbol_id -> [{ date, close }]
  for (const r of candleRows) {
    if (!closes.has(r.symbol_id)) closes.set(r.symbol_id, []);
    closes.get(r.symbol_id).push({ date: r.d, close: Number(r.close) });
  }

  // Walk the spine ascending, advancing per-symbol pointers over trades and
  // closes so shares and last-known price accrue in O(spine + trades + closes).
  const state = new Map(); // symbol_id -> { ti, ci, shares, lastClose }
  for (const id of symbolIds) state.set(id, { ti: 0, ci: 0, shares: 0, lastClose: null });

  for (const day of spine) {
    let total = 0;
    for (const id of symbolIds) {
      const st = state.get(id);
      const ds = deltas.get(id) || [];
      while (st.ti < ds.length && ds[st.ti].date <= day) {
        st.shares += ds[st.ti].delta;
        st.ti += 1;
      }
      const cs = closes.get(id) || [];
      while (st.ci < cs.length && cs[st.ci].date <= day) {
        st.lastClose = cs[st.ci].close;
        st.ci += 1;
      }
      if (st.shares !== 0 && st.lastClose != null) {
        total += st.shares * st.lastClose;
      }
    }
    values.set(day, total);
  }
  return values;
}

// Cumulative net contributions (money put in) at each of the given ascending
// dates: buys add their cost, sells subtract their proceeds. Purely from trades
// — no market prices — so this is what was deposited/withdrawn, not what it grew
// to. The chart subtracts this so a buy reads as a deposit, not a gain.
async function investedForDates(accountId, dates) {
  const invested = new Map();
  if (!dates.length) return invested;

  const { rows } = await pool.query(
    `SELECT side, quantity, price, (traded_at AT TIME ZONE 'UTC')::date::text AS d
       FROM trades WHERE account_id = $1
      ORDER BY traded_at, created_at`,
    [accountId],
  );

  let cum = 0;
  let i = 0;
  for (const date of dates) {
    while (i < rows.length && rows[i].d <= date) {
      const amount = Number(rows[i].quantity) * Number(rows[i].price);
      cum += rows[i].side === 'buy' ? amount : -amount;
      i += 1;
    }
    invested.set(date, cum);
  }
  return invested;
}

// One account's value series for a range: cached past days (filling any gaps),
// plus a live "today" point. Returns [{ date, value, invested }] ascending,
// where `invested` is cumulative net contributions to that day (see above).
async function accountSeries(accountId, range) {
  const today = dayUTC();
  const rangeFrom = rangeStart(range);

  // Floor the window at the first trade — before then the account held nothing,
  // so plotting the symbols' pre-purchase candle history as zero-value days would
  // just be a long flat run. ALL therefore starts at first activity.
  const { rows: symRows } = await pool.query(
    `SELECT DISTINCT symbol_id, MIN(traded_at) OVER () AS first_traded
       FROM trades WHERE account_id = $1`,
    [accountId],
  );
  const symbolIds = symRows.map((r) => r.symbol_id);
  if (!symbolIds.length) return [];
  const firstTradeDate = dayUTC(symRows[0].first_traded);
  const start = rangeFrom && rangeFrom > firstTradeDate ? rangeFrom : firstTradeDate;

  const spine = await tradingDays(symbolIds, start, today);

  // What's already cached in this window.
  const cacheParams = [accountId, today];
  let cacheWhere = 'account_id = $1 AND date < $2';
  if (start) {
    cacheParams.push(start);
    cacheWhere += ` AND date >= $${cacheParams.length}`;
  }
  const { rows: cachedRows } = await pool.query(
    `SELECT date::text AS date, value FROM portfolio_value_daily WHERE ${cacheWhere} ORDER BY date`,
    cacheParams,
  );
  const cached = new Map(cachedRows.map((r) => [r.date, Number(r.value)]));

  const missing = spine.filter((d) => !cached.has(d));
  if (missing.length) {
    const computed = await computeSeries(accountId, spine);
    // Persist the days we didn't already have (past days are immutable).
    const toInsert = missing.filter((d) => computed.has(d));
    if (toInsert.length) {
      const valuesSql = toInsert
        .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
        .join(', ');
      const params = [accountId];
      for (const d of toInsert) params.push(d, computed.get(d));
      await pool.query(
        `INSERT INTO portfolio_value_daily (account_id, date, value)
         VALUES ${valuesSql}
         ON CONFLICT (account_id, date) DO NOTHING`,
        params,
      );
    }
    for (const d of missing) if (computed.has(d)) cached.set(d, computed.get(d));
  }

  const series = spine
    .filter((d) => cached.has(d))
    .map((d) => ({ date: d, value: cached.get(d) }));

  // Live "today" point from current holdings + current prices.
  if (symbolIds.length) {
    const holdings = await pricedHoldings(accountId);
    const { value } = summarize(holdings);
    series.push({ date: today, value });
  }

  // Attach cumulative net contributions to each point.
  const invested = await investedForDates(accountId, series.map((p) => p.date));
  return series.map((p) => ({ ...p, invested: invested.get(p.date) ?? 0 }));
}

// Combined series across several accounts, summed per date. Each account is
// carried forward across dates where it has no point of its own, so an account
// with fewer trading days doesn't drag the total down on the days it's missing.
async function combinedSeries(accountIds, range) {
  const perAccount = await Promise.all(accountIds.map((id) => accountSeries(id, range)));

  const dates = new Set();
  for (const s of perAccount) for (const p of s) dates.add(p.date);
  const sorted = [...dates].sort();

  const maps = perAccount.map((s) => new Map(s.map((p) => [p.date, p])));
  const last = new Array(perAccount.length).fill(null);

  return sorted.map((date) => {
    let value = 0;
    let invested = 0;
    let any = false;
    for (let i = 0; i < maps.length; i += 1) {
      if (maps[i].has(date)) last[i] = maps[i].get(date);
      if (last[i] != null) {
        value += last[i].value;
        invested += last[i].invested;
        any = true;
      }
    }
    return { date, value: any ? value : 0, invested: any ? invested : 0 };
  });
}

// Drops an account's cached daily values so they recompute on next read. Called
// on any trade mutation, since edits/deletes can change history retroactively.
// Runs on a caller-supplied transaction client so it commits with the trade.
async function invalidateAccountValueCache(client, accountId) {
  await client.query(`DELETE FROM portfolio_value_daily WHERE account_id = $1`, [accountId]);
}

module.exports = {
  dayUTC,
  rangeStart,
  getCurrentPrices,
  pricedHoldings,
  summarize,
  accountSeries,
  combinedSeries,
  invalidateAccountValueCache,
};
