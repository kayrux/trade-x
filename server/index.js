require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const syncSymbols = require('./src/jobs/syncSymbols');
const syncCommodities = require('./src/jobs/syncCommodities');
const { syncAllChannels } = require('./src/jobs/syncVideos');
const symbolsRouter = require('./src/routes/symbols');
const candlesRouter = require('./src/routes/candles');
const newsRouter = require('./src/routes/news');
const channelsRouter = require('./src/routes/channels');
const picksRouter = require('./src/routes/picks');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.use('/symbols', symbolsRouter);
app.use('/candles', candlesRouter);
app.use('/news', newsRouter);
app.use('/channels', channelsRouter);
app.use('/picks', picksRouter);

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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
