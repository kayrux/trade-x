// Float dust tolerance so a legitimate full close (e.g. buy 10, sell 10) isn't
// misread as an oversell by a rounding hair.
const EPSILON = 1e-9;

// Thrown when the replay would drive the running quantity below zero — i.e. a
// sell that exceeds the shares held at that point in time. The route turns this
// into a 400 and the surrounding transaction rolls the offending write back.
class OversellError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OversellError';
    this.code = 'OVERSELL';
  }
}

// Replays a user's full trade history for one symbol (average-cost method) and
// writes the resulting position into portfolio_holdings.
//
// Runs on a caller-supplied transaction `client` (not the pool) so it commits
// atomically with the trade write that triggered it. Recomputing from scratch —
// rather than nudging the stored row — is what keeps the aggregate correct
// through edits and deletes, which can change a trade's quantity, price, or even
// its place in the replay order (traded_at).
//
// Long-only: a sell that exceeds the shares held at that chronological point
// throws OversellError, which rolls the triggering write back. Because the whole
// history is replayed in traded_at order, this also catches an edit or an
// out-of-order trade that would retroactively make some later sell an oversell.
async function recomputeHolding(client, userId, symbolId) {
  const { rows } = await client.query(
    `SELECT side, quantity, price, traded_at
       FROM trades
      WHERE user_id = $1 AND symbol_id = $2
      ORDER BY traded_at, created_at`,
    [userId, symbolId],
  );

  let qty = 0;
  let avgCost = 0; // cost of the open shares; only meaningful while qty > 0
  let realized = 0;

  for (const t of rows) {
    const q = Number(t.quantity);
    const price = Number(t.price);

    if (t.side === 'buy') {
      const nextQty = qty + q;
      avgCost = nextQty === 0 ? 0 : (avgCost * qty + price * q) / nextQty;
      qty = nextQty;
    } else {
      if (q > qty + EPSILON) {
        const day = new Date(t.traded_at).toISOString().split('T')[0];
        const held = Number(qty.toFixed(6));
        throw new OversellError(
          `Selling ${q} shares on ${day} exceeds the ${held} held at that point`,
        );
      }
      realized += (price - avgCost) * q;
      qty -= q;
      if (qty <= EPSILON) {
        qty = 0; // kill float dust at a full close
        avgCost = 0;
      }
    }
  }

  const avgCostValue = qty > 0 ? avgCost : null;

  await client.query(
    `INSERT INTO portfolio_holdings
       (user_id, symbol_id, quantity, avg_cost, realized_pnl, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, symbol_id) DO UPDATE
       SET quantity     = EXCLUDED.quantity,
           avg_cost     = EXCLUDED.avg_cost,
           realized_pnl = EXCLUDED.realized_pnl,
           updated_at   = NOW()`,
    [userId, symbolId, qty, avgCostValue, realized],
  );
}

module.exports = { recomputeHolding, OversellError };
