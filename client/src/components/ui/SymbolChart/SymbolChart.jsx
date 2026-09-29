import { useState, useMemo } from 'react';
import { useCandles } from '../../../hooks/useCandles';
import CandleChart from '../CandleChart/CandleChart';
import ResolutionSwitcher from '../ResolutionSwitcher/ResolutionSwitcher';
import './SymbolChart.css';

const RESOLUTIONS = ['Daily', 'Weekly', 'Monthly'];
const RANGES = ['5D', '1M', '3M', 'YTD', '1Y', '5Y', 'Max'];

// Today's date in US market time (America/New_York), formatted YYYY-MM-DD.
// Using UTC here would roll into the next calendar day on US evenings and
// append a phantom next-day (e.g. Saturday) candle. en-CA formats as YYYY-MM-DD.
function marketDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date);
}


const MARKER_COLORS = { buy: '#22c55e', sell: '#ef4444' };

function SymbolChart({ symbol, quote, trades = [] }) {
  const [activeMode, setActiveMode] = useState('range');
  const [resolution, setResolution] = useState('Daily');
  const [range, setRange] = useState('1Y');
  const { candles, loading, error } = useCandles(symbol, resolution.toLowerCase(), range.toLowerCase());

  // Commodities (Alpha Vantage, namespaced "AV:") are single-value daily series —
  // render them as an area line instead of candlesticks.
  const chartType = symbol?.startsWith('AV:') ? 'line' : 'candles';

  const handleRangeChange = (newRange) => {
    setRange(newRange);
    setResolution('Daily');
    setActiveMode('range');
  };

  const handleResolutionChange = (newResolution) => {
    setResolution(newResolution);
    setRange('Max');
    setActiveMode('resolution');
  };

  const candlesWithToday = useMemo(() => {
    if (!candles.length || !quote || quote.symbol !== symbol) return candles;

    const todayStr = marketDateStr();
    // No session on weekends — don't append a phantom Sat/Sun candle.
    const dow = new Date(`${todayStr}T00:00:00Z`).getUTCDay(); // 0=Sun, 6=Sat
    if (dow === 0 || dow === 6) return candles;

    const lastDate = candles[candles.length - 1].ts.split('T')[0];
    if (lastDate >= todayStr) return candles;

    if (quote.price_source === 'live') {
      return [...candles, {
        ts:     `${todayStr}T00:00:00Z`,
        open:   quote.open,
        high:   quote.high,
        low:    quote.low,
        close:  quote.last_price,
        volume: quote.volume,
      }];
    }

    const pc = quote.prev_close != null ? parseFloat(quote.prev_close) : null;
    if (pc > 0) {
      return [...candles, {
        ts:     `${todayStr}T00:00:00Z`,
        open:   pc,
        high:   pc,
        low:    pc,
        close:  pc,
        volume: null,
      }];
    }

    return candles;
  }, [candles, quote, symbol]);

  // Buy/sell pins are only shown on the Daily chart, where a trade's calendar
  // day maps 1:1 to a bar. Weekly/monthly are aggregated views, so a trade date
  // wouldn't line up with a bar's timestamp — omit markers there.
  const markers = useMemo(() => {
    if (resolution !== 'Daily' || !trades.length) return [];
    return trades.map((t) => ({
      time: t.traded_at.split('T')[0], // matches the daily bars' YYYY-MM-DD key
      position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
      shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
      color: MARKER_COLORS[t.side],
      text: t.side === 'buy' ? 'B' : 'S',
    }));
  }, [trades, resolution]);

  return (
    <div className="symbol-chart">
      <CandleChart
        key={resolution}
        candles={candlesWithToday}
        resolution={resolution}
        loading={loading}
        error={error}
        chartType={chartType}
        markers={markers}
      />
      <div className="symbol-chart__footer">
        <ResolutionSwitcher
          resolution={activeMode === 'range' ? range : null}
          onChange={handleRangeChange}
          options={RANGES}
        />
        <span className="symbol-chart__divider" />
        <ResolutionSwitcher
          resolution={activeMode === 'resolution' ? resolution : null}
          onChange={handleResolutionChange}
          options={RESOLUTIONS}
        />
      </div>
    </div>
  );
}

export default SymbolChart;
