import { useState } from 'react';
import { useCandles } from '../../../hooks/useCandles';
import { useQuote } from '../../../hooks/useQuote';
import CandleChart from '../CandleChart/CandleChart';
import ResolutionSwitcher from '../ResolutionSwitcher/ResolutionSwitcher';
import './SymbolChart.css';

const RESOLUTIONS = ['daily', 'weekly', 'monthly'];

function SymbolChart({ symbol }) {
  const [resolution, setResolution] = useState('daily');
  const { candles, loading, error } = useCandles(symbol, resolution);
  const { quote } = useQuote(symbol);

  const price = quote ? parseFloat(quote.last_price) : NaN;
  const hasPrice = !isNaN(price) && price > 0;

  return (
    <div className="symbol-chart">
      <div className="symbol-chart__identity">
        <span className="symbol-chart__ticker">{symbol}</span>
        {quote?.name && (
          <span className="symbol-chart__name">{quote.name}</span>
        )}
        {hasPrice && (
          <span className="symbol-chart__price">${price.toFixed(2)}</span>
        )}
      </div>
      <CandleChart
        key={resolution}
        candles={candles}
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
