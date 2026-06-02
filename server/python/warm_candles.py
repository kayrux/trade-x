"""
warm_candles.py — Pre-load historical candle data for a curated list of symbols.

Calls the local Node/Express candles endpoint, which triggers gap-fill for each
symbol.  Safe to run repeatedly — the gap-fill algorithm is idempotent.

Usage:
    python warm_candles.py                  # uses SYMBOLS list below
    python warm_candles.py AAPL MSFT GOOG   # override with CLI args

Requirements:
    pip install requests

The Node server and Python candle service must both be running.
"""

import sys
import time
import requests

# ─── Curated symbol list ─────────────────────────────────────────────────────
# Add any symbols you want pre-loaded here.
SYMBOLS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
    "META", "TSLA", "BRK.B", "JPM", "V",
    "SPY", "QQQ", "IWM",
]

NODE_BASE = "http://localhost:3001"   # adjust if your Express server runs on a different port
DELAY_BETWEEN = 1.0                  # seconds between requests (be gentle)


def warm(symbol: str) -> None:
    url = f"{NODE_BASE}/candles/{symbol}"
    params = {"resolution": "daily", "range": "10y"}
    try:
        resp = requests.get(url, params=params, timeout=180)
        if resp.status_code == 200:
            candle_count = len(resp.json().get("candles", []))
            print(f"  {symbol:10s}  OK  ({candle_count} candles)")
        elif resp.status_code == 404:
            print(f"  {symbol:10s}  NOT FOUND (skipped)")
        else:
            print(f"  {symbol:10s}  HTTP {resp.status_code}: {resp.text[:120]}")
    except requests.exceptions.RequestException as exc:
        print(f"  {symbol:10s}  ERROR: {exc}")


def main():
    symbols = sys.argv[1:] or SYMBOLS
    print(f"Warming {len(symbols)} symbol(s)...\n")
    for symbol in symbols:
        warm(symbol.upper())
        time.sleep(DELAY_BETWEEN)
    print("\nDone.")


if __name__ == "__main__":
    main()
