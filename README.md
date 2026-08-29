# Trade-X

Full-stack financial market data dashboard. Pulls data from Finnhub and Yahoo Finance, served through a React frontend backed by a Node/Express API and PostgreSQL database.

## Prerequisites

- Node.js
- Python 3.x
- PostgreSQL (running locally)
- A `.env` file in `server/` — see required vars below

## Running the Project

All three processes must be running simultaneously. Start them in this order:

### 1. Node/Express Server (port 4000)

```bash
cd server
npm install
npm start
```

Required `.env` variables:

```
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/trade-x
FINNHUB_API_KEY=your_key
EODHD_API_KEY=your_key
YOUTUBE_API_KEY=your_key
GEMINI_API_KEY=your_key
PORT=4000
```

### 2. Python Candle Service (port 5001)

```bash
cd server/python
pip install -r requirements.txt
uvicorn candle_service:app --port 5001
```

The Node server proxies historical OHLCV candle requests to this service. It fetches data from Yahoo Finance.

### 3. React Client (port 3000)

```bash
cd client
npm start
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Optional: Pre-warm Candle Data

To pre-load historical candle data for a set of symbols (requires both servers running):

```bash
cd server/python
python warm_candles.py              # uses built-in symbol list
python warm_candles.py AAPL MSFT    # specific symbols
```
