require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const syncSymbols = require('./src/jobs/syncSymbols');
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

// Check tracked channels for new videos every hour
cron.schedule('0 * * * *', syncAllChannels);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
