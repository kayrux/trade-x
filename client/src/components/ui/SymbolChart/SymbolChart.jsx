import { useState, useMemo } from 'react';
import { useCandles } from '../../../hooks/useCandles';
import CandleChart from '../CandleChart/CandleChart';
import ResolutionSwitcher from '../ResolutionSwitcher/ResolutionSwitcher';
import './SymbolChart.css';

const RESOLUTIONS = ['daily', 'weekly', 'monthly'];


function SymbolChart({ symbol, quote }) {
  const [resolution, setResolution] = useState('daily');
  const { candles, loading, error } = useCandles(symbol, resolution);

  const candlesWithToday = useMemo(() => {
    if (!candles.length || !quote) return candles;

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
  }, [candles, quote]);

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
          resolution={resolution}
          onChange={setResolution}
          options={RESOLUTIONS}
        />
      </div>
    </div>
  );
}

export default SymbolChart;
