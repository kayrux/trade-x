const axios = require('axios');
const pool = require('../db');

async function syncSymbols() {
  console.log('Syncing symbols from Finnhub...');
  try {
    const { data } = await axios.get('https://finnhub.io/api/v1/stock/symbol', {
      params: { exchange: 'US', token: process.env.FINNHUB_API_KEY },
    });

    for (const item of data) {
      if (!item.figi) continue; // skip entries without a unique key
      await pool.query(
        `INSERT INTO symbols (id, symbol, name, exchange)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           symbol   = EXCLUDED.symbol,
           name     = EXCLUDED.name,
           exchange = EXCLUDED.exchange`,
        [item.figi, item.symbol, item.description, item.mic]
      );
    }

    console.log(`Synced ${data.length} symbols.`);
  } catch (err) {
    console.error('Symbol sync failed:', err.message);
  }
}

module.exports = syncSymbols;
