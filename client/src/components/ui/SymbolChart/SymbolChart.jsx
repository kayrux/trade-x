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
