"""
candle_service.py — FastAPI wrapper around yfinance for historical daily OHLCV.

Start with:
    uvicorn candle_service:app --port 5001

Single endpoint:
    GET /candles?symbol=AAPL&from=2016-01-01&to=2024-12-31

Response (always 200 unless a hard error):
    { "symbol": "AAPL", "candles": [...] }
    Empty candles list means no data in the requested window (pre-IPO, bad ticker, etc.)
"""

import asyncio
import math
import time
from datetime import date
from typing import Optional

import yfinance as yf
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse

app = FastAPI()

RETRY_ATTEMPTS = 3
RETRY_DELAYS = [4, 16, 64]   # seconds between attempts
THROTTLE_SLEEP = 0.5         # seconds after each successful fetch


def _yahoo_ticker(symbol: str) -> str:
    """Map exchange symbols to Yahoo Finance format (BRK.B → BRK-B)."""
    return symbol.replace(".", "-")


def _fetch_with_retry(ticker: str, start: str, end: str) -> pd.DataFrame:
    last_exc = None
    for attempt, delay in enumerate(RETRY_DELAYS, start=1):
        try:
            df = yf.download(
                ticker,
                start=start,
                end=end,
                interval="1d",
                auto_adjust=False,
                actions=False,
                progress=False,
                multi_level_index=False,
            )
            # Flatten MultiIndex columns (can appear on single-ticker downloads in some yfinance versions)
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]
            return df
        except Exception as exc:
            last_exc = exc
            if attempt < RETRY_ATTEMPTS:
                time.sleep(delay)
    raise last_exc


def _safe_float(val, default=0.0) -> float:
    try:
        f = float(val)
        return default if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return default


def _df_to_candles(df: pd.DataFrame, symbol: str) -> list[dict]:
    if df is None or df.empty:
        return []

    # Normalise column names to lowercase
    df.columns = [c.lower().replace(" ", "_") for c in df.columns]

    # Drop rows where all OHLCV columns are NaN (non-trading days / data gaps)
    ohlcv_cols = [c for c in ["open", "high", "low", "close", "volume"] if c in df.columns]
    df = df.dropna(subset=ohlcv_cols, how="all")

    candles = []
    for ts, row in df.iterrows():
        date_str = ts.strftime("%Y-%m-%d")
        candles.append({
            "date":           date_str,
            "open":           _safe_float(row.get("open")),
            "high":           _safe_float(row.get("high")),
            "low":            _safe_float(row.get("low")),
            "close":          _safe_float(row.get("close")),
            "adjusted_close": _safe_float(row.get("adj_close")),
            "volume":         int(_safe_float(row.get("volume"))),
        })
    return candles


@app.get("/candles")
def get_candles(
    symbol: str = Query(..., description="Stock ticker, e.g. AAPL"),
    from_date: str = Query(..., alias="from", description="Start date YYYY-MM-DD (inclusive)"),
    to_date:   str = Query(..., alias="to",   description="End date YYYY-MM-DD (inclusive)"),
):
    # Validate dates
    try:
        date.fromisoformat(from_date)
        date.fromisoformat(to_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {exc}")

    ticker = _yahoo_ticker(symbol.upper())

    # yfinance end date is exclusive — add one day so to_date is included
    to_exclusive = str(date.fromisoformat(to_date).replace(day=date.fromisoformat(to_date).day)
                       .__class__.fromordinal(date.fromisoformat(to_date).toordinal() + 1))

    try:
        df = _fetch_with_retry(ticker, from_date, to_exclusive)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Upstream fetch failed: {exc}")

    candles = _df_to_candles(df, symbol)

    time.sleep(THROTTLE_SLEEP)

    return {"symbol": symbol.upper(), "candles": candles}


@app.get("/health")
def health():
    return {"status": "ok"}
