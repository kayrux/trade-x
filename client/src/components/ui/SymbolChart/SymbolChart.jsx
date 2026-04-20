import { useState } from 'react';
import { useCandles } from '../../../hooks/useCandles';
import CandleChart from '../CandleChart/CandleChart';
import ResolutionSwitcher from '../ResolutionSwitcher/ResolutionSwitcher';
import './SymbolChart.css';

const RESOLUTIONS = ['daily', 'weekly', 'monthly'];

function SymbolChart({ symbol }) {
  const [resolution, setResolution] = useState('daily');
  const { candles, loading, error } = useCandles(symbol, resolution);

  return (
    <div className="symbol-chart">
      <div className="symbol-chart__header">
        <span className="symbol-chart__title">Price History</span>
        <ResolutionSwitcher
          resolution={resolution}
          onChange={setResolution}
          options={RESOLUTIONS}
        />
      </div>
      <CandleChart
        key={resolution}
        candles={candles}
        resolution={resolution}
        loading={loading}
        error={error}
      />
    </div>
  );
}

export default SymbolChart;
