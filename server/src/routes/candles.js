const express = require("express");
const pool = require("../db");
const { ensureCoverage } = require("../lib/gapFill");

const router = express.Router();

const VALID_RESOLUTIONS = ["daily", "weekly", "monthly"];

function getRangeFrom(range) {
  const now = new Date();
  const d = new Date(now);
  switch (range.toLowerCase()) {
    case "5d":  d.setDate(d.getDate() - 7);           return d;
    case "1m":  d.setMonth(d.getMonth() - 1);         return d;
    case "3m":  d.setMonth(d.getMonth() - 3);         return d;
    case "ytd": return new Date(now.getFullYear(), 0, 1);
    case "1y":  d.setFullYear(d.getFullYear() - 1);   return d;
    case "5y":  d.setFullYear(d.getFullYear() - 5);   return d;
    case "max": d.setFullYear(d.getFullYear() - 100); return d;
    default:    return null;
  }
}

// Map resolution to the correct table/view
const RESOLUTION_SOURCE = {
  daily:   "symbol_candles",
  weekly:  "symbol_candles_weekly",
  monthly: "symbol_candles_monthly",
};

// GET /candles/:symbol?resolution=daily|weekly|monthly&range=1y|2y|5y|10y|max&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().trim();
  const resolution = (req.query.resolution || "daily").toLowerCase();

  if (!VALID_RESOLUTIONS.includes(resolution)) {
    return res.status(400).json({
      error: `Invalid resolution. Must be one of: ${VALID_RESOLUTIONS.join(", ")}`,
    });
  }

  try {
    // 1. Resolve symbol
    const { rows: symRows } = await pool.query(
      "SELECT id FROM symbols WHERE symbol = $1",
      [symbol],
    );
    if (symRows.length === 0) return res.status(404).json({ error: "Symbol not found" });
    const symbolId = symRows[0].id;

    // 2. Ensure daily coverage is current (gap-fill if needed).
    //    Weekly/monthly are derived from daily rows so this covers all resolutions.
    await ensureCoverage(symbolId, symbol);

    // 3. Build date window from range or explicit from/to
    let from = req.query.from || null;
    let to   = req.query.to   || null;
    const range = req.query.range;

    if (!from && range) {
      const d = getRangeFrom(range);
      if (d) from = d.toISOString().split("T")[0];
    }

    // 4. Query the appropriate table/view
    const source = RESOLUTION_SOURCE[resolution];
    let query = `
      SELECT ts, open, high, low, close, adjusted_close, volume
      FROM ${source}
      WHERE symbol_id = $1
    `;
    const params = [symbolId];

    if (from) {
      params.push(from);
      query += ` AND ts >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND ts <= $${params.length}`;
    }

    query += " ORDER BY ts ASC";

    const { rows } = await pool.query(query, params);
    res.json({ symbol, resolution, candles: rows });
  } catch (err) {
    console.error("candles route error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
