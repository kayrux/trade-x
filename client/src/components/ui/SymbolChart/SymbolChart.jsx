import { useState, useMemo } from 'react';
import { useCandles } from '../../../hooks/useCandles';
import CandleChart from '../CandleChart/CandleChart';
import ResolutionSwitcher from '../ResolutionSwitcher/ResolutionSwitcher';
import './SymbolChart.css';

const RESOLUTIONS = ['Daily', 'Weekly', 'Monthly'];
const RANGES = ['5D', '1M', '3M', 'YTD', '1Y', '5Y', 'Max'];


function SymbolChart({ symbol, quote }) {
  const [activeMode, setActiveMode] = useState('range');
  const [resolution, setResolution] = useState('Daily');
  const [range, setRange] = useState('1Y');
  const { candles, loading, error } = useCandles(symbol, resolution.toLowerCase(), range.toLowerCase());

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

    const todayStr = new Date().toISOString().split('T')[0];
    const lastDate = new Date(candles[candles.length - 1].ts).toISOString().split('T')[0];
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

  return (
    <div className="symbol-chart">
      <CandleChart
        key={resolution}
        candles={candlesWithToday}
        resolution={resolution}
        loading={loading}
        error={error}
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
