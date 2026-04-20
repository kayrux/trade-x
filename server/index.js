require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const syncSymbols = require('./src/jobs/syncSymbols');
const symbolsRouter = require('./src/routes/symbols');
const candlesRouter = require('./src/routes/candles');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.use('/symbols', symbolsRouter);
app.use('/candles', candlesRouter);

// Sync symbols once at startup, then daily at midnight
syncSymbols();
cron.schedule('0 0 * * *', syncSymbols);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
