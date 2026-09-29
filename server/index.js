require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const syncSymbols = require('./src/jobs/syncSymbols');
const syncCommodities = require('./src/jobs/syncCommodities');
const { syncAllChannels } = require('./src/jobs/syncVideos');
const syncQuotes = require('./src/jobs/syncQuotes');
const symbolsRouter = require('./src/routes/symbols');
const candlesRouter = require('./src/routes/candles');
const newsRouter = require('./src/routes/news');
const channelsRouter = require('./src/routes/channels');
const picksRouter = require('./src/routes/picks');
const authRouter = require('./src/routes/auth');
const watchlistsRouter = require('./src/routes/watchlists');
const accountsRouter = require('./src/routes/accounts');
const tradesRouter = require('./src/routes/trades');
const holdingsRouter = require('./src/routes/holdings');
const { attachUser } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Populates req.user when a valid Bearer token is present. Never rejects —
// per-route requireAuth/requireAdmin do the gating.
app.use(attachUser);

app.use('/auth', authRouter);
app.use('/symbols', symbolsRouter);
app.use('/candles', candlesRouter);
app.use('/news', newsRouter);
app.use('/channels', channelsRouter);
app.use('/picks', picksRouter);
app.use('/watchlists', watchlistsRouter);
app.use('/accounts', accountsRouter);
app.use('/trades', tradesRouter);
app.use('/holdings', holdingsRouter);

// Sync symbols once at startup, then daily at midnight
syncSymbols();
cron.schedule('0 0 * * *', syncSymbols);

// Sync Alpha Vantage commodity prices (Gold, Silver, WTI, Brent).
// Startup call is freshness-guarded so frequent restarts don't burn the free
// tier's 25 requests/day; the daily cron forces a refresh.
syncCommodities().catch((err) => console.error('[commodities]', err.message));
cron.schedule('0 0 * * *', () => syncCommodities(true));

// Check tracked channels for new videos every hour
cron.schedule('0 * * * *', syncAllChannels);

// Keep quotes warm for watchlisted symbols. Without this, symbol_quotes is only
// written when someone opens a symbol's page, so sidebar prices go stale (and
// their % change turns wrong, since prev_close staled with them). The job is a
// no-op outside the US session and skips symbols refreshed in the last 90s, so
// most ticks cost nothing.
syncQuotes();
cron.schedule('*/2 * * * 1-5', syncQuotes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
